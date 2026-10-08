import test from 'node:test';
import assert from 'node:assert/strict';
import { researchBuyerContacts } from '../lib/buyers/orchestrator.js';

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers:{'content-type':'application/json'} });

const account = { domain:'brand.com' };
const qualification = {
  suggestedBuyerRole:'VP/Head of Ecommerce or Digital',
  inputs:{ need:{ cro:0.8, pdp:0.6, retention:0.1 } },
};

function prospeoSearchPayload() {
  return {
    error:false,
    results:[
      {
        person:{person_id:'top',first_name:'Ada',last_name:'Buyer',full_name:'Ada Buyer',current_job_title:'VP Ecommerce',job_history:[{current:true,title:'VP Ecommerce',seniority:'Vice President',departments:['Marketing']}]},
        company:{name:'Brand',domain:'brand.com',website:'https://brand.com'},
      },
      {
        person:{person_id:'lower',first_name:'Moe',last_name:'Manager',full_name:'Moe Manager',current_job_title:'Ecommerce Manager',job_history:[{current:true,title:'Ecommerce Manager',seniority:'Manager',departments:['Marketing']}]},
        company:{name:'Brand',domain:'brand.com',website:'https://brand.com'},
      },
    ],
  };
}

test('enriches the highest-ranked Prospeo buyer and stops after verified email', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes('search-person')) return jsonResponse(prospeoSearchPayload());
    if (String(url).includes('enrich-person')) return jsonResponse({
      error:false,
      person:{person_id:'top',first_name:'Ada',last_name:'Buyer',full_name:'Ada Buyer',current_job_title:'VP Ecommerce',email:{status:'VERIFIED',revealed:true,email:'ada@brand.com'}},
      company:{name:'Brand',domain:'brand.com',website:'https://brand.com'},
    });
    throw new Error('unexpected_call');
  };

  const result = await researchBuyerContacts({account,qualification,prospeoApiKey:'p',hunterApiKey:'h',fetchImpl});
  assert.equal(result.primaryContact.fullName, 'Ada Buyer');
  assert.equal(result.primaryContact.email, 'ada@brand.com');
  assert.equal(result.outreachReady, true);
  assert.equal(calls.filter((url) => url.includes('enrich-person')).length, 1);
  assert.equal(calls.some((url) => url.includes('hunter.io')), false);
});

test('falls back to Hunter for the same named person when Prospeo cannot reveal email', async () => {
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.includes('search-person')) return jsonResponse(prospeoSearchPayload());
    if (value.includes('enrich-person')) return jsonResponse({error:true,error_code:'NO_VERIFIED_EMAIL'});
    if (value.includes('email-finder')) return jsonResponse({data:{first_name:'Ada',last_name:'Buyer',email:'ada@brand.com',score:98,domain:'brand.com',position:'VP Ecommerce',company:'Brand',verification:{status:'valid'}}});
    throw new Error(`unexpected_call:${value}`);
  };

  const result = await researchBuyerContacts({account,qualification,prospeoApiKey:'p',hunterApiKey:'h',fetchImpl});
  assert.equal(result.primaryContact.fullName, 'Ada Buyer');
  assert.equal(result.primaryContact.emailVerified, true);
  assert.equal(result.primaryContact.verificationSource, 'hunter-email-finder');
  assert.equal(result.outreachReady, true);
});
