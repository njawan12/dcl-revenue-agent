import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreFit, scoreNeed, scoreIntent, scoreOpportunity, qualifyOpportunity, chooseMotion } from '../lib/scoring.js';

test('high-fit Shopify Plus DTC brand scores strongly', () => {
  const fit = scoreFit({ shopify: true, shopifyPlus: true, country: 'US', dtc: true, employeeCount: 140, industry: 'beauty', estimatedAgencyCapacity: true });
  assert.equal(fit, 100);
});

test('strong need + fresh hiring intent creates priority opportunity', () => {
  const fit = 92;
  const need = scoreNeed({ cro: 1, performance: .8, mobileUx: .9, pdp: .9, subscription: .6, analytics: .7, retention: .4, qa: .4 });
  const intent = scoreIntent({ jobPostedDaysAgo: 2, newEcommerceLeaderDaysAgo: 45, multipleEcommerceHires: true, majorLaunchSignal: true });
  const opportunity = scoreOpportunity({ fit, need, intent, evidenceConfidence: .98 });
  const q = qualifyOpportunity({ fit, need, intent, opportunity });
  assert.ok(need >= 70);
  assert.ok(intent >= 65);
  assert.ok(opportunity >= 80);
  assert.ok(['priority', 'qualified'].includes(q.tier));
});

test('great-fit company with no current reason to contact is nurtured', () => {
  const q = qualifyOpportunity({ fit: 90, need: 20, intent: 15, opportunity: 49 });
  assert.equal(q.tier, 'nurture');
});

test('motion selection prefers bridge while hiring for stale open roles', () => {
  assert.equal(chooseMotion({ hiringSignal: true, longOpenRole: true }), 'bridge-while-hiring');
});
