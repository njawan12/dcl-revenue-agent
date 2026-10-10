import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DCL_OFFER_PROFILE, normalizeOfferProfile, isExcludedIndustry, titleMatchesProfile } from '../lib/offers/profiles.js';
import { qualifyAccountForOfferProfile } from '../lib/offers/qualification.js';

test('offer profile hard caps job and contact lookups at 25', () => {
  const profile = normalizeOfferProfile({ caps:{ jobsPerRun:999, contactsPerRun:999 } });
  assert.equal(profile.caps.jobsPerRun, 25);
  assert.equal(profile.caps.contactsPerRun, 25);
});

test('DCL profile matches Shopify/ecommerce hiring and excludes recruiters', () => {
  assert.equal(titleMatchesProfile('Senior Shopify Developer', DEFAULT_DCL_OFFER_PROFILE), true);
  assert.equal(titleMatchesProfile('Backend Java Engineer', DEFAULT_DCL_OFFER_PROFILE), false);
  assert.equal(isExcludedIndustry('Staffing and Recruiting', DEFAULT_DCL_OFFER_PROFILE), true);
  assert.equal(isExcludedIndustry('Apparel & Fashion', DEFAULT_DCL_OFFER_PROFILE), false);
});

test('profile qualification requires a recent matching hiring trigger', () => {
  const account = { domain:'brand.com', name:'Brand', country:'United States', employeeCount:200, industry:'Apparel & Fashion' };
  const withoutJob = qualifyAccountForOfferProfile(account, [], DEFAULT_DCL_OFFER_PROFILE);
  assert.equal(withoutJob.tier, 'reject');

  const signals = [{
    accountDomain:'brand.com', type:'job', title:'Shopify Developer', sourceUrl:'https://jobs.example/1',
    observedAt:new Date().toISOString(), confidence:1, fingerprint:'job-1', evidence:{ postedAt:new Date().toISOString() },
  }];
  const withJob = qualifyAccountForOfferProfile(account, signals, DEFAULT_DCL_OFFER_PROFILE);
  assert.notEqual(withJob.tier, 'reject');
  assert.equal(withJob.primaryJob.sourceUrl, 'https://jobs.example/1');
  assert.ok(withJob.scores.intent >= 50);
});

test('excluded industries are rejected even with a matching job', () => {
  const account = { domain:'recruiter.com', country:'United States', employeeCount:200, industry:'Staffing & Recruiting' };
  const signals = [{ accountDomain:'recruiter.com', type:'job', title:'Shopify Developer', sourceUrl:'https://jobs.example/2', observedAt:new Date().toISOString(), confidence:1, fingerprint:'job-2', evidence:{postedAt:new Date().toISOString()} }];
  const result = qualifyAccountForOfferProfile(account, signals, DEFAULT_DCL_OFFER_PROFILE);
  assert.equal(result.tier, 'reject');
});
