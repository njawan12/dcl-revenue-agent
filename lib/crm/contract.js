import crypto from 'node:crypto';

export const CRM_CONTRACT_VERSION = 'crm-sync-v1';
export const CRM_PROVIDERS = Object.freeze(['hubspot', 'salesforce', 'attio', 'pipedrive']);
export const CRM_OBJECT_TYPES = Object.freeze(['account', 'contact', 'opportunity', 'activity']);
export const CRM_OPERATIONS = Object.freeze(['upsert']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function requireValue(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}_required`);
  return value.trim();
}

export function buildCrmSyncCommand({ workspaceId, provider, objectType, localId, revision, fields = {} }) {
  const safeWorkspaceId = requireValue(workspaceId, 'workspace_id');
  const safeLocalId = requireValue(localId, 'local_id');
  if (!CRM_PROVIDERS.includes(provider)) throw new Error('unsupported_crm_provider');
  if (!CRM_OBJECT_TYPES.includes(objectType)) throw new Error('unsupported_crm_object_type');
  if (!Number.isInteger(revision) || revision < 1) throw new Error('invalid_crm_revision');
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error('invalid_crm_fields');

  // Deliberately excludes credentials and provider-specific IDs from the portable command.
  // Adapters own those mappings; the product owns the versioned local revision.
  const scope = stable({
    contractVersion: CRM_CONTRACT_VERSION,
    workspaceId: safeWorkspaceId,
    provider,
    objectType,
    operation: 'upsert',
    localId: safeLocalId,
    revision,
    fields,
  });

  return {
    ...scope,
    idempotencyKey: crypto.createHash('sha256').update(JSON.stringify(scope)).digest('hex'),
  };
}

export function classifyCrmConflict({ localRevision, lastSyncedRevision, remoteChangedSinceSync = false }) {
  if (!Number.isInteger(localRevision) || localRevision < 1) throw new Error('invalid_local_revision');
  if (lastSyncedRevision != null && (!Number.isInteger(lastSyncedRevision) || lastSyncedRevision < 0)) {
    throw new Error('invalid_last_synced_revision');
  }

  if (remoteChangedSinceSync && lastSyncedRevision != null && localRevision > lastSyncedRevision) {
    return { state: 'conflict', automaticWriteAllowed: false, reason: 'both_sides_changed' };
  }
  if (remoteChangedSinceSync) {
    return { state: 'remote_changed', automaticWriteAllowed: false, reason: 'remote_change_requires_review' };
  }
  if (lastSyncedRevision != null && localRevision <= lastSyncedRevision) {
    return { state: 'current', automaticWriteAllowed: false, reason: 'already_synced' };
  }
  return { state: 'ready', automaticWriteAllowed: true, reason: 'local_revision_is_newer' };
}

export function assertCrmAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') throw new Error('crm_adapter_required');
  if (!CRM_PROVIDERS.includes(adapter.provider)) throw new Error('unsupported_crm_provider');
  for (const method of ['upsert', 'inspectRemoteState']) {
    if (typeof adapter[method] !== 'function') throw new Error(`crm_adapter_${method}_required`);
  }
  return adapter;
}
