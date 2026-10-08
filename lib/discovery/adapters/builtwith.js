import { defineDiscoverySource } from '../sources.js';
import { registrableDomain } from '../domain.js';

function looksLikeDomain(value) {
  return typeof value === 'string' && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value.trim()) && !value.includes(' ');
}

export function extractDomainsFromBuiltWith(payload) {
  const out = new Set();
  const preferredKeys = new Set(['D','Domain','domain','RootDomain','rootDomain','Website','website','Host','host']);
  function visit(node, depth = 0) {
    if (depth > 8 || node == null) return;
    if (Array.isArray(node)) return node.forEach((item) => visit(item, depth + 1));
    if (typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (preferredKeys.has(key) && looksLikeDomain(value)) {
        try { out.add(registrableDomain(value)); } catch {}
      }
      if (typeof value === 'object') visit(value, depth + 1);
    }
  }
  visit(payload);
  return [...out];
}

export function createBuiltWithShopifySource({ apiKey, fetchImpl = fetch, since, otherTechs = [], meta = true, limit } = {}) {
  if (!apiKey) throw new Error('builtwith_api_key_required');
  return defineDiscoverySource({
    name: 'builtwith:shopify-list',
    async discover() {
      const url = new URL('https://api.builtwith.com/lists13/api.json');
      url.searchParams.set('KEY', apiKey);
      url.searchParams.set('TECH', 'Shopify');
      if (otherTechs.length) url.searchParams.set('OTHERTECHS', otherTechs.join(','));
      if (since) url.searchParams.set('SINCE', since);
      if (meta) url.searchParams.set('META', 'yes');
      const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`builtwith_http_${response.status}`);
      const payload = await response.json();
      const domains = extractDomainsFromBuiltWith(payload).slice(0, limit ?? Infinity);
      return {
        accounts: domains.map((domain) => ({
          domain,
          name: domain,
          sourceUrl: 'https://api.builtwith.com/lists-api',
          evidence: { provider: 'builtwith', technology: 'Shopify', since: since ?? null, otherTechs },
        })),
        signals: domains.map((domain) => ({
          accountDomain: domain,
          type: 'account_fit',
          title: 'Shopify technology list match',
          sourceUrl: 'https://api.builtwith.com/lists-api',
          confidence: 0.8,
          fingerprint: `${domain}|builtwith|shopify`,
          evidence: { provider: 'builtwith', technology: 'Shopify', independentlyVerified: false },
        })),
      };
    },
  });
}
