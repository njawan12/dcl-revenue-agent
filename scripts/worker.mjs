import crypto from 'node:crypto';
import { createServiceSupabaseClient } from '../lib/db/client.js';
import { processClaimedJob } from '../lib/jobs/discovery-worker.js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Supabase service credentials are required for the durable worker.');
  process.exit(1);
}

const client = createServiceSupabaseClient();
const workerToken = crypto.randomUUID();
const claim = await client.rpc('claim_durable_job', { p_worker: workerToken, p_lease_seconds: 300 });
if (claim.error) throw new Error(`claim_job:${claim.error.message}`);
const job = claim.data?.[0];

if (!job) {
  console.log(JSON.stringify({ status: 'idle' }));
  process.exit(0);
}

const outcome = await processClaimedJob(client, job);
console.log(JSON.stringify({ jobId: job.id, jobType: job.job_type, ...outcome }));
