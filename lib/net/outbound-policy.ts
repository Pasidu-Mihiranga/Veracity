/**
 * Centralised outbound URL policy for every server-side fetch that can be
 * influenced by a user prompt or by model output.
 *
 * Why this exists (product-level, not enterprise security work):
 * research tools resolve competitor/product URLs that originate from user
 * input and from LLM output. Before this module each tool did its own ad-hoc
 * string check — `lib/tools/source-validator.ts` rejected the literal string
 * "localhost" and nothing else. A hostname resolving to a private address, an
 * alternative IP encoding, or a public URL that redirects inward all passed.
 * Beyond the safety problem that creates, unguarded fetches waste provider
 * budget on URLs that can never yield a citable public page.
 *
 * Policy, in order:
 *   1. Parse. Only http/https survive.
 *   2. Restrict ports to 80/443 (a public source page does not need others).
 *   3. Reject literal IP hosts in any non-public range, in any encoding.
 *   4. Resolve DNS and reject if *any* returned record is non-public.
 *      Every record matters: a host with one public and one private A record
 *      must not pass.
 *   5. Re-run the whole check on every redirect hop.
 *   6. Cap redirects, response bytes, and wall-clock time.
 *
 * Failure mode is closed: an unresolvable host is rejected, not allowed.
 *
 * Testing note: DNS resolution is injectable via `setResolver` so the policy
 * can be unit-tested without network access. When `NODE_ENV === 'test'` the
 * DNS step is skipped by default (scheme, port, literal-IP and blocklist checks
 * still run) so existing tool tests that mock `fetch` against example hostnames
 * keep working. `__tests__/outbound-policy.test.ts` injects a fake resolver to
 * cover the DNS path directly.
 */

import { lookup as dnsLookup } from 'node:dns/promises';

// ── Types ────────────────────────────────────────────────────────────────────

export type OutboundRejectionReason =
  | 'malformed-url'
  | 'unsupported-protocol'
  | 'blocked-port'
  | 'private-address'
  | 'dns-failure'
  | 'too-many-redirects'
  | 'response-too-large'
  | 'timeout';

export class OutboundPolicyError extends Error {
  readonly reason: OutboundRejectionReason;
  readonly url: string;

  constructor(reason: OutboundRejectionReason, url: string, detail?: string) {
    super(`Outbound request blocked (${reason}): ${url}${detail ? ` — ${detail}` : ''}`);
    this.name = 'OutboundPolicyError';
    this.reason = reason;
    this.url = url;
  }
}

export interface SafeFetchOptions {
  /** Maximum redirect hops to follow. Each hop is re-validated. */
  maxRedirects?: number;
  /** Maximum bytes to read from the response body. */
  maxBytes?: number;
  /** Wall-clock budget for the whole request including redirects, in ms. */
  timeoutMs?: number;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
}

export const OUTBOUND_DEFAULTS = {
  maxRedirects: 5,
  maxBytes: 5 * 1024 * 1024, // 5 MB — larger pages are not useful as evidence
  timeoutMs: 20_000,
} as const;

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const ALLOWED_PORTS = new Set(['', '80', '443']);

// ── Address classification ───────────────────────────────────────────────────

/**
 * Normalise the many ways an IPv4 address can be written. `new URL()` accepts
 * decimal (`2130706433`), octal (`0177.0.0.1`) and hex (`0x7f.0.0.1`) forms and
 * hands them back verbatim in `hostname`, so a naive string comparison against
 * "127.0.0.1" misses all of them.
 *
 * Returns the four octets, or null when the host is not an IPv4 literal.
 */
function parseIPv4(host: string): [number, number, number, number] | null {
  const stripped = host.replace(/^\[|\]$/g, '');

  // Single-number form: 32-bit integer.
  if (/^\d+$/.test(stripped)) {
    const n = Number(stripped);
    if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) return null;
    return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  }

  const parts = stripped.split('.');
  if (parts.length !== 4) return null;

  const octets: number[] = [];
  for (const part of parts) {
    if (part === '') return null;
    let value: number;
    if (/^0x[0-9a-f]+$/i.test(part)) {
      value = Number.parseInt(part, 16);
    } else if (/^0[0-7]+$/.test(part)) {
      value = Number.parseInt(part, 8);
    } else if (/^\d+$/.test(part)) {
      value = Number.parseInt(part, 10);
    } else {
      return null;
    }
    if (!Number.isInteger(value) || value < 0 || value > 255) return null;
    octets.push(value);
  }
  return octets as [number, number, number, number];
}

/** True when an IPv4 address is outside every reserved / non-routable range. */
function isPublicIPv4(octets: [number, number, number, number]): boolean {
  const [a, b] = octets;

  if (a === 0) return false; // 0.0.0.0/8 "this network"
  if (a === 10) return false; // private
  if (a === 127) return false; // loopback
  if (a === 169 && b === 254) return false; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 168) return false; // private
  if (a === 192 && b === 0) return false; // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51) return false; // TEST-NET-2
  if (a === 203 && b === 0) return false; // TEST-NET-3
  if (a >= 224) return false; // multicast + reserved + broadcast

  return true;
}

/**
 * Expand an IPv6 address to its eight 16-bit groups.
 *
 * Textual matching is not sufficient here: `new URL()` re-serialises IPv6
 * hosts into their canonical compressed form, so `[::ffff:127.0.0.1]` arrives
 * as `[::ffff:7f00:1]` and a dotted-quad regex never fires. Expanding to
 * numeric groups makes every notation converge on the same value.
 *
 * Returns null when the input is not a valid IPv6 address.
 */
function expandIPv6(input: string): number[] | null {
  let addr = input;

  // A trailing dotted-quad (::ffff:127.0.0.1) becomes two hex groups.
  const tail = addr.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const v4 = parseIPv4(tail[1]);
    if (!v4) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    addr = `${addr.slice(0, tail.index)}${hi}:${lo}`;
  }

  const halves = addr.split('::');
  if (halves.length > 2) return null;

  const toGroups = (s: string): number[] | null => {
    if (s === '') return [];
    const out: number[] = [];
    for (const part of s.split(':')) {
      if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
      out.push(Number.parseInt(part, 16));
    }
    return out;
  };

  const head = toGroups(halves[0]);
  if (head === null) return null;

  if (halves.length === 1) return head.length === 8 ? head : null;

  const rest = toGroups(halves[1]);
  if (rest === null) return null;

  const missing = 8 - head.length - rest.length;
  if (missing < 1) return null;

  return [...head, ...Array(missing).fill(0), ...rest];
}

/** True when an IPv6 address is globally routable. */
function isPublicIPv6(host: string): boolean {
  const addr = host.replace(/^\[|\]$/g, '').toLowerCase().split('%')[0];
  const g = expandIPv6(addr);
  if (!g) return false; // unparseable — fail closed

  const allZeroPrefix = (n: number) => g.slice(0, n).every((x) => x === 0);

  if (allZeroPrefix(8)) return false; // :: unspecified
  if (allZeroPrefix(7) && g[7] === 1) return false; // ::1 loopback

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d): judge the
  // embedded IPv4 address rather than the wrapper.
  if (allZeroPrefix(5) && g[5] === 0xffff) {
    return isPublicIPv4([g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff]);
  }
  if (allZeroPrefix(6)) {
    return isPublicIPv4([g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff]);
  }

  if ((g[0] & 0xfe00) === 0xfc00) return false; // fc00::/7 unique-local
  if ((g[0] & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return false; // ff00::/8 multicast

  return true;
}

/**
 * Classify a bare host string that is already known to be an IP literal.
 * Returns null when the host is not an IP literal at all (i.e. a DNS name).
 */
export function classifyIpLiteral(host: string): 'public' | 'private' | null {
  const v4 = parseIPv4(host);
  if (v4) return isPublicIPv4(v4) ? 'public' : 'private';

  // Bracketed or colon-bearing hosts are IPv6 literals.
  if (host.includes(':') || (host.startsWith('[') && host.endsWith(']'))) {
    return isPublicIPv6(host) ? 'public' : 'private';
  }

  return null;
}

/** True when a resolved address string is safe to contact. */
export function isPublicAddress(address: string, family: number): boolean {
  if (family === 6) return isPublicIPv6(address);
  const v4 = parseIPv4(address);
  return v4 !== null && isPublicIPv4(v4);
}

// ── DNS resolution (injectable for tests) ────────────────────────────────────

export type ResolvedAddress = { address: string; family: number };
export type HostResolver = (hostname: string) => Promise<ResolvedAddress[]>;

const defaultResolver: HostResolver = async (hostname) => {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((r) => ({ address: r.address, family: r.family }));
};

let activeResolver: HostResolver = defaultResolver;

/** Override DNS resolution. Tests only. Pass null to restore the default. */
export function setResolver(resolver: HostResolver | null): void {
  activeResolver = resolver ?? defaultResolver;
}

/** Whether the DNS step runs. Skipped under NODE_ENV=test unless a resolver was injected. */
function dnsCheckEnabled(): boolean {
  if (activeResolver !== defaultResolver) return true;
  if (process.env.VERACITY_EGRESS_GUARD === 'off') return false;
  return process.env.NODE_ENV !== 'test';
}

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate a single URL against the outbound policy.
 * Throws `OutboundPolicyError` on rejection; returns the parsed URL on success.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new OutboundPolicyError('malformed-url', rawUrl);
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new OutboundPolicyError('unsupported-protocol', rawUrl, parsed.protocol);
  }

  if (!ALLOWED_PORTS.has(parsed.port)) {
    throw new OutboundPolicyError('blocked-port', rawUrl, `port ${parsed.port}`);
  }

  const literal = classifyIpLiteral(parsed.hostname);
  if (literal === 'private') {
    throw new OutboundPolicyError('private-address', rawUrl, parsed.hostname);
  }

  // A public IP literal needs no DNS step.
  if (literal === 'public') return parsed;

  if (!dnsCheckEnabled()) return parsed;

  let records: ResolvedAddress[];
  try {
    records = await activeResolver(parsed.hostname);
  } catch (err) {
    throw new OutboundPolicyError(
      'dns-failure',
      rawUrl,
      err instanceof Error ? err.message : String(err),
    );
  }

  if (records.length === 0) {
    throw new OutboundPolicyError('dns-failure', rawUrl, 'no records');
  }

  // Every record must be public. One private answer poisons the host.
  for (const record of records) {
    if (!isPublicAddress(record.address, record.family)) {
      throw new OutboundPolicyError('private-address', rawUrl, record.address);
    }
  }

  return parsed;
}

/** Non-throwing form, for filtering candidate URLs before spending a fetch. */
export async function isPublicUrl(rawUrl: string): Promise<boolean> {
  try {
    await assertPublicUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}

// ── Guarded fetch ────────────────────────────────────────────────────────────

/**
 * `fetch` with the outbound policy applied to the initial URL and to every
 * redirect hop, plus byte and time caps.
 *
 * Redirects are followed manually (`redirect: 'manual'`) because the platform
 * fetch would otherwise follow a public URL to a private one without giving us
 * a chance to inspect the intermediate Location header.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? OUTBOUND_DEFAULTS.maxRedirects;
  const maxBytes = options.maxBytes ?? OUTBOUND_DEFAULTS.maxBytes;
  const timeoutMs = options.timeoutMs ?? OUTBOUND_DEFAULTS.timeoutMs;

  const deadline = Date.now() + timeoutMs;
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const validated = await assertPublicUrl(currentUrl);

    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new OutboundPolicyError('timeout', rawUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);

    let response: Response;
    try {
      response = await fetch(validated.toString(), {
        method: options.method ?? 'GET',
        headers: options.headers,
        body: options.body,
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) throw new OutboundPolicyError('timeout', rawUrl);
      throw err;
    } finally {
      clearTimeout(timer);
    }

    const isRedirect = response.status >= 300 && response.status < 400;
    const location = response.headers.get('location');

    if (isRedirect && location) {
      // Resolve relative Location values against the current URL, then loop so
      // the next iteration re-validates the destination from scratch.
      currentUrl = new URL(location, validated).toString();
      continue;
    }

    const declaredLength = Number(response.headers.get('content-length') ?? '0');
    if (declaredLength > maxBytes) {
      throw new OutboundPolicyError('response-too-large', currentUrl, `${declaredLength} bytes`);
    }

    return capResponseBody(response, maxBytes, currentUrl);
  }

  throw new OutboundPolicyError('too-many-redirects', rawUrl);
}

/**
 * Enforce the byte cap even when the server sent no content-length, by reading
 * the stream and aborting once the limit is crossed. Returns a new Response
 * carrying the truncated-safe body so callers use the normal `.text()` API.
 */
async function capResponseBody(
  response: Response,
  maxBytes: number,
  url: string,
): Promise<Response> {
  if (!response.body) return response;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new OutboundPolicyError('response-too-large', url, `> ${maxBytes} bytes`);
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Response(merged, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
