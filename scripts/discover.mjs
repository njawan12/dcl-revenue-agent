import { createBuiltWithShopifySource } from '../lib/discovery/adapters/builtwith.js';
import { createStorefrontSource } from '../lib/discovery/adapters/storefront.js';
import { runDiscoverySources } from '../lib/discovery/sources.js';

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

const output = {
  generatedAt: new Date().toISOString(),
  requestedLimit: limit,
  candidateCount: candidates.accounts.length,
  verifiedShopifyCount: verified.accounts.length,
  candidateErrors: candidates.errors,
  verificationErrors: verified.errors,
  accounts: verified.accounts,
  signals: verified.signals,
};

console.log(JSON.stringify(output, null, 2));
