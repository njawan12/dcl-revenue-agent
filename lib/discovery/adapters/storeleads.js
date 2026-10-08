import { defineDiscoverySource } from '../sources.js';
import { registrableDomain } from '../domain.js';

function parseDomain(record) {
  const value = record?.name ?? record?.domain ?? record?.url;
  if (!value) return null;
  try { return registrableDomain(value); } catch { return null; }
}

export function createStoreLeadsShopifySource({ apiKey, fetchImpl = fetch, countries = ['US','CA'], pageSize = 50, filters = {} } = {}) {
  if (!apiKey) throw new Error('storeleads_api_key_required');
  const size = Math.max(1, Math.min(50, Number(pageSize || 50)));
  return defineDiscoverySource({
    name: 'storeleads:shopify-domains',
    async discover() {
      const url = new URL('https://storeleads.app/json/api/v1/all/domain');
      url.searchParams.set('f:p', 'shopify');
      if (countries.length) url.searchParams.set('f:cc', countries.join(','));
      url.searchParams.set('page_size', String(size));
      for (const [key, value] of Object.entries(filters)) {
        if (value == null || value === '') continue;
        url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
      }
      const response = await fetchImpl(url, {
        headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`storeleads_http_${response.status}`);
      const payload = await response.json();
      const records = Array.isArray(payload?.domains) ? payload.domains : [];
      const accounts = records.map((record) => {
        const domain = parseDomain(record);
        if (!domain) return null;
        const technologies = Array.isArray(record.technologies) ? record.technologies.map((t) => t?.name ?? t).filter(Boolean) : [];
        return {
          domain,
          name: record.title || record.company_name || domain,
          country: record.country_code || record.country || null,
          industry: null,
          sourceUrl: `https://storeleads.app/reports/domain/${domain}`,
          evidence: {
            provider: 'storeleads',
            platform: record.platform || 'shopify',
            technologies,
            estimatedSales: record.estimated_sales ?? record.estimatedSales ?? null,
            productCount: record.product_count ?? null,
            rank: record.rank ?? null,
          },
        };
      }).filter(Boolean);
      return {
        accounts,
        signals: accounts.map((account) => ({
          accountDomain: account.domain,
          type: 'account_fit',
          title: 'Shopify store candidate from ecommerce dataset',
          sourceUrl: account.sourceUrl,
          confidence: 0.85,
          fingerprint: `${account.domain}|storeleads|shopify`,
          evidence: { provider: 'storeleads', independentlyVerified: false, technologies: account.evidence.technologies },
        })),
        cursor: payload?.next_cursor ?? null,
      };
    },
  });
}
