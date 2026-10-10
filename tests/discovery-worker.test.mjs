import test from 'node:test';
import assert from 'node:assert/strict';
import { executeDiscoveryJob, DISCOVERY_WORKER_CONTRACT_VERSION } from '../lib/jobs/discovery-worker.js';

test('worker refuses non-discovery job types before provider work', async () => {
  await assert.rejects(
    () => executeDiscoveryJob({}, { id:'1', workspace_id:'w', job_type:'contact_enrichment', lease_token:'lease', payload:{} }, {}),
    /invalid_discovery_job/,
  );
});

test('worker refuses execution without a valid claimed lease', async () => {
  await assert.rejects(
    () => executeDiscoveryJob({}, { id:'1', workspace_id:'w', job_type:'discovery', payload:{} }, {}),
    /requires_lease/,
  );
});

test('worker requires the dedicated Crustdata key before touching the database', async () => {
  await assert.rejects(
    () => executeDiscoveryJob({}, { id:'1', workspace_id:'w', job_type:'discovery', lease_token:'lease', payload:{} }, {}),
    /CRUSTDATA_API_KEY/,
  );
});

test('worker contract is explicitly versioned for hiring-led discovery', () => {
  assert.equal(DISCOVERY_WORKER_CONTRACT_VERSION, 'hiring-discovery-worker-v2');
});
