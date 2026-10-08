import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(new URL('../supabase/migrations/018_outreach_policy_receipts.sql', import.meta.url), 'utf8');

test('approval is bound to outreach-policy-v1 eligibility', () => {
  assert.match(migration, /contractVersion' = 'outreach-policy-v1'/);
  assert.match(migration, /decision' = 'eligible_for_human_review'/);
  assert.match(migration, /p_decision = 'approved' and not validate_outreach_policy_receipt/);
});

test('database independently checks critical conservative inputs', () => {
  assert.match(migration, /professionalEmailVerified/);
  assert.match(migration, /policyBasisStatus' = 'verified'/);
  assert.match(migration, /sourceProvenanceReady/);
  assert.match(migration, /purposePresent/);
  assert.match(migration, /suppressed/);
});

test('blocked or legacy drafts remain rejectable', () => {
  assert.match(migration, /Rejection is always allowed/);
  assert.match(migration, /if p_decision = 'approved'/);
  assert.match(migration, /else\s+update outreach set status='paused'/s);
});

test('policy receipt does not introduce a send operation', () => {
  assert.doesNotMatch(migration, /provider_message_id\s*=/i);
  assert.doesNotMatch(migration, /status\s*=\s*'sent'/i);
  assert.doesNotMatch(migration, /send_outreach/i);
});
