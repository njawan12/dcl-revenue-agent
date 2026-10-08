import { createBuiltWithShopifySource } from '../lib/discovery/adapters/builtwith.js';
import { createStorefrontSource } from '../lib/discovery/adapters/storefront.js';
import { runDiscoverySources } from '../lib/discovery/sources.js';
import { createServiceSupabaseClient } from '../lib/db/client.js';
import { persistDiscoveryRun } from '../lib/db/discovery.js';

const apiKey = process.env.BUILTWITH_API_KEY;
if (!apiKey) {
  console.error('BUILTWITH_API_KEY is required for live discovery.');
  process.exit(1);
}

const limit = Math.max(1, Math.min(100, Number(process.env.DISCOVERY_LIMIT ?? 25)));
const since = process.env.DISCOVERY_SINCE || undefined;
const otherTechs = (process.env.DISCOVERY_OTHER_TECHS ?? '').split(',').map((x) => x.trim()).filter(Boolean);

const candidateSource = createBuiltWithShopifySource({ apiKey, limit, since, otherTechs });
const candidates = await runDiscoverySources([candidateSource], { failFast: true });
const storefrontSource = createStorefrontSource({ candidates: candidates.accounts });
const verified = await runDiscoverySources([storefrontSource]);

let persistence = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const client = createServiceSupabaseClient();
  persistence = await persistDiscoveryRun(client, {
    sourceNames: [candidateSource.name, storefrontSource.name],
    accounts: verified.accounts,
    signals: [...candidates.signals, ...verified.signals],
    errors: [...candidates.errors, ...verified.errors],
    metadata: { limit, since: since ?? null, otherTechs, candidateCount: candidates.accounts.length },
  });
}

const output = {
  generatedAt: new Date().toISOString(),
  requestedLimit: limit,
  candidateCount: candidates.accounts.length,
  verifiedShopifyCount: verified.accounts.length,
  candidateErrors: candidates.errors,
  verificationErrors: verified.errors,
  persistence,
  accounts: verified.accounts,
  signals: verified.signals,
};

console.log(JSON.stringify(output, null, 2));
