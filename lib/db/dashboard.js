import { createServiceSupabaseClient } from './client.js';

function configured(env = process.env) {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function getDiscoveryDashboard(env = process.env) {
  if (!configured(env)) return { configured: false, runs: [], totals: { accounts: 0, signals: 0, verifiedShopify: 0 } };
  const client = createServiceSupabaseClient(env);
  const [runsResult, accountCount, signalCount, verifiedCount] = await Promise.all([
    client.from('discovery_runs').select('id,status,source_names,started_at,completed_at,accounts_discovered,signals_discovered,error_count').order('started_at', { ascending: false }).limit(20),
    client.from('accounts').select('id', { count: 'exact', head: true }),
    client.from('signals').select('id', { count: 'exact', head: true }),
    client.from('accounts').select('id', { count: 'exact', head: true }).eq('shopify', true),
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
