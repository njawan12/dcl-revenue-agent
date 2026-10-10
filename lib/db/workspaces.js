import { normalizeWorkspaceConfig } from '../workspaces/config.js';
import { DEFAULT_DCL_OFFER_PROFILE, normalizeOfferProfile } from '../offers/profiles.js';

export async function loadWorkspaceSalesConfig(client, workspaceId) {
  if (!workspaceId) throw new Error('workspace_id_required');
  const { data, error } = await client
    .from('workspace_sales_config')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) throw new Error(`load_workspace_config:${error.message ?? error}`);
  return normalizeWorkspaceConfig({ ...(data ?? {}), workspaceId });
}

export async function listOfferProfiles(client, workspaceId, { activeOnly = false } = {}) {
  if (!workspaceId) throw new Error('workspace_id_required');
  let query = client
    .from('offer_profiles')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });
  if (activeOnly) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw new Error(`load_offer_profiles:${error.message ?? error}`);
  return (data ?? []).map((row) => normalizeOfferProfile(row));
}

export async function loadOfferProfile(client, workspaceId, profileIdOrKey = null) {
  if (!workspaceId) throw new Error('workspace_id_required');
  let query = client.from('offer_profiles').select('*').eq('workspace_id', workspaceId);
  if (profileIdOrKey) {
    const value = String(profileIdOrKey);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) query = query.eq('id', value);
    else query = query.eq('profile_key', value);
  } else {
    query = query.eq('active', true).order('priority', { ascending: true }).limit(1);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`load_offer_profile:${error.message ?? error}`);
  if (data) return normalizeOfferProfile(data);
  if (!profileIdOrKey && workspaceId === DEFAULT_DCL_OFFER_PROFILE.workspaceId) return normalizeOfferProfile(DEFAULT_DCL_OFFER_PROFILE);
  throw new Error('offer_profile_not_found');
}

export async function recordProviderUsage(client, {
  workspaceId,
  offerProfileId = null,
  provider,
  action,
  units = 1,
  estimatedCostUsd = null,
  metadata = {},
}) {
  if (!workspaceId) throw new Error('workspace_id_required');
  const { error } = await client.from('provider_usage').insert({
    workspace_id: workspaceId,
    offer_profile_id: offerProfileId,
    provider,
    action,
    units,
    estimated_cost_usd: estimatedCostUsd,
    metadata,
  });
  if (error) throw new Error(`record_provider_usage:${error.message ?? error}`);
}

export async function providerUsageTotals(client, workspaceId, offerProfileId, sinceIso, { provider = null } = {}) {
  let query = client
    .from('provider_usage')
    .select('provider,action,units,estimated_cost_usd,occurred_at,metadata')
    .eq('workspace_id', workspaceId)
    .gte('occurred_at', sinceIso);
  if (offerProfileId) query = query.eq('offer_profile_id', offerProfileId);
  if (provider) query = query.eq('provider', provider);
  const { data, error } = await query;
  if (error) throw new Error(`provider_usage_totals:${error.message ?? error}`);
  return (data ?? []).reduce((acc, row) => {
    acc.units += Number(row.units ?? 0);
    acc.estimatedCostUsd += Number(row.estimated_cost_usd ?? 0);
    return acc;
  }, { units: 0, estimatedCostUsd: 0 });
}
