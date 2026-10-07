import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpportunity, canGenerateOutreach } from '../lib/pipeline/orchestrator.js';
import { findVerifiedEmail } from '../lib/enrichment/waterfall.js';
import { validateDraft } from '../lib/outreach/guardrails.js';

test('non-job storefront opportunity can qualify', () => {
  const result = buildOpportunity({ shopify:true, shopifyPlus:true, country:'US', dtc:true, employeeCount:90, industry:'supplements', estimatedAgencyCapacity:true }, {
    need:{cro:1, performance:.8, mobileUx:1, pdp:.9, subscription:.9, analytics:.6},
    intent:{newEcommerceLeaderDaysAgo:40, majorLaunchSignal:true},
    confidence:.95
  });
  assert.ok(result.opportunity >= 70);
  assert.equal(result.motion, 'growth-partner');
});

test('outreach gate blocks unverified email and unapproved proof', () => {
  const result = canGenerateOutreach({ account:{fitScore:90,suppressed:false}, contact:{isPrimaryBuyer:true,emailVerified:false}, thesis:'Strong Shopify need', proofPoint:{approved:false} });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.blockers.sort(), ['email_not_verified','proof_not_approved'].sort());
});

test('enrichment waterfall stops on first verified high-confidence result', async () => {
  const providers = [
    {name:'A', findEmail:async()=>({email:'x@example.com',verified:false,confidence:.99,source:'A'})},
    {name:'B', findEmail:async()=>({email:'x@example.com',verified:true,confidence:.95,source:'B'})},
    {name:'C', findEmail:async()=>{throw new Error('should not run')}}
  ];
  const { result, attempts } = await findVerifiedEmail({firstName:'X'}, providers);
  assert.equal(result.source, 'B');
  assert.equal(attempts.length, 2);
});

test('draft guardrails reject invented claims', () => {
  const out = validateDraft({subject:'Idea', body:'We guarantee results', claims:['Raised CVR 50%']}, {
    reasonToContact:'Observable PDP friction', contact:{emailVerified:true}, suppressed:false,
    approvedProofPoints:[{approvedClaim:'Built Shopify Plus storefronts'}]
  });
  assert.equal(out.valid,false);
  assert.ok(out.errors.some(x=>x.startsWith('unapproved_claim')));
  assert.ok(out.errors.some(x=>x.startsWith('banned_phrase')));
});
