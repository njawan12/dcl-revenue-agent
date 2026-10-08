import test from 'node:test';
import assert from 'node:assert/strict';
import { rankBuyerCandidate, rankBuyerCandidates } from '../lib/buyers/ranking.js';

const base = {
  accountDomain: 'brand.com',
  suggestedBuyerRole: 'VP/Head of Ecommerce or Digital',
  need: { cro: 0.8, pdp: 0.6, retention: 0.1 },
};

test('rejects a candidate employed by the wrong company', () => {
  const result = rankBuyerCandidate({
    fullName: 'Wrong Person',
    title: 'VP Ecommerce',
    seniority: 'Vice President',
    companyDomain: 'otherbrand.com',
    sourceConfidence: 1,
  }, base);
  assert.equal(result.eligible, false);
  assert.equal(result.score, 0);
});

test('prefers ecommerce leadership for general Shopify/CRO opportunities', () => {
  const ranked = rankBuyerCandidates([
    { fullName:'A', title:'VP Ecommerce', seniority:'Vice President', companyDomain:'brand.com', departments:['Marketing'], sourceConfidence:0.9 },
    { fullName:'B', title:'Finance Director', seniority:'Director', companyDomain:'brand.com', departments:['Finance'], sourceConfidence:0.9 },
    { fullName:'C', title:'Ecommerce Manager', seniority:'Manager', companyDomain:'brand.com', departments:['Marketing'], sourceConfidence:0.9 },
  ], base);
  assert.equal(ranked[0].fullName, 'A');
  assert.ok(ranked[0].ranking.score > ranked.find((x) => x.fullName === 'C').ranking.score);
  assert.equal(ranked.some((x) => x.fullName === 'B'), false);
});

test('retention evidence changes the preferred buyer profile', () => {
  const ranked = rankBuyerCandidates([
    { fullName:'Lifecycle', title:'Head of Lifecycle Marketing', seniority:'Head', companyWebsite:'https://www.brand.com', departments:['Marketing'], sourceConfidence:0.95 },
    { fullName:'Commerce', title:'Director Ecommerce', seniority:'Director', companyDomain:'brand.com', departments:['Marketing'], sourceConfidence:0.95 },
  ], {
    accountDomain:'brand.com',
    suggestedBuyerRole:'Head of Retention / Lifecycle',
    need:{ retention:0.9, cro:0.2 },
  });
  assert.equal(ranked[0].fullName, 'Lifecycle');
});
