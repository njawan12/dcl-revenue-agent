import { defineDiscoverySource } from '../sources.js';
import { titleMatchesProfile } from '../../offers/profiles.js';

const LEGACY_RELEVANT = /shopify|e-?commerce|cro|conversion|retention|lifecycle|klaviyo|frontend|front-end|digital commerce|growth/i;

export function createGreenhouseSource({ boardToken, accountDomain, accountName, profile = null, fetchImpl = fetch }) {
  if (!boardToken || !accountDomain) throw new Error('greenhouse_source_config_required');
  return defineDiscoverySource({
    name: `greenhouse:${boardToken}`,
    async discover() {
      const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`;
      const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`greenhouse_http_${response.status}`);
      const payload = await response.json();
      const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
      const matching = jobs.filter((job) => profile
        ? titleMatchesProfile(job.title, profile)
        : LEGACY_RELEVANT.test(`${job.title ?? ''} ${job.content ?? ''} ${job.location?.name ?? ''}`));
      return {
        accounts: matching.length ? [{ domain: accountDomain, name: accountName, sourceUrl: `https://boards.greenhouse.io/${boardToken}`, evidence: { relevantOpenings: matching.length, freeJobBoardVerification:true } }] : [],
        signals: matching.map((job) => ({
          accountDomain,
          type: 'job',
          title: job.title || 'Relevant opening',
          sourceUrl: job.absolute_url || `https://boards.greenhouse.io/${boardToken}/jobs/${job.id}`,
          sourceName: `greenhouse:${boardToken}`,
          confidence: 0.98,
          observedAt: job.updated_at || new Date().toISOString(),
          fingerprint: `${accountDomain}|greenhouse|${job.id}`.toLowerCase(),
          evidence: { provider: 'greenhouse', postingId: job.id, location: job.location?.name ?? null, freeSecondarySource:true },
        })),
      };
    },
  });
}

export function greenhouseBoardTokenFromUrl(value) {
  try {
    const url = new URL(value);
    if (!/(^|\.)greenhouse\.io$/i.test(url.hostname) && !/(^|\.)greenhouse\.com$/i.test(url.hostname)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[0] === 'boards' ? parts[1] ?? null : parts[0] ?? null;
  } catch { return null; }
}
