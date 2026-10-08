/** Provider contracts. Real adapters plug into these shapes. */
export const SignalType = Object.freeze({
  JOB: 'job', LEADERSHIP: 'leadership', STOREFRONT: 'storefront', TECH: 'technology', GROWTH: 'growth', ACCOUNT_FIT: 'account_fit'
});

export function normalizeSignal(raw) {
  if (!raw?.accountDomain || !raw?.type || !raw?.title || !raw?.sourceUrl) throw new Error('invalid_signal');
  return {
    accountDomain: raw.accountDomain.toLowerCase().replace(/^www\./,''),
    type: raw.type,
    title: raw.title.trim(),
    sourceUrl: raw.sourceUrl,
    sourceName: raw.sourceName ?? 'unknown',
    observedAt: raw.observedAt ?? new Date().toISOString(),
    confidence: Math.max(0, Math.min(1, raw.confidence ?? 0.5)),
    evidence: raw.evidence ?? {},
    fingerprint: raw.fingerprint ?? `${raw.accountDomain}|${raw.type}|${raw.title}`.toLowerCase(),
  };
}
