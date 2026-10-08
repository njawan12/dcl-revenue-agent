import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCrmAdapter, buildCrmSyncCommand, classifyCrmConflict, CRM_CONTRACT_VERSION } from '../lib/crm/contract.js';

test('CRM commands are deterministic, workspace-scoped and revision-bound', () => {
  const base = { workspaceId: 'workspace-a', provider: 'hubspot', objectType: 'opportunity', localId: 'opp-1', revision: 3 };
  const a = buildCrmSyncCommand({ ...base, fields: { stage: 'proposal', value: 12000 } });
  const b = buildCrmSyncCommand({ ...base, fields: { value: 12000, stage: 'proposal' } });
  const otherWorkspace = buildCrmSyncCommand({ ...base, workspaceId: 'workspace-b', fields: { stage: 'proposal', value: 12000 } });
  const nextRevision = buildCrmSyncCommand({ ...base, revision: 4, fields: { stage: 'proposal', value: 12000 } });

  assert.equal(a.contractVersion, CRM_CONTRACT_VERSION);
  assert.equal(a.idempotencyKey, b.idempotencyKey);
  assert.notEqual(a.idempotencyKey, otherWorkspace.idempotencyKey);
  assert.notEqual(a.idempotencyKey, nextRevision.idempotencyKey);
});

test('CRM contract refuses unsupported providers and object types', () => {
  assert.throws(() => buildCrmSyncCommand({ workspaceId: 'w', provider: 'unknown', objectType: 'account', localId: 'a', revision: 1 }), /unsupported_crm_provider/);
  assert.throws(() => buildCrmSyncCommand({ workspaceId: 'w', provider: 'hubspot', objectType: 'email_send', localId: 'a', revision: 1 }), /unsupported_crm_object_type/);
});

test('two-sided changes are held for review rather than overwritten', () => {
  assert.deepEqual(classifyCrmConflict({ localRevision: 4, lastSyncedRevision: 3, remoteChangedSinceSync: true }), {
    state: 'conflict', automaticWriteAllowed: false, reason: 'both_sides_changed',
  });
  assert.equal(classifyCrmConflict({ localRevision: 4, lastSyncedRevision: 3 }).automaticWriteAllowed, true);
  assert.equal(classifyCrmConflict({ localRevision: 3, lastSyncedRevision: 3 }).state, 'current');
});

test('adapter boundary requires explicit read-before-write capability', () => {
  assert.throws(() => assertCrmAdapter({ provider: 'hubspot', upsert() {} }), /inspectRemoteState_required/);
  const adapter = { provider: 'hubspot', upsert() {}, inspectRemoteState() {} };
  assert.equal(assertCrmAdapter(adapter), adapter);
});
