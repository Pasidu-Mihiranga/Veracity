import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  assertPublicUrl,
  isPublicUrl,
  classifyIpLiteral,
  isPublicAddress,
  safeFetch,
  setResolver,
  OutboundPolicyError,
} from '@/lib/net/outbound-policy';

afterEach(() => {
  setResolver(null);
  vi.unstubAllGlobals();
});

/** Resolve every hostname to a fixed address, so DNS behaviour is deterministic. */
function resolveTo(address: string, family = 4) {
  setResolver(async () => [{ address, family }]);
}

describe('IP literal classification', () => {
  it('rejects loopback in every encoding the URL parser accepts', async () => {
    // The previous guard compared against the literal string "127.0.0.1", so
    // each of these forms reached the network.
    const forms = [
      'http://127.0.0.1/admin',
      'http://2130706433/admin', // 32-bit decimal
      'http://0x7f.0.0.1/admin', // hex octet
      'http://0177.0.0.1/admin', // octal octet
      'http://[::1]/admin', // IPv6 loopback
      'http://[::ffff:127.0.0.1]/admin', // IPv4-mapped IPv6
    ];

    for (const url of forms) {
      await expect(assertPublicUrl(url)).rejects.toThrow(OutboundPolicyError);
      expect(await isPublicUrl(url)).toBe(false);
    }
  });

  it('rejects private, link-local, and cloud-metadata ranges', async () => {
    const blocked = [
      'http://10.0.0.5/',
      'http://172.16.4.1/',
      'http://172.31.255.255/',
      'http://192.168.1.1/',
      'http://169.254.169.254/latest/meta-data/', // cloud metadata endpoint
      'http://100.64.0.1/', // CGNAT
      'http://0.0.0.0/',
      'http://[fc00::1]/', // unique-local
      'http://[fe80::1]/', // link-local
    ];

    for (const url of blocked) {
      await expect(assertPublicUrl(url)).rejects.toMatchObject({ reason: 'private-address' });
    }
  });

  it('allows genuinely public IP literals', () => {
    expect(classifyIpLiteral('93.184.216.34')).toBe('public');
    expect(classifyIpLiteral('8.8.8.8')).toBe('public');
    expect(classifyIpLiteral('172.32.0.1')).toBe('public'); // just outside 172.16/12
    expect(classifyIpLiteral('example.com')).toBeNull();
  });

  it('classifies resolved addresses by family', () => {
    expect(isPublicAddress('93.184.216.34', 4)).toBe(true);
    expect(isPublicAddress('10.1.2.3', 4)).toBe(false);
    expect(isPublicAddress('2606:2800:220:1::1', 6)).toBe(true);
    expect(isPublicAddress('::1', 6)).toBe(false);
  });
});

describe('protocol and port policy', () => {
  it('rejects non-http protocols', async () => {
    for (const url of ['file:///etc/passwd', 'gopher://example.com/', 'ftp://example.com/']) {
      await expect(assertPublicUrl(url)).rejects.toMatchObject({
        reason: 'unsupported-protocol',
      });
    }
  });

  it('rejects non-web ports', async () => {
    resolveTo('93.184.216.34');
    await expect(assertPublicUrl('http://example.com:6379/')).rejects.toMatchObject({
      reason: 'blocked-port',
    });
    await expect(assertPublicUrl('http://example.com:22/')).rejects.toMatchObject({
      reason: 'blocked-port',
    });
  });

  it('rejects malformed input', async () => {
    await expect(assertPublicUrl('not a url')).rejects.toMatchObject({
      reason: 'malformed-url',
    });
  });
});

describe('DNS policy', () => {
  it('rejects a public hostname that resolves to a private address', async () => {
    resolveTo('127.0.0.1');
    await expect(assertPublicUrl('https://internal.example.com/')).rejects.toMatchObject({
      reason: 'private-address',
    });
  });

  it('rejects when any single record is private, even if others are public', async () => {
    setResolver(async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]);
    await expect(assertPublicUrl('https://split-horizon.example.com/')).rejects.toMatchObject({
      reason: 'private-address',
    });
  });

  it('fails closed when resolution fails or returns nothing', async () => {
    setResolver(async () => {
      throw new Error('ENOTFOUND');
    });
    await expect(assertPublicUrl('https://nope.example.com/')).rejects.toMatchObject({
      reason: 'dns-failure',
    });

    setResolver(async () => []);
    await expect(assertPublicUrl('https://empty.example.com/')).rejects.toMatchObject({
      reason: 'dns-failure',
    });
  });

  it('accepts a public hostname resolving to a public address', async () => {
    resolveTo('93.184.216.34');
    const url = await assertPublicUrl('https://example.com/pricing');
    expect(url.hostname).toBe('example.com');
  });
});

describe('safeFetch', () => {
  it('re-validates redirect targets and blocks a public → private hop', async () => {
    // The exact bypass the audit described: the origin is public, so a naive
    // pre-flight check passes, and `redirect: 'follow'` then lands internally.
    setResolver(async (hostname) =>
      hostname === 'evil.example.com'
        ? [{ address: '93.184.216.34', family: 4 }]
        : [{ address: '169.254.169.254', family: 4 }],
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: 'http://metadata.internal.example.com/token' },
        }),
      ),
    );

    await expect(safeFetch('https://evil.example.com/start')).rejects.toMatchObject({
      reason: 'private-address',
    });
  });

  it('stops after the redirect budget is exhausted', async () => {
    resolveTo('93.184.216.34');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: 'https://example.com/next' },
        }),
      ),
    );

    await expect(
      safeFetch('https://example.com/start', { maxRedirects: 2 }),
    ).rejects.toMatchObject({ reason: 'too-many-redirects' });
  });

  it('rejects an oversized response declared by content-length', async () => {
    resolveTo('93.184.216.34');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('x', { status: 200, headers: { 'content-length': '99999999' } }),
      ),
    );

    await expect(
      safeFetch('https://example.com/big', { maxBytes: 1024 }),
    ).rejects.toMatchObject({ reason: 'response-too-large' });
  });

  it('rejects an oversized response that declares no content-length', async () => {
    resolveTo('93.184.216.34');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('y'.repeat(5000), { status: 200 })),
    );

    await expect(
      safeFetch('https://example.com/big', { maxBytes: 1024 }),
    ).rejects.toMatchObject({ reason: 'response-too-large' });
  });

  it('returns a readable body for an allowed request', async () => {
    resolveTo('93.184.216.34');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>pricing</html>', { status: 200 })),
    );

    const res = await safeFetch('https://example.com/pricing');
    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toContain('pricing');
  });
});
