import { createBuiltWithShopifySource } from '../discovery/adapters/builtwith.js';
import { createStoreLeadsShopifySource } from '../discovery/adapters/storeleads.js';
import { createStorefrontSource } from '../discovery/adapters/storefront.js';
import { runDiscoverySources } from '../discovery/sources.js';
import { qualifyDiscoveredAccount } from '../discovery/qualification.js';
import { persistDiscoveryRun } from '../db/discovery.js';
import { loadWorkspaceSalesConfig, recordProviderUsage } from '../db/workspaces.js';

export const DISCOVERY_WORKER_CONTRACT_VERSION = 'discovery-worker-v1';

function boundedLimit(value) {
  return Math.max(1, Math.min(100, Number(value) || 25));
}

export async function executeDiscoveryJob(client, job, env = process.env) {
  if (!job?.id || !job?.workspace_id || job.job_type !== 'discovery') throw new Error('invalid_discovery_job');
  if (!job.lease_token) throw new Error('discovery_job_requires_lease');

  const scope = job.payload?.scope ?? {};
  const limit = boundedLimit(scope.limit);
  const workspaceConfig = await loadWorkspaceSalesConfig(client, job.workspace_id);
  const countries = Array.isArray(scope.countries) && scope.countries.length ? scope.countries : workspaceConfig.targetCountries;

  let candidateSource;
  if (env.STORELEADS_API_KEY) {
    candidateSource = createStoreLeadsShopifySource({ apiKey: env.STORELEADS_API_KEY, pageSize: Math.min(limit, 50), countries });
  } else if (env.BUILTWITH_API_KEY) {
    candidateSource = createBuiltWithShopifySource({ apiKey: env.BUILTWITH_API_KEY, limit, since: scope.since || undefined, otherTechs: scope.otherTechs || [] });
  } else {
    const error = new Error('discovery_provider_not_configured');
    error.code = 'provider_not_configured';
    throw error;
  }

  const candidates = await runDiscoverySources([candidateSource], { failFast: true });
  const storefrontSource = createStorefrontSource({ candidates: candidates.accounts.slice(0, limit) });
  const verified = await runDiscoverySources([storefrontSource]);
  const signals = [...candidates.signals, ...verified.signals];
  const qualifications = verified.accounts.map((account) => qualifyDiscoveredAccount(account, signals, workspaceConfig));

  const persistence = await persistDiscoveryRun(client, {
    workspaceId: job.workspace_id,
    sourceNames: [candidateSource.name, storefrontSource.name],
    accounts: verified.accounts,
    signals,
    qualifications,
    errors: [...candidates.errors, ...verified.errors],
    metadata: { durableJobId: job.id, workerContractVersion: DISCOVERY_WORKER_CONTRACT_VERSION, limit, countries, candidateCount: candidates.accounts.length },
  });

  await recordProviderUsage(client, {
    workspaceId: job.workspace_id,
    provider: candidateSource.name,
    action: 'shopify_candidate_discovery',
    units: Math.max(1, candidates.accounts.length),
    metadata: { durableJobId: job.id, requestedLimit: limit, countries },
  });

  return {
    contractVersion: DISCOVERY_WORKER_CONTRACT_VERSION,
    discoveryRunId: persistence.runId,
    provider: candidateSource.name,
    candidateCount: candidates.accounts.length,
    verifiedShopifyCount: verified.accounts.length,
    qualifiedCount: qualifications.filter((item) => ['qualified','priority'].includes(item.tier)).length,
    errorCount: candidates.errors.length + verified.errors.length,
  };
}

export async function processClaimedJob(client, job, env = process.env) {
  try {
    if (job.job_type !== 'discovery') throw Object.assign(new Error('unsupported_worker_job_type'), { code: 'unsupported_job_type' });
    const result = await executeDiscoveryJob(client, job, env);
    const completion = await client.rpc('complete_durable_job', { p_job_id: job.id, p_lease_token: job.lease_token, p_result: result });
    if (completion.error) throw new Error(`complete_job:${completion.error.message}`);
    return { status: 'succeeded', result };
  } catch (error) {
    const failure = await client.rpc('fail_durable_job', {
      p_job_id: job.id,
      p_lease_token: job.lease_token,
      p_error_code: String(error?.code || 'worker_failure').slice(0, 120),
      p_error_message: String(error?.message || 'Unknown worker failure').slice(0, 2000),
      p_retry_delay_seconds: 60,
    });
    if (failure.error) throw new Error(`fail_job:${failure.error.message}`);
    return { status: 'failed_or_retrying', errorCode: String(error?.code || 'worker_failure') };
  }
}
