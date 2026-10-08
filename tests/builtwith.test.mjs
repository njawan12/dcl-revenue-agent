import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuiltWithShopifySource, extractDomainsFromBuiltWith } from '../lib/discovery/adapters/builtwith.js';

test('extracts domains from tolerant BuiltWith-like payload shapes', () => {
  const payload = { Results: [{ D: 'www.brand-a.com' }, { Domain: 'shop.brand-b.co.uk' }, { nested: { website: 'brand-c.com' } }] };
  assert.deepEqual(extractDomainsFromBuiltWith(payload).sort(), ['brand-a.com','brand-b.co.uk','brand-c.com']);
});

test('BuiltWith source emits unverified Shopify candidate signals for later storefront verification', async () => {
  let requested;
  const fetchImpl = async (url) => {
    requested = new URL(url);
    return { ok: true, status: 200, async json() { return { Results: [{ D: 'brand-a.com' }, { D: 'brand-b.com' }] }; } };
  };
  const source = createBuiltWithShopifySource({ apiKey: 'test-key', fetchImpl, since: '30 Days Ago', otherTechs: ['Klaviyo'], limit: 1 });
  const result = await source.discover();
  assert.equal(requested.searchParams.get('TECH'), 'Shopify');
  assert.equal(requested.searchParams.get('OTHERTECHS'), 'Klaviyo');
  assert.equal(result.accounts.length, 1);
  assert.equal(result.signals[0].evidence.independentlyVerified, false);
});
