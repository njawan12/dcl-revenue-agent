import { canonicalizeDomain, registrableDomain } from './domain.js';

export function normalizeAccountCandidate(raw) {
  if (!raw?.domain && !raw?.url) throw new Error('account_domain_required');
  const domain = registrableDomain(raw.domain ?? raw.url);
  return {
    domain,
    name: raw.name?.trim() || domain,
    websiteUrl: raw.url ? new URL(/^https?:\/\//.test(raw.url) ? raw.url : `https://${raw.url}`).toString() : `https://${canonicalizeDomain(domain)}/`,
    country: raw.country ?? null,
    industry: raw.industry ?? null,
    employeeCount: raw.employeeCount ?? null,
    sourceName: raw.sourceName ?? 'unknown',
    sourceUrl: raw.sourceUrl ?? raw.url ?? `https://${domain}`,
    discoveredAt: raw.discoveredAt ?? new Date().toISOString(),
    evidence: raw.evidence ?? {},
  };
}

export function dedupeAccounts(accounts) {
  const byDomain = new Map();
  for (const item of accounts) {
    const account = normalizeAccountCandidate(item);
    const existing = byDomain.get(account.domain);
    if (!existing) {
      byDomain.set(account.domain, account);
      continue;
    }
    byDomain.set(account.domain, {
      ...existing,
      ...Object.fromEntries(Object.entries(account).filter(([, value]) => value !== null && value !== undefined && value !== '')),
      evidence: { ...(existing.evidence ?? {}), ...(account.evidence ?? {}) },
      sourceName: existing.sourceName === account.sourceName ? existing.sourceName : `${existing.sourceName},${account.sourceName}`,
    });
  }
  return [...byDomain.values()];
}
