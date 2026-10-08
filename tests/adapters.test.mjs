import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeverSource } from '../lib/discovery/adapters/lever.js';
import { createGreenhouseSource } from '../lib/discovery/adapters/greenhouse.js';
import { createStorefrontSource } from '../lib/discovery/adapters/storefront.js';
import { runDiscoverySources } from '../lib/discovery/sources.js';

function jsonResponse(payload, url = 'https://example.test') {
  return { ok: true, status: 200, url, headers: { get: () => 'application/json' }, async json() { return payload; } };
}

test('Lever adapter emits only relevant ecommerce hiring signals', async () => {
  const fetchImpl = async () => jsonResponse([
    { id: '1', text: 'Senior Shopify Developer', hostedUrl: 'https://jobs.lever.co/acme/1', categories: { team: 'Ecommerce' } },
    { id: '2', text: 'Office Manager', hostedUrl: 'https://jobs.lever.co/acme/2', categories: { team: 'People' } },
  ]);
  const source = createLeverSource({ site: 'acme', accountDomain: 'acme.com', fetchImpl });
  const result = await source.discover();
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].title, 'Senior Shopify Developer');
});

test('Greenhouse adapter emits relevant ecommerce hiring signals', async () => {
  const fetchImpl = async () => jsonResponse({ jobs: [
    { id: 10, title: 'Director of Ecommerce', absolute_url: 'https://boards.greenhouse.io/acme/jobs/10', location: { name: 'Remote' } },
    { id: 11, title: 'Accountant', absolute_url: 'https://boards.greenhouse.io/acme/jobs/11', location: { name: 'NYC' } },
  ]});
  const source = createGreenhouseSource({ boardToken: 'acme', accountDomain: 'acme.com', fetchImpl });
  const result = await source.discover();
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].evidence.provider, 'greenhouse');
});

test('storefront adapter qualifies a Shopify brand without any job posting', async () => {
  const html = `<html><script src="https://cdn.shopify.com/s/files/1/theme.js"></script><body class="shopify-section"><script>window.Shopify={theme:{}}</script><form action="/cart/add">Add to cart</form><script src="https://static.klaviyo.com/a.js"></script></body></html>`;
  const bytes = new TextEncoder().encode(html);
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    url: 'https://brand.com/',
    headers: { get: (name) => name === 'content-type' ? 'text/html' : null },
    body: { getReader() { let sent = false; return { async read() { if (sent) return { done: true }; sent = true; return { done: false, value: bytes }; }, async cancel() {} }; } },
  });
  const source = createStorefrontSource({ candidates: [{ domain: 'brand.com', name: 'Brand', industry: 'beauty', country: 'US' }], fetchImpl });
  const result = await runDiscoverySources([source]);
  assert.equal(result.accounts.length, 1);
  assert.equal(result.accounts[0].domain, 'brand.com');
  assert.ok(result.signals.some((signal) => signal.type === 'account_fit'));
  assert.ok(result.signals.some((signal) => signal.type === 'technology' && /klaviyo/i.test(signal.title)));
  assert.ok(result.signals.every((signal) => signal.type !== 'job'));
});
