import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DCL_OFFER_PROFILE } from '../lib/offers/profiles.js';
import { searchCrustdataJobs, searchCrustdataBuyers, enrichCrustdataBusinessEmails } from '../lib/discovery/adapters/crustdata.js';

function response(data, { status=200, credits='0' } = {}) {
  return new Response(JSON.stringify(data), { status, headers:{ 'content-type':'application/json', 'x-credits-used':credits } });
}

test('Crustdata job search uses configured hiring profile and never requests more than 25', async () => {
  let requestBody;
  const fetchImpl = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return response({ job_listings:[{
      crustdata_job_id:'j1',
      job_details:{ title:'Senior Shopify Developer', url:'https://jobs.example/j1', source:'greenhouse' },
      company:{ basic_info:{ crustdata_company_id:123, name:'North Brand', primary_domain:'northbrand.com', website:'https://northbrand.com', industries:['Apparel & Fashion'] }, headcount:{ total:120 }, locations:{ country:'United States' } },
      location:{ country:'United States', city:'New York' },
      content:{ description:'Own Shopify theme development.' },
      metadata:{ date_added:new Date().toISOString() },
    }] }, { credits:'0.03' });
  };
  const result = await searchCrustdataJobs({ apiKey:'test', profile:{ ...DEFAULT_DCL_OFFER_PROFILE, caps:{ ...DEFAULT_DCL_OFFER_PROFILE.caps, jobsPerRun:999 } }, limit:999, fetchImpl });
  assert.equal(requestBody.limit, 25);
  assert.equal(result.accounts.length, 1);
  assert.equal(result.signals[0].type, 'job');
  assert.equal(result.signals[0].sourceUrl, 'https://jobs.example/j1');
  assert.equal(result.creditsUsed, 0.03);
});

test('Crustdata job search excludes staffing companies client-side', async () => {
  const fetchImpl = async () => response({ job_listings:[{
    crustdata_job_id:'j2', job_details:{ title:'Shopify Developer', url:'https://jobs.example/j2' },
    company:{ basic_info:{ name:'Recruit Co', primary_domain:'recruitco.com', industries:['Staffing and Recruiting'] }, headcount:{total:100} },
    location:{country:'Canada'}, metadata:{date_added:new Date().toISOString()}, content:{description:''},
  }] }, {credits:'0.03'});
  const result = await searchCrustdataJobs({ apiKey:'test', profile:DEFAULT_DCL_OFFER_PROFILE, fetchImpl });
  assert.equal(result.accounts.length, 0);
  assert.equal(result.excludedCount, 1);
});

test('Crustdata buyer search is scoped to exact company domain', async () => {
  let body;
  const fetchImpl = async (_url, init) => {
    body = JSON.parse(init.body);
    return response({ profiles:[{
      crustdata_person_id:88,
      basic_profile:{name:'Jamie Chen', current_title:'VP Ecommerce', normalized_title:{department:'commerce'}},
      social_handles:{professional_network_identifier:{profile_url:'https://www.linkedin.com/in/jamiechen'}},
      experience:{employment_details:{current:{title:'VP Ecommerce',company_website:'https://brand.com',seniority_level:'Vice President'}}},
    }] }, {credits:'0.23'});
  };
  const result = await searchCrustdataBuyers({ apiKey:'test', accountDomain:'brand.com', profile:DEFAULT_DCL_OFFER_PROFILE, fetchImpl });
  const conditions = body.filters.conditions;
  assert.equal(conditions[0].field, 'experience.employment_details.current.company_website_domain');
  assert.equal(conditions[0].value, 'brand.com');
  assert.equal(result.candidates[0].provider, 'crustdata');
  assert.equal(result.creditsUsed, 0.23);
});

test('contact enrich marks only deliverable work email as verified', async () => {
  const candidate = { provider:'crustdata', providerPersonId:'88', fullName:'Jamie Chen', linkedinUrl:'https://www.linkedin.com/in/jamiechen', companyDomain:'brand.com', sourceConfidence:0.98 };
  const fetchImpl = async () => response([{
    matched_on:'https://www.linkedin.com/in/jamiechen',
    matches:[{ confidence_score:0.99, person_data:{ contact:{ business_emails:[{email:'jamie@brand.com',status:'deliverable'}] } } }],
  }], {credits:'1'});
  const result = await enrichCrustdataBusinessEmails({apiKey:'test',candidates:[candidate],fetchImpl});
  assert.equal(result.contacts[0].email,'jamie@brand.com');
  assert.equal(result.contacts[0].emailVerified,true);
  assert.equal(result.creditsUsed,1);
});
