import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeDomain, registrableDomain, sameAccountDomain } from '../lib/discovery/domain.js';
import { detectShopify, detectKnownCommerceApps } from '../lib/discovery/shopify.js';
import { inspectStorefrontHtml, storefrontNeedVector } from '../lib/discovery/storefront.js';
import { assertPublicHttpUrl } from '../lib/discovery/http.js';
import { dedupeAccounts } from '../lib/discovery/accounts.js';
import { defineDiscoverySource, runDiscoverySources } from '../lib/discovery/sources.js';

const shopifyHtml = `
<html><head><script src="https://cdn.shopify.com/s/files/1/theme.js"></script></head>
<body class="shopify-section"><script>window.Shopify = {theme:{name:'x'}}</script>
<form action="/cart/add"><button>Add to cart</button></form>
<script src="https://static.klaviyo.com/onsite/js.js"></script>
</body></html>`;

test('canonicalizes URLs and collapses subdomains to account domain', () => {
  assert.equal(canonicalizeDomain('https://www.Shop.Example.com/products/x'), 'shop.example.com');
  assert.equal(registrableDomain('shop.example.com'), 'example.com');
  assert.equal(sameAccountDomain('www.example.com', 'shop.example.com'), true);
});

test('blocks private/local crawl targets', () => {
  assert.throws(() => assertPublicHttpUrl('http://127.0.0.1/admin'), /private_host_blocked/);
  assert.throws(() => assertPublicHttpUrl('http://localhost:3000'), /private_host_blocked/);
  assert.equal(assertPublicHttpUrl('https://example.com').hostname, 'example.com');
});

test('detects Shopify and known commerce technology from public HTML evidence', () => {
  const result = detectShopify(shopifyHtml);
  assert.equal(result.isShopify, true);
  assert.ok(result.confidence >= 0.35);
  assert.deepEqual(detectKnownCommerceApps(shopifyHtml), ['klaviyo']);
});

test('storefront inspection produces cautious evidence rather than declaring facts', () => {
  const report = inspectStorefrontHtml(shopifyHtml, { url: 'https://example.com/products/test' });
  assert.equal(report.shopify.isShopify, true);
  assert.equal(report.traits.hasProductForm, true);
  assert.ok(report.findings.some((finding) => finding.id === 'no_sticky_atc_marker'));
  assert.ok(report.findings.every((finding) => finding.confidence <= 0.7));
  const vector = storefrontNeedVector(report);
  assert.ok(vector.cro > 0);
  assert.ok(vector.pdp > 0);
});

test('dedupes account candidates by registrable domain', () => {
  const result = dedupeAccounts([
    { domain: 'www.example.com', name: 'Example', sourceName: 'a' },
    { url: 'https://shop.example.com', industry: 'beauty', sourceName: 'b' },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].domain, 'example.com');
  assert.equal(result[0].industry, 'beauty');
});

test('runs multiple source families and contains source failures', async () => {
  const good = defineDiscoverySource({
    name: 'store-source',
    async discover() {
      return {
        accounts: [{ domain: 'brand.com', name: 'Brand' }],
        signals: [{ accountDomain: 'brand.com', type: 'storefront', title: 'PDP opportunity', sourceUrl: 'https://brand.com/products/x' }],
      };
    },
  });
  const duplicate = defineDiscoverySource({
    name: 'job-source',
    async discover() {
      return { accounts: [{ domain: 'www.brand.com', name: 'Brand Inc' }], signals: [] };
    },
  });
  const broken = defineDiscoverySource({ name: 'broken-source', async discover() { throw new Error('provider_down'); } });
  const result = await runDiscoverySources([good, duplicate, broken]);
  assert.equal(result.accounts.length, 1);
  assert.equal(result.signals.length, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].source, 'broken-source');
});
