import { defineDiscoverySource } from '../sources.js';

const RELEVANT = /shopify|e-?commerce|cro|conversion|retention|lifecycle|klaviyo|frontend|front-end|digital commerce|growth/i;

export function createLeverSource({ site, accountDomain, accountName, fetchImpl = fetch, region = 'global' }) {
  if (!site || !accountDomain) throw new Error('lever_source_config_required');
  const base = region === 'eu' ? 'https://api.eu.lever.co/v0/postings' : 'https://api.lever.co/v0/postings';
  return defineDiscoverySource({
    name: `lever:${site}`,
    async discover() {
      const url = `${base}/${encodeURIComponent(site)}?mode=json`;
      const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`lever_http_${response.status}`);
      const jobs = await response.json();
      const matching = (Array.isArray(jobs) ? jobs : []).filter((job) => RELEVANT.test(`${job.text ?? ''} ${job.descriptionPlain ?? ''} ${job.categories?.team ?? ''}`));
      return {
        accounts: matching.length ? [{ domain: accountDomain, name: accountName, sourceUrl: `https://jobs.lever.co/${site}`, evidence: { relevantOpenings: matching.length } }] : [],
        signals: matching.map((job) => ({
          accountDomain,
          type: 'job',
          title: job.text || 'Relevant ecommerce opening',
          sourceUrl: job.hostedUrl || `https://jobs.lever.co/${site}/${job.id}`,
          confidence: 0.95,
          observedAt: new Date().toISOString(),
          fingerprint: `${accountDomain}|lever|${job.id}`.toLowerCase(),
          evidence: { provider: 'lever', postingId: job.id, team: job.categories?.team ?? null, location: job.categories?.location ?? null },
        })),
      };
    },
  });
}
