import crypto from 'node:crypto';
import { createServiceSupabaseClient } from '../lib/db/client.js';
import { executeDiscoveryJob } from '../lib/jobs/discovery-worker.js';
import { DCL_WORKSPACE_ID } from '../lib/workspaces/config.js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Supabase service configuration is required for controlled discovery.');
  process.exit(1);
}
if (!process.env.CRUSTDATA_API_KEY) {
  console.error('CRUSTDATA_API_KEY is required for hiring-led discovery.');
  process.exit(1);
}

const client = createServiceSupabaseClient();
const workspaceId = process.env.WORKSPACE_ID || DCL_WORKSPACE_ID;
const offerProfileId = process.env.OFFER_PROFILE_ID || undefined;
const offerProfileKey = process.env.OFFER_PROFILE_KEY || undefined;

const result = await executeDiscoveryJob(client, {
  id: crypto.randomUUID(),
  workspace_id: workspaceId,
  job_type: 'discovery',
  lease_token: 'cli-controlled-run',
  payload: { offerProfileId, offerProfileKey, controlled: true },
}, process.env);

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), ...result }, null, 2));
