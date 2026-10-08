import { registrableDomain } from './domain.js';

/** Provider contracts. Real adapters plug into these shapes. */
export const SignalType = Object.freeze({
  JOB: 'job', LEADERSHIP: 'leadership', STOREFRONT: 'storefront', TECH: 'technology', GROWTH: 'growth', ACCOUNT_FIT: 'account_fit'
});

export function normalizeSignal(raw) {
  if (!raw?.accountDomain || !raw?.type || !raw?.title || !raw?.sourceUrl) throw new Error('invalid_signal');
  const accountDomain = registrableDomain(raw.accountDomain);
  const title = raw.title.trim();
  return {
    accountDomain,
    type: raw.type,
    title,
    sourceUrl: raw.sourceUrl,
    sourceName: raw.sourceName ?? 'unknown',
    observedAt: raw.observedAt ?? new Date().toISOString(),
    confidence: Math.max(0, Math.min(1, raw.confidence ?? 0.5)),
    evidence: raw.evidence ?? {},
    fingerprint: raw.fingerprint ?? `${accountDomain}|${raw.type}|${title}`.toLowerCase(),
  };
}
