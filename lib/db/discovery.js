function unwrap(result, label) {
  if (result?.error) throw new Error(`${label}:${result.error.message ?? result.error}`);
  return result?.data;
}

export async function persistDiscoveryRun(client, {
  workspaceId,
  offerProfileId = null,
  sourceNames = [],
  accounts = [],
  signals = [],
  qualifications = [],
  errors = [],
  metadata = {},
}) {
  if (!workspaceId) throw new Error('workspace_id_required');
  const started = new Date().toISOString();
  const runRows = unwrap(await client.from('discovery_runs').insert({
    workspace_id: workspaceId,
    offer_profile_id: offerProfileId,
    status: 'running',
    source_names: sourceNames,
    started_at: started,
    metadata,
  }).select('id').limit(1), 'create_discovery_run');
  const runId = runRows?.[0]?.id;
  if (!runId) throw new Error('discovery_run_id_missing');

  try {
    const qualificationByDomain = new Map(qualifications.map((item) => [item.accountDomain, item]));
    const accountRows = accounts.map((account) => {
      const verifiedShopify = Number(account.evidence?.shopifyConfidence ?? 0) >= 0.35;
      const qualification = qualificationByDomain.get(account.domain);
      return {
        workspace_id: workspaceId,
        domain: account.domain,
        name: account.name || account.domain,
        country: account.country ?? null,
        industry: account.industry ?? null,
        employee_count: account.employeeCount ?? null,
        website_url: account.websiteUrl ?? account.url ?? `https://${account.domain}`,
        shopify: verifiedShopify,
        shopify_confidence: account.evidence?.shopifyConfidence ?? null,
        shopify_verified_at: verifiedShopify ? new Date().toISOString() : null,
        technology_tags: account.evidence?.technologies ?? [],
        last_discovered_at: new Date().toISOString(),
        fit_score: qualification?.scores?.fit ?? null,
        need_score: qualification?.scores?.need ?? null,
        intent_score: qualification?.scores?.intent ?? null,
        opportunity_score: qualification?.scores?.opportunity ?? null,
        tier: qualification?.tier ?? 'review',
        recommended_motion: qualification?.motion ?? null,
        suggested_buyer_role: qualification?.suggestedBuyerRole ?? null,
        qualification_inputs: qualification?.inputs ?? {},
        evidence_confidence: qualification?.scores?.evidenceConfidence ?? null,
      };
    });

    let storedAccounts = [];
    if (accountRows.length) {
      storedAccounts = unwrap(await client
        .from('accounts')
        .upsert(accountRows, { onConflict: 'workspace_id,domain' })
        .select('id,domain,name'), 'upsert_accounts') ?? [];
    }
    const accountIdByDomain = new Map(storedAccounts.map((row) => [row.domain, row.id]));

    const signalRows = signals.map((signal) => ({
      workspace_id: workspaceId,
      offer_profile_id: offerProfileId,
      account_id: accountIdByDomain.get(signal.accountDomain),
      signal_type: signal.type,
      title: signal.title,
      source_url: signal.sourceUrl,
      source_name: signal.sourceName,
      observed_at: signal.observedAt,
      confidence: signal.confidence,
      evidence: signal.evidence ?? {},
      fingerprint: signal.fingerprint,
    })).filter((row) => row.account_id && row.fingerprint);

    let storedSignals = [];
    if (signalRows.length) {
      unwrap(await client.from('signals').upsert(signalRows, { onConflict: 'workspace_id,fingerprint', ignoreDuplicates: true }), 'upsert_signals');
      const storedSignalResult = await client
        .from('signals')
        .select('id,fingerprint,account_id')
        .eq('workspace_id', workspaceId)
        .in('fingerprint', signalRows.map((row) => row.fingerprint));
      if (storedSignalResult.error) throw new Error(`load_stored_signals:${storedSignalResult.error.message}`);
      storedSignals = storedSignalResult.data ?? [];
    }
    const signalIdByFingerprint = new Map(storedSignals.map((row) => [row.fingerprint, row.id]));

    const scoringRows = qualifications.map((qualification) => {
      const receipt = qualification.scoringReceipt;
      const accountId = accountIdByDomain.get(qualification.accountDomain);
      if (!receipt || !accountId) return null;
      return {
        workspace_id: workspaceId,
        offer_profile_id: offerProfileId,
        account_id: accountId,
        scoring_contract_version: receipt.scoringContractVersion,
        fit_score: receipt.scores.fit,
        need_score: receipt.scores.need,
        intent_score: receipt.scores.intent,
        opportunity_score: receipt.scores.opportunity,
        tier: receipt.tier,
        evidence_confidence: receipt.evidenceConfidence,
        inputs: receipt.inputs,
        explanation: receipt.explanation,
        evidence_refs: receipt.evidenceRefs,
        config_snapshot: receipt.configSnapshot,
      };
    }).filter(Boolean);
    if (scoringRows.length) unwrap(await client.from('scoring_snapshots').insert(scoringRows), 'insert_scoring_snapshots');

    if (offerProfileId) {
      const matchRows = qualifications.map((qualification) => {
        const accountId = accountIdByDomain.get(qualification.accountDomain);
        if (!accountId) return null;
        const primaryFingerprint = qualification.primaryJob?.fingerprint ?? qualification.primaryJob?.evidence?.fingerprint ?? null;
        const primaryJobSignalId = primaryFingerprint ? signalIdByFingerprint.get(primaryFingerprint) : null;
        return {
          workspace_id: workspaceId,
          offer_profile_id: offerProfileId,
          account_id: accountId,
          primary_job_signal_id: primaryJobSignalId ?? null,
          fit_score: qualification.scores?.fit ?? null,
          need_score: qualification.scores?.need ?? null,
          intent_score: qualification.scores?.intent ?? null,
          opportunity_score: qualification.scores?.opportunity ?? null,
          tier: qualification.tier ?? 'review',
          evidence_confidence: qualification.scores?.evidenceConfidence ?? null,
          suggested_buyer_role: qualification.suggestedBuyerRole ?? null,
          recommended_motion: qualification.motion ?? null,
          qualification_reason: qualification.reason ?? null,
          scoring_receipt: qualification.scoringReceipt ?? {},
          latest_trigger_at: qualification.primaryJob?.evidence?.postedAt ?? qualification.primaryJob?.observedAt ?? null,
          updated_at: new Date().toISOString(),
        };
      }).filter(Boolean);
      if (matchRows.length) {
        unwrap(await client.from('profile_account_matches').upsert(matchRows, { onConflict: 'offer_profile_id,account_id' }), 'upsert_profile_matches');
      }
    }

    const observations = [
      ...accounts.map((account) => ({
        workspace_id: workspaceId,
        run_id: runId,
        account_domain: account.domain,
        source_name: account.sourceName ?? 'unknown',
        source_url: account.sourceUrl ?? account.websiteUrl ?? null,
        observation_type: 'account',
        verified: Boolean(account.domain),
        confidence: Number(account.evidence?.shopifyConfidence ?? 1),
        payload: account,
      })),
      ...signals.map((signal) => ({
        workspace_id: workspaceId,
        run_id: runId,
        account_domain: signal.accountDomain,
        source_name: signal.sourceName ?? 'unknown',
        source_url: signal.sourceUrl ?? null,
        observation_type: `signal:${signal.type}`,
        verified: ['job','storefront','technology'].includes(signal.type),
        confidence: signal.confidence ?? null,
        payload: { ...signal, offerProfileId },
      })),
      ...qualifications.map((qualification) => ({
        workspace_id: workspaceId,
        run_id: runId,
        account_domain: qualification.accountDomain,
        source_name: 'offer-profile-qualification',
        source_url: qualification.primaryJob?.sourceUrl ?? null,
        observation_type: 'qualification',
        verified: true,
        confidence: qualification.scores?.evidenceConfidence ?? null,
        payload: qualification,
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
      metadata: { ...metadata, offerProfileId },
    }).eq('id', runId).eq('workspace_id', workspaceId), 'complete_discovery_run');

    return {
      runId,
      workspaceId,
      offerProfileId,
      status,
      accountCount: accounts.length,
      signalCount: signals.length,
      qualificationCount: qualifications.length,
      scoringSnapshotCount: scoringRows.length,
      errorCount: errors.length,
      storedAccounts,
      accountIdByDomain: Object.fromEntries(accountIdByDomain),
    };
  } catch (error) {
    await client.from('discovery_runs').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_count: Math.max(1, errors.length),
      metadata: { ...metadata, offerProfileId },
    }).eq('id', runId).eq('workspace_id', workspaceId);
    throw error;
  }
}
