import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDurableJob, createIdempotencyKey } from '../lib/jobs.js';

test('idempotency keys are deterministic across object key order', () => {
  const a=createIdempotencyKey({workspaceId:'w1',jobType:'discovery',scope:{source:'jobs',query:'shopify',filters:{country:'US',size:50}}});
  const b=createIdempotencyKey({workspaceId:'w1',jobType:'discovery',scope:{filters:{size:50,country:'US'},query:'shopify',source:'jobs'}});
  assert.equal(a,b);
});

test('workspace identity is part of idempotency boundary', () => {
  const a=createIdempotencyKey({workspaceId:'w1',jobType:'buyer_research',scope:{accountId:'a1'}});
  const b=createIdempotencyKey({workspaceId:'w2',jobType:'buyer_research',scope:{accountId:'a1'}});
  assert.notEqual(a,b);
});

test('external send and arbitrary job types are rejected', () => {
  assert.throws(()=>buildDurableJob({workspaceId:'w1',jobType:'send_outreach',scope:{id:'x'}}),/unsupported_job_type/);
});

test('attempt count is bounded by the contract', () => {
  assert.equal(buildDurableJob({workspaceId:'w1',jobType:'discovery',scope:{id:1},maxAttempts:999}).max_attempts,10);
  assert.equal(buildDurableJob({workspaceId:'w1',jobType:'discovery',scope:{id:2},maxAttempts:0}).max_attempts,3);
});
