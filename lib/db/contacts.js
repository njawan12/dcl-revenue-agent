import { recordProviderUsage } from './workspaces.js';

function rowFromCandidate({ workspaceId, accountId, candidate, primary }) {
  const derivedFullName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || null;
  return {
    workspace_id: workspaceId,
    account_id: accountId,
    provider: candidate.provider ?? null,
    provider_person_id: candidate.providerPersonId != null ? String(candidate.providerPersonId) : null,
    first_name: candidate.firstName ?? null,
    last_name: candidate.lastName ?? null,
    full_name: candidate.fullName ?? derivedFullName,
    title: candidate.title ?? null,
    seniority: candidate.seniority ?? null,
    departments: candidate.departments ?? [],
    linkedin_url: candidate.linkedinUrl ?? null,
    email: candidate.email ?? null,
    email_source: candidate.emailProvider ?? candidate.verificationSource ?? candidate.provider ?? null,
    email_verified: Boolean(candidate.emailVerified && candidate.email),
    email_confidence: candidate.emailConfidence ?? candidate.sourceConfidence ?? null,
    verification_status: candidate.verificationStatus ?? null,
    verification_source: candidate.verificationSource ?? null,
    email_provider: candidate.emailProvider ?? null,
    last_verified_at: candidate.lastVerifiedAt ?? (candidate.emailVerified ? new Date().toISOString() : null),
    buyer_score: candidate.buyerScore ?? candidate.ranking?.score ?? null,
    buyer_reason: candidate.buyerReason ?? candidate.ranking?.reason ?? null,
    source_url: candidate.linkedinUrl ?? null,
    is_primary_buyer: Boolean(primary),
    metadata: candidate.metadata ?? {},
    updated_at: new Date().toISOString(),
  };
}

export async function persistBuyerResearch(client, { workspaceId, offerProfileId = null, accountId, result }) {
  if (!workspaceId) throw new Error('workspace_id_required');
  if (!accountId) throw new Error('account_id_required');

  const { error: clearError } = await client
    .from('contacts')
    .update({ is_primary_buyer:false, updated_at:new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('account_id', accountId);
  if (clearError) throw new Error(`clear_primary_buyer:${clearError.message ?? clearError}`);

  const primaryIdentity = result.primaryContact
    ? `${result.primaryContact.provider || ''}:${result.primaryContact.providerPersonId || result.primaryContact.fullName || ''}`
    : null;

  const rows = (result.candidates || []).filter((candidate) => candidate?.providerPersonId).map((candidate) => {
    const identity = `${candidate.provider || ''}:${candidate.providerPersonId || candidate.fullName || ''}`;
    return rowFromCandidate({ workspaceId, accountId, candidate, primary: identity === primaryIdentity });
  });

  let stored = [];
  if (rows.length) {
    const { data, error } = await client.from('contacts').upsert(rows, {
      onConflict:'workspace_id,account_id,provider,provider_person_id',
    }).select('id,provider,provider_person_id,full_name,first_name,last_name,title,email,email_verified,is_primary_buyer,linkedin_url');
    if (error) throw new Error(`persist_buyer_contacts:${error.message ?? error}`);
    stored = data ?? [];
  }

  for (const usage of result.usage || []) {
    await recordProviderUsage(client, {
      workspaceId,
      offerProfileId,
      provider:usage.provider,
      action:usage.action,
      units:usage.units,
      metadata:usage.metadata ?? {},
    });
  }

  const primaryStored = stored.find((row) => row.is_primary_buyer && row.email_verified && row.email) ?? null;
  return {
    candidateCount: rows.length,
    primaryBuyerFound: Boolean(primaryStored || result.primaryContact),
    outreachReady: Boolean(primaryStored || result.outreachReady),
    primaryStored,
    stored,
    providerErrors: result.errors ?? [],
  };
}
