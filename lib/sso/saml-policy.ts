/** Pure SAML helpers — safe to unit test without DB/config. */

export function emailAllowedForDomains(email: string, domains: string[]): boolean {
  if (!domains.length) return true;
  const host = email.split('@')[1]?.toLowerCase() ?? '';
  return domains.some((d) => d.toLowerCase() === host);
}

/**
 * Demo-mode assertion parser — trusts fixture payload when SAML_DEMO_MODE=1.
 * Production path extracts NameID / email from XML-ish payloads.
 */
export function parseSamlAssertion(opts: {
  raw: string;
  demoMode: boolean;
}): { email: string; nameId: string } {
  if (opts.demoMode) {
    try {
      const json = JSON.parse(opts.raw) as { email?: string; nameId?: string };
      const email = json.email?.toLowerCase().trim();
      if (!email || !email.includes('@')) throw new Error('invalid demo assertion');
      return { email, nameId: json.nameId ?? email };
    } catch {
      throw new Error('Invalid demo SAML assertion');
    }
  }

  const nameId =
    opts.raw.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/i)?.[1] ??
    opts.raw.match(/<NameID[^>]*>([^<]+)<\/NameID>/i)?.[1];
  const emailAttr =
    opts.raw.match(/emailaddress[^>]*>([^<]+)/i)?.[1] ??
    opts.raw.match(/["']email["']\s*:\s*["']([^"']+)/i)?.[1];
  const email = (emailAttr ?? nameId ?? '').toLowerCase().trim();
  if (!email.includes('@')) throw new Error('SAML assertion missing email');
  return { email, nameId: nameId ?? email };
}
