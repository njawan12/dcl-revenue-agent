import test from 'node:test';
import assert from 'node:assert/strict';
import { searchProspeoBuyers, enrichProspeoPerson } from '../lib/buyers/prospeo.js';
import { findHunterEmail } from '../lib/buyers/hunter.js';

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers:{'content-type':'application/json'} });

test('Prospeo buyer search scopes to the exact company website and normalizes current job', async () => {
  let requestBody;
  const fetchImpl = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return jsonResponse({
      error:false,
      free:false,
      results:[{
        person:{
          person_id:'p1', first_name:'Ada', last_name:'Buyer', full_name:'Ada Buyer',
          current_job_title:'VP Ecommerce', linkedin_url:'https://linkedin.com/in/ada',
          email:{status:'VERIFIED',revealed:false},
          job_history:[{current:true,title:'VP Ecommerce',seniority:'Vice President',departments:['Marketing'],company_id:'c1'}],
        },
        company:{name:'Brand',domain:'brand.com',website:'https://brand.com',company_id:'c1'},
      }],
    });
  };
  const result = await searchProspeoBuyers({apiKey:'x',accountDomain:'www.brand.com',suggestedBuyerRole:'VP Ecommerce',fetchImpl});
  assert.deepEqual(requestBody.filters.company.websites.include, ['brand.com']);
  assert.equal(result.candidates[0].fullName, 'Ada Buyer');
  assert.equal(result.candidates[0].seniority, 'Vice President');
  assert.equal(result.candidates[0].email, undefined);
});

test('Prospeo enrichment only accepts revealed VERIFIED email for matching company', async () => {
  const fetchImpl = async () => jsonResponse({
    error:false,
    free_enrichment:false,
    person:{person_id:'p1',first_name:'Ada',last_name:'Buyer',full_name:'Ada Buyer',current_job_title:'VP Ecommerce',email:{status:'VERIFIED',revealed:true,email:'ada@brand.com'}},
    company:{name:'Brand',domain:'brand.com',website:'https://brand.com'},
  });
  const result = await enrichProspeoPerson({apiKey:'x',personId:'p1',accountDomain:'brand.com',fetchImpl});
  assert.equal(result.contact.email, 'ada@brand.com');
  assert.equal(result.contact.emailVerified, true);
});

test('Prospeo enrichment rejects verified email when enriched company is wrong', async () => {
  const fetchImpl = async () => jsonResponse({
    error:false,
    person:{person_id:'p1',full_name:'Ada Buyer',email:{status:'VERIFIED',revealed:true,email:'ada@other.com'}},
    company:{name:'Other',domain:'other.com',website:'https://other.com'},
  });
  const result = await enrichProspeoPerson({apiKey:'x',personId:'p1',accountDomain:'brand.com',fetchImpl});
  assert.equal(result.contact, null);
});

test('Hunter accept-all email is not marked verified', async () => {
  const fetchImpl = async () => jsonResponse({data:{first_name:'Ada',last_name:'Buyer',email:'ada@brand.com',score:93,domain:'brand.com',position:'VP Ecommerce',company:'Brand',verification:{status:'accept_all'}}});
  const result = await findHunterEmail({apiKey:'x',accountDomain:'brand.com',firstName:'Ada',lastName:'Buyer',fetchImpl});
  assert.equal(result.contact.email, 'ada@brand.com');
  assert.equal(result.contact.emailVerified, false);
  assert.equal(result.contact.verificationStatus, 'accept_all');
});
