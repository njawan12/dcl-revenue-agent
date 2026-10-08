import { normalizeAccountCandidate, dedupeAccounts } from './accounts.js';
import { normalizeSignal } from './contracts.js';
import { dedupeSignals } from './dedupe.js';

export function defineDiscoverySource(source) {
  if (!source?.name || typeof source.discover !== 'function') throw new Error('invalid_discovery_source');
  return source;
}

export async function runDiscoverySources(sources, context = {}) {
  const accounts = [];
  const signals = [];
  const errors = [];

  for (const source of sources) {
    try {
      const result = await source.discover(context);
      for (const account of result?.accounts ?? []) {
        accounts.push(normalizeAccountCandidate({ ...account, sourceName: account.sourceName ?? source.name }));
      }
      for (const signal of result?.signals ?? []) {
        signals.push(normalizeSignal({ ...signal, sourceName: signal.sourceName ?? source.name }));
      }
    } catch (error) {
      errors.push({ source: source.name, error: error instanceof Error ? error.message : String(error) });
      if (context.failFast) throw error;
    }
  }

  return {
    accounts: dedupeAccounts(accounts),
    signals: dedupeSignals(signals),
    errors,
    sourceCount: sources.length,
  };
}
