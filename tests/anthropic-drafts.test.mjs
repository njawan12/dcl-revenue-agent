import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDraftPrompt, draftWithAnthropic } from '../lib/ai/anthropic.js';
import { DEFAULT_DCL_OFFER_PROFILE } from '../lib/offers/profiles.js';

const qualification = {
  primaryJob:{ title:'Shopify Developer', sourceUrl:'https://jobs.example/shopify', observedAt:new Date().toISOString(), evidence:{ postedAt:new Date().toISOString(), descriptionExcerpt:'Maintain Shopify themes.' } },
};
const account = { name:'Example Brand', domain:'example.com', country:'United States', industry:'Apparel', employeeCount:120 };
const contact = { firstName:'Jamie', fullName:'Jamie Chen', title:'VP Ecommerce', email:'jamie@example.com', emailVerified:true };

test('draft prompt refuses to build without verified work email', () => {
  assert.throws(() => buildDraftPrompt({ account, contact:{...contact,emailVerified:false}, qualification, profile:DEFAULT_DCL_OFFER_PROFILE }), /verified_business_email/);
});

test('draft prompt makes hiring the primary reason and forbids invention', () => {
  const prompt = buildDraftPrompt({account,contact,qualification,profile:DEFAULT_DCL_OFFER_PROFILE,secondaryEvidence:[],approvedProofPoints:[]});
  assert.match(prompt,/PRIMARY reason to contact/);
  assert.match(prompt,/Never invent facts/);
  assert.match(prompt,/Shopify Developer/);
  assert.match(prompt,/jobs\.example\/shopify/);
});

test('Anthropic adapter parses JSON-only draft and exposes token usage', async () => {
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.model,'claude-sonnet-5');
    return new Response(JSON.stringify({ model:'claude-sonnet-5', content:[{type:'text',text:JSON.stringify({subject:'Shopify role',body:'Hi Jamie, I noticed Example Brand is hiring a Shopify Developer. Happy to share what we noticed if useful.\n\nNouman',claims:[],evidenceUsed:['https://jobs.example/shopify']})}], usage:{input_tokens:500,output_tokens:80} }), {status:200,headers:{'content-type':'application/json'}});
  };
  const result = await draftWithAnthropic({apiKey:'test',fetchImpl,account,contact,qualification,profile:DEFAULT_DCL_OFFER_PROFILE,secondaryEvidence:[],approvedProofPoints:[]});
  assert.equal(result.subject,'Shopify role');
  assert.equal(result.usage.inputTokens,500);
  assert.deepEqual(result.claims,[]);
});
