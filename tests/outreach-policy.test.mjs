import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOutreachPolicy, policyAllowsHeldOutbox, OUTREACH_POLICY_VERSION } from '../lib/outreach/policy.js';

const ready = {
  region: 'US',
  suppressed: false,
  professionalEmailVerified: true,
  policyBasisStatus: 'verified',
  purpose: 'B2B commerce revenue intelligence and operator-approved outreach',
  sourceProvenanceReady: true,
};

test('eligible means human review only, never send permission', () => {
  const receipt = evaluateOutreachPolicy(ready);
  assert.equal(receipt.contractVersion, OUTREACH_POLICY_VERSION);
  assert.equal(receipt.decision, 'eligible_for_human_review');
  assert.equal(policyAllowsHeldOutbox(receipt), true);
  assert.notEqual(receipt.decision, 'send');
});

test('unknown jurisdiction denies by default', () => {
  const receipt = evaluateOutreachPolicy({ ...ready, region: 'ZZ' });
  assert.equal(receipt.decision, 'blocked');
  assert.ok(receipt.reasons.includes('jurisdiction_policy_unconfigured'));
});

test('configured jurisdiction still blocks without verified workspace policy basis', () => {
  const receipt = evaluateOutreachPolicy({ ...ready, region: 'CA', policyBasisStatus: 'unknown' });
  assert.equal(receipt.decision, 'blocked');
  assert.ok(receipt.reasons.includes('policy_basis_unverified'));
});

test('suppression and verified professional email remain hard gates', () => {
  const suppressed = evaluateOutreachPolicy({ ...ready, suppressed: true });
  const unverified = evaluateOutreachPolicy({ ...ready, professionalEmailVerified: false });
  assert.ok(suppressed.reasons.includes('suppressed'));
  assert.ok(unverified.reasons.includes('professional_email_unverified'));
  assert.equal(policyAllowsHeldOutbox(suppressed), false);
  assert.equal(policyAllowsHeldOutbox(unverified), false);
});

test('purpose and source provenance are required', () => {
  const receipt = evaluateOutreachPolicy({ ...ready, purpose: '', sourceProvenanceReady: false });
  assert.deepEqual(receipt.reasons, ['purpose_missing', 'source_provenance_unverified']);
});
