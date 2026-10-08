import { normalizeWorkspaceConfig } from '../workspaces/config.js';

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

export async function recordProviderUsage(client, { workspaceId, provider, action, units = 1, estimatedCostUsd = null, metadata = {} }) {
  if (!workspaceId) throw new Error('workspace_id_required');
  const { error } = await client.from('provider_usage').insert({
    workspace_id: workspaceId,
    provider,
    action,
    units,
    estimated_cost_usd: estimatedCostUsd,
    metadata,
  });
  if (error) throw new Error(`record_provider_usage:${error.message ?? error}`);
}
