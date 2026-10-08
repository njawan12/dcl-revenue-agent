export async function getDiscoveryDashboard(client, workspaceId) {
  if (!client || !workspaceId) return { configured: false, runs: [], totals: { accounts: 0, signals: 0, verifiedShopify: 0 } };
  const [runsResult, accountCount, signalCount, verifiedCount] = await Promise.all([
    client.from('discovery_runs').select('id,status,source_names,started_at,completed_at,accounts_discovered,signals_discovered,error_count').eq('workspace_id', workspaceId).order('started_at', { ascending: false }).limit(20),
    client.from('accounts').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    client.from('signals').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    client.from('accounts').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('shopify', true),
  ]);
  for (const result of [runsResult, accountCount, signalCount, verifiedCount]) {
    if (result.error) throw new Error(result.error.message);
  }
  return {
    configured: true,
    runs: runsResult.data ?? [],
    totals: {
      accounts: accountCount.count ?? 0,
      signals: signalCount.count ?? 0,
      verifiedShopify: verifiedCount.count ?? 0,
    },
  };
}
