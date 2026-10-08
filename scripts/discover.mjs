import { createBuiltWithShopifySource } from '../lib/discovery/adapters/builtwith.js';
import { createStoreLeadsShopifySource } from '../lib/discovery/adapters/storeleads.js';
import { createStorefrontSource } from '../lib/discovery/adapters/storefront.js';
import { runDiscoverySources } from '../lib/discovery/sources.js';
import { qualifyDiscoveredAccount } from '../lib/discovery/qualification.js';
import { createServiceSupabaseClient } from '../lib/db/client.js';
import { persistDiscoveryRun } from '../lib/db/discovery.js';

const limit = Math.max(1, Math.min(100, Number(process.env.DISCOVERY_LIMIT ?? 25)));
const since = process.env.DISCOVERY_SINCE || undefined;
const otherTechs = (process.env.DISCOVERY_OTHER_TECHS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const countries = (process.env.DISCOVERY_COUNTRIES ?? 'US,CA').split(',').map((x) => x.trim()).filter(Boolean);

let candidateSource;
if (process.env.STORELEADS_API_KEY) {
  candidateSource = createStoreLeadsShopifySource({ apiKey: process.env.STORELEADS_API_KEY, pageSize: Math.min(limit, 50), countries });
} else if (process.env.BUILTWITH_API_KEY) {
  candidateSource = createBuiltWithShopifySource({ apiKey: process.env.BUILTWITH_API_KEY, limit, since, otherTechs });
} else {
  console.error('STORELEADS_API_KEY or BUILTWITH_API_KEY is required for live discovery.');
  process.exit(1);
}

const candidates = await runDiscoverySources([candidateSource], { failFast: true });
const storefrontSource = createStorefrontSource({ candidates: candidates.accounts.slice(0, limit) });
const verified = await runDiscoverySources([storefrontSource]);
const allSignals = [...candidates.signals, ...verified.signals];
const qualifications = verified.accounts.map((account) => qualifyDiscoveredAccount(account, allSignals));

let persistence = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const client = createServiceSupabaseClient();
  persistence = await persistDiscoveryRun(client, {
    sourceNames: [candidateSource.name, storefrontSource.name],
    accounts: verified.accounts,
    signals: allSignals,
    qualifications,
    errors: [...candidates.errors, ...verified.errors],
    metadata: { limit, since: since ?? null, otherTechs, countries, candidateCount: candidates.accounts.length },
  });
}

const output = {
  generatedAt: new Date().toISOString(),
  provider: candidateSource.name,
  requestedLimit: limit,
  candidateCount: candidates.accounts.length,
  verifiedShopifyCount: verified.accounts.length,
  qualifiedCount: qualifications.filter((item) => ['qualified','priority'].includes(item.tier)).length,
  candidateErrors: candidates.errors,
  verificationErrors: verified.errors,
  persistence,
  accounts: verified.accounts,
  qualifications,
  signals: verified.signals,
};

console.log(JSON.stringify(output, null, 2));
