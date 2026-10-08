import test from 'node:test';
import assert from 'node:assert/strict';
import { qualifyDiscoveredAccount } from '../lib/discovery/qualification.js';
import { normalizeWorkspaceConfig } from '../lib/workspaces/config.js';

const account = {
  domain: 'brand.com',
  country: 'US',
  industry: 'beauty',
  employeeCount: 120,
  evidence: { shopifyConfidence: 0.9, technologies: ['klaviyo'] },
};

const signals = [
  { accountDomain: 'brand.com', type: 'technology', title: 'Klaviyo detected', confidence: 0.9, evidence: { technology: 'klaviyo' } },
  { accountDomain: 'brand.com', type: 'storefront', title: 'No sticky add-to-cart marker detected', confidence: 0.6, evidence: { id: 'no_sticky_atc_marker', severity: 0.5 } },
  { accountDomain: 'brand.com', type: 'storefront', title: 'Retention opportunity detected', confidence: 0.75, evidence: { id: 'retention_opportunity', needCategory: 'retention', severity: 0.7 } },
];

test('same commerce account can rank differently for different agency workspaces', () => {
  const dcl = qualifyDiscoveredAccount(account, signals, normalizeWorkspaceConfig({ workspaceId: '11111111-1111-4111-8111-111111111111' }));
  const retentionAgency = qualifyDiscoveredAccount(account, signals, normalizeWorkspaceConfig({
    workspaceId: '22222222-2222-4222-8222-222222222222',
    needWeights: { cro: 0, mobileUx: 0, performance: 0, pdp: 0, subscription: 0, analytics: 0, qa: 0, retention: 100 },
    buyerRoleRules: { retention: 'VP Lifecycle Marketing', default: 'VP Marketing' },
  }));

  assert.notEqual(dcl.workspaceId, retentionAgency.workspaceId);
  assert.ok(retentionAgency.scores.need > dcl.scores.need);
  assert.equal(retentionAgency.suggestedBuyerRole, 'VP Lifecycle Marketing');
});

test('workspace normalization preserves tenant-specific geography and industries', () => {
  const config = normalizeWorkspaceConfig({
    workspaceId: '33333333-3333-4333-8333-333333333333',
    target_countries: ['GB'],
    target_industries: ['luxury'],
  });
  assert.deepEqual(config.targetCountries, ['GB']);
  assert.deepEqual(config.targetIndustries, ['luxury']);
  assert.deepEqual(config.scoring.targetCountries, ['GB']);
});
