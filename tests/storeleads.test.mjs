import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoreLeadsShopifySource } from '../lib/discovery/adapters/storeleads.js';

test('Store Leads source requests Shopify stores in target countries', async () => {
  let requested;
  const fetchImpl = async (url, options) => {
    requested = { url: new URL(url), options };
    return {
      ok: true,
      status: 200,
      async json() {
        return { domains: [
          { name: 'www.brand-a.com', country_code: 'US', platform: 'shopify', technologies: [{ name: 'Klaviyo' }] },
          { name: 'brand-b.ca', country_code: 'CA', platform: 'shopify', technologies: [] },
        ] };
      },
    };
  };
  const source = createStoreLeadsShopifySource({ apiKey: 'secret', fetchImpl, countries: ['US','CA'], pageSize: 25 });
  const result = await source.discover();
  assert.equal(requested.url.searchParams.get('f:p'), 'shopify');
  assert.equal(requested.url.searchParams.get('f:cc'), 'US,CA');
  assert.equal(requested.url.searchParams.get('page_size'), '25');
  assert.equal(requested.options.headers.authorization, 'Bearer secret');
  assert.equal(result.accounts.length, 2);
  assert.equal(result.accounts[0].domain, 'brand-a.com');
  assert.deepEqual(result.accounts[0].evidence.technologies, ['Klaviyo']);
  assert.ok(result.signals.every((signal) => signal.evidence.independentlyVerified === false));
});
