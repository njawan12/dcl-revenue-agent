function unwrap(result, label) {
  if (result?.error) throw new Error(`${label}:${result.error.message ?? result.error}`);
  return result?.data;
}

export async function persistDiscoveryRun(client, { sourceNames = [], accounts = [], signals = [], errors = [], metadata = {} }) {
  const started = new Date().toISOString();
  const runRows = unwrap(await client.from('discovery_runs').insert({
    status: 'running',
    source_names: sourceNames,
    started_at: started,
    metadata,
  }).select('id').limit(1), 'create_discovery_run');
  const runId = runRows?.[0]?.id;
  if (!runId) throw new Error('discovery_run_id_missing');

  try {
    const accountRows = accounts.map((account) => {
      const verified = Number(account.evidence?.shopifyConfidence ?? 0) >= 0.35;
      return {
        domain: account.domain,
        name: account.name || account.domain,
        country: account.country ?? null,
        industry: account.industry ?? null,
        employee_count: account.employeeCount ?? null,
        website_url: account.websiteUrl ?? account.url ?? `https://${account.domain}`,
        shopify: verified,
        shopify_confidence: account.evidence?.shopifyConfidence ?? null,
        shopify_verified_at: verified ? new Date().toISOString() : null,
        technology_tags: account.evidence?.technologies ?? [],
        last_discovered_at: new Date().toISOString(),
      };
    });

    let storedAccounts = [];
    if (accountRows.length) {
      storedAccounts = unwrap(await client.from('accounts').upsert(accountRows, { onConflict: 'domain' }).select('id,domain'), 'upsert_accounts') ?? [];
    }
    const accountIdByDomain = new Map(storedAccounts.map((row) => [row.domain, row.id]));

    const signalRows = signals
      .map((signal) => ({
        account_id: accountIdByDomain.get(signal.accountDomain),
        signal_type: signal.type,
        title: signal.title,
        source_url: signal.sourceUrl,
        source_name: signal.sourceName,
        observed_at: signal.observedAt,
        confidence: signal.confidence,
        evidence: signal.evidence ?? {},
        fingerprint: signal.fingerprint,
      }))
      .filter((row) => row.account_id);
    if (signalRows.length) {
      unwrap(await client.from('signals').upsert(signalRows, { onConflict: 'fingerprint', ignoreDuplicates: true }), 'upsert_signals');
    }

    const observations = [
      ...accounts.map((account) => ({
        run_id: runId,
        account_domain: account.domain,
        source_name: account.sourceName ?? 'unknown',
        source_url: account.sourceUrl ?? account.websiteUrl ?? null,
        observation_type: 'account',
        verified: Number(account.evidence?.shopifyConfidence ?? 0) >= 0.35,
        confidence: account.evidence?.shopifyConfidence ?? null,
        payload: account,
      })),
      ...signals.map((signal) => ({
        run_id: runId,
        account_domain: signal.accountDomain,
        source_name: signal.sourceName ?? 'unknown',
        source_url: signal.sourceUrl ?? null,
        observation_type: `signal:${signal.type}`,
        verified: signal.type === 'storefront' || signal.type === 'technology',
        confidence: signal.confidence ?? null,
        payload: signal,
      })),
    ];
    if (observations.length) unwrap(await client.from('discovery_observations').insert(observations), 'insert_observations');

    const status = errors.length ? 'partial' : 'completed';
    unwrap(await client.from('discovery_runs').update({
      status,
      completed_at: new Date().toISOString(),
      accounts_discovered: accounts.length,
      signals_discovered: signals.length,
      error_count: errors.length,
    }).eq('id', runId), 'complete_discovery_run');

    return { runId, status, accountCount: accounts.length, signalCount: signals.length, errorCount: errors.length };
  } catch (error) {
    await client.from('discovery_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_count: Math.max(1, errors.length) }).eq('id', runId);
    throw error;
  }
}
