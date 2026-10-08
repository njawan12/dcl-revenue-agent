import test from 'node:test';
import assert from 'node:assert/strict';
import { qualifyDiscoveredAccount, suggestBuyerRole } from '../lib/discovery/qualification.js';

const account = { domain:'brand.com', country:'US', industry:'beauty', employeeCount:120, evidence:{ shopifyConfidence:0.88, technologies:['klaviyo'] } };

test('qualifies a non-job Shopify brand from storefront need and emits a scoring receipt', () => {
  const result = qualifyDiscoveredAccount(account, [
    { accountDomain:'brand.com', type:'account_fit', title:'Shopify storefront verified', confidence:0.88, evidence:{}, fingerprint:'fit-1', observedAt:'2026-10-08T10:00:00Z' },
    { accountDomain:'brand.com', type:'storefront', title:'No sticky add-to-cart marker detected', confidence:0.55, evidence:{ id:'no_sticky_atc_marker', severity:0.7 }, fingerprint:'store-1', observedAt:'2026-10-08T10:05:00Z' },
    { accountDomain:'brand.com', type:'storefront', title:'High script-tag count detected', confidence:0.7, evidence:{ id:'high_script_count', severity:0.7 }, fingerprint:'store-2', observedAt:'2026-10-08T10:06:00Z' },
    { accountDomain:'brand.com', type:'storefront', title:'Reviews not detected', confidence:0.45, evidence:{ id:'reviews_not_detected', severity:0.6 }, fingerprint:'store-3', observedAt:'2026-10-08T10:07:00Z' },
  ]);
  assert.ok(result.scores.fit >= 80);
  assert.ok(result.scores.need > 20);
  assert.equal(result.inputs.intent.activeHiringSignal, false);
  assert.notEqual(result.tier, 'reject');
  assert.equal(result.scoringReceipt.scoringContractVersion, 'opportunity-v1');
  assert.equal(result.scoringReceipt.scores.opportunity, result.scores.opportunity);
  assert.ok(result.scoringReceipt.evidenceRefs.some((ref) => ref.id === 'store-1'));
  assert.ok(result.scoringReceipt.configSnapshot.thresholds);
});

test('active hiring adds intent without pretending the posting is newly published', () => {
  const result = qualifyDiscoveredAccount(account, [{ accountDomain:'brand.com', type:'job', title:'Senior Shopify Developer', confidence:0.95, evidence:{}, fingerprint:'job-1' }]);
  assert.equal(result.inputs.intent.jobPostedDaysAgo, null);
  assert.equal(result.inputs.intent.activeHiringSignal, true);
  assert.ok(result.scores.intent >= 14);
  assert.equal(result.motion, 'extend-internal-team');
});

test('buyer-role selection follows the actual problem type', () => {
  assert.equal(suggestBuyerRole({ signals:[{ type:'job', title:'Senior Shopify Developer' }], need:{ retention:0 } }), 'VP/Head of Ecommerce or Digital');
  assert.equal(suggestBuyerRole({ signals:[{ type:'job', title:'Lifecycle Marketing Manager' }], need:{ retention:0.8 } }), 'Head of Retention / Lifecycle');
});
