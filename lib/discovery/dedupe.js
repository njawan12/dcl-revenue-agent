export function dedupeSignals(signals) {
  const seen = new Set();
  const out = [];
  for (const signal of signals) {
    const key = signal.fingerprint;
    if (!seen.has(key)) { seen.add(key); out.push(signal); }
  }
  return out;
}
