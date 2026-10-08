/**
 * Try enrichment providers in sequence. A provider must return
 * { email, verified, confidence, source } or null.
 */
export async function findVerifiedEmail(person, providers, { minConfidence = 0.9 } = {}) {
  const attempts = [];
  for (const provider of providers) {
    try {
      const result = await provider.findEmail(person);
      attempts.push({ provider: provider.name, found: Boolean(result?.email), verified: Boolean(result?.verified) });
      if (result?.email && result.verified && (result.confidence ?? 0) >= minConfidence) {
        return { result, attempts };
      }
    } catch (error) {
      attempts.push({ provider: provider.name, error: error instanceof Error ? error.message : 'provider_error' });
    }
  }
  return { result: null, attempts };
}
