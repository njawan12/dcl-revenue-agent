import { createHash } from 'node:crypto';

export const DURABLE_JOB_CONTRACT_VERSION = 'durable-job-v1';
export const DURABLE_JOB_TYPES = Object.freeze(['discovery','storefront_observation','buyer_research','contact_enrichment']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

export function createIdempotencyKey({ workspaceId, jobType, scope }) {
  if (!workspaceId) throw new Error('workspace_id_required');
  if (!DURABLE_JOB_TYPES.includes(jobType)) throw new Error('unsupported_job_type');
  if (scope == null) throw new Error('idempotency_scope_required');
  return createHash('sha256').update(JSON.stringify(stable({ contract:DURABLE_JOB_CONTRACT_VERSION, workspaceId, jobType, scope }))).digest('hex');
}

export function buildDurableJob({ workspaceId, jobType, scope, payload = {}, maxAttempts = 3 }) {
  if (!workspaceId) throw new Error('workspace_id_required');
  if (!DURABLE_JOB_TYPES.includes(jobType)) throw new Error('unsupported_job_type');
  const boundedAttempts = Math.max(1, Math.min(10, Number(maxAttempts) || 3));
  return {
    workspace_id: workspaceId,
    job_type: jobType,
    idempotency_key: createIdempotencyKey({ workspaceId, jobType, scope }),
    payload: { contractVersion:DURABLE_JOB_CONTRACT_VERSION, ...payload },
    max_attempts: boundedAttempts,
  };
}

export async function enqueueDurableJob(client, job) {
  const result = await client.from('durable_jobs').upsert(job, {
    onConflict:'workspace_id,job_type,idempotency_key',
    ignoreDuplicates:true,
  }).select('id,workspace_id,job_type,idempotency_key,status,attempt_count,max_attempts').limit(1);
  if (result.error) throw new Error(`enqueue_durable_job:${result.error.message ?? result.error}`);
  // ignoreDuplicates may return no row for an existing key. Fetch the canonical job
  // rather than creating a second unit of work.
  if (result.data?.[0]) return result.data[0];
  const existing = await client.from('durable_jobs').select('id,workspace_id,job_type,idempotency_key,status,attempt_count,max_attempts')
    .eq('workspace_id',job.workspace_id).eq('job_type',job.job_type).eq('idempotency_key',job.idempotency_key).maybeSingle();
  if (existing.error || !existing.data) throw new Error(`resolve_durable_job:${existing.error?.message ?? 'missing'}`);
  return existing.data;
}
