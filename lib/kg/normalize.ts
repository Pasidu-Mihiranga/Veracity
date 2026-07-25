/** Pure key normalization for entity resolution */

export function normalizeEntityKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[,.]/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

export function hashClaimKey(text: string): string {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 240);
  let h = 0;
  for (let i = 0; i < normalized.length; i++) {
    h = (h * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return `claim-${h.toString(16)}`;
}

export function sourceKeyFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return normalizeEntityKey(`${u.hostname}${u.pathname}`);
  } catch {
    return normalizeEntityKey(url);
  }
}
