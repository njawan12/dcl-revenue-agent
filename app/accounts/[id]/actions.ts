'use server';

import { createHash } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireActiveWorkspace } from '../../../lib/workspaces/session';
import { researchBuyerContacts } from '../../../lib/buyers/orchestrator';
import { persistBuyerResearch } from '../../../lib/db/contacts';
import { validateDraft } from '../../../lib/outreach/guardrails';

function requireOperator(role: string) {
  if (!['owner','admin','member'].includes(role)) throw new Error('workspace_operator_required');
}

export async function researchBuyers(formData: FormData) {
  const accountId = String(formData.get('accountId') || '');
  const workspace = await requireActiveWorkspace();
  requireOperator(workspace.role);
  if (!accountId) throw new Error('account_id_required');

  const supabase = await createClient();
  const { data: account, error } = await supabase
    .from('accounts')
    .select('id,domain,suggested_buyer_role,qualification_inputs')
    .eq('workspace_id', workspace.id)
    .eq('id', accountId)
    .single();
  if (error || !account) throw new Error('account_not_found');

  if (!process.env.PROSPEO_API_KEY && !process.env.HUNTER_API_KEY) {
    redirect(`/accounts/${accountId}?error=${encodeURIComponent('Configure PROSPEO_API_KEY or HUNTER_API_KEY to research buyers.')}`);
  }

  const result = await researchBuyerContacts({
    account: { domain: account.domain },
    qualification: { suggestedBuyerRole: account.suggested_buyer_role, inputs: account.qualification_inputs || {} },
    prospeoApiKey: process.env.PROSPEO_API_KEY,
    hunterApiKey: process.env.HUNTER_API_KEY,
  });

  await persistBuyerResearch(supabase, { workspaceId: workspace.id, accountId, result });
  revalidatePath(`/accounts/${accountId}`);
  redirect(`/accounts/${accountId}?notice=${encodeURIComponent(result.outreachReady ? 'Verified buyer found.' : 'Buyer research completed; no verified email found yet.')}`);
}

export async function prepareOutreach(formData: FormData) {
  const accountId = String(formData.get('accountId') || '');
  const workspace = await requireActiveWorkspace();
  requireOperator(workspace.role);
  if (!accountId) throw new Error('account_id_required');

  const supabase = await createClient();
  const [{ data: account }, { data: signals }, { data: contacts }, { data: proofs }] = await Promise.all([
    supabase.from('accounts').select('id,name,domain,country,recommended_motion,suppressed').eq('workspace_id', workspace.id).eq('id', accountId).maybeSingle(),
    supabase.from('signals').select('id,signal_type,title,source_name,source_url,observed_at,confidence,evidence').eq('workspace_id', workspace.id).eq('account_id', accountId).order('observed_at', { ascending:false }).limit(5),
    supabase.from('contacts').select('id,first_name,last_name,full_name,title,email,email_verified,verification_source,provider,is_primary_buyer').eq('workspace_id', workspace.id).eq('account_id', accountId).eq('is_primary_buyer', true).limit(1),
    supabase.from('proof_points').select('id,client_name,approved_claim,evidence_reference,service_tags').eq('workspace_id', workspace.id).eq('approved', true).limit(5),
  ]);

  if (!account) redirect(`/accounts/${accountId}?error=${encodeURIComponent('Account not found in this workspace.')}`);
  const contact = contacts?.[0];
  const evidence = signals || [];
  if (account.suppressed) redirect(`/accounts/${accountId}?error=${encodeURIComponent('This account is suppressed. Outreach preparation is blocked.')}`);
  if (!evidence.length) redirect(`/accounts/${accountId}?error=${encodeURIComponent('Observed evidence is required before outreach can be prepared.')}`);
  if (!contact?.email_verified || !contact.email) redirect(`/accounts/${accountId}?error=${encodeURIComponent('A verified primary business contact is required before outreach can be prepared.')}`);

  const trigger = evidence[0];
  const firstName = contact.first_name?.trim() || contact.full_name?.trim()?.split(/\s+/)[0] || 'there';
  const reasonToContact = `${trigger.title} — observed via ${trigger.source_name || 'persisted source'}${trigger.observed_at ? ` on ${new Date(trigger.observed_at).toISOString().slice(0,10)}` : ''}.`;
  const draft = {
    subject: `Quick thought for ${account.name}`,
    body: `Hi ${firstName},\n\nI’m reaching out because we noticed ${trigger.title}. I thought it could be useful to compare notes on what this may mean for ${account.name}'s ecommerce priorities.\n\nIf it is relevant, happy to share a few specific observations.\n\nBest,\nNouman`,
    claims: [] as string[],
  };

  const guard = validateDraft(draft, { reasonToContact, contact: { emailVerified: contact.email_verified }, suppressed: account.suppressed, approvedProofPoints: proofs || [] });
  if (!guard.valid) redirect(`/accounts/${accountId}?error=${encodeURIComponent(`Draft held: ${guard.errors.join(', ')}`)}`);

  const evidenceSnapshot = evidence.map((signal:any) => ({ id: signal.id, type: signal.signal_type, title: signal.title, sourceName: signal.source_name, sourceUrl: signal.source_url, observedAt: signal.observed_at, confidence: signal.confidence }));
  const recipientSnapshot = { contactId: contact.id, name: contact.full_name || [contact.first_name, contact.last_name].filter(Boolean).join(' '), title: contact.title, email: contact.email, emailVerified: true, verificationSource: contact.verification_source || contact.provider || null };
  const proofSnapshot = (proofs || []).map((proof:any) => ({ proofPointId: proof.id, clientName: proof.client_name, approvedClaim: proof.approved_claim, evidenceReference: proof.evidence_reference, serviceTags: proof.service_tags }));
  const complianceSnapshot = { version: 'held-outbox-v1', accountCountry: account.country || null, verifiedBusinessContact: true, suppressed: false, humanApprovalRequired: true, autonomousSendEnabled: false, jurisdictionReviewStatus: 'required_before_send' };
  const hashPayload = JSON.stringify({ subject: draft.subject, body: draft.body, reasonToContact, evidenceSnapshot, proofSnapshot, recipientSnapshot, complianceSnapshot });
  const contentHash = createHash('sha256').update(hashPayload).digest('hex');

  const { data, error } = await supabase.rpc('create_held_outreach_revision', {
    p_account_id: account.id, p_contact_id: contact.id, p_subject: draft.subject, p_body: draft.body,
    p_motion: account.recommended_motion || 'research-first', p_reason_to_contact: reasonToContact,
    p_evidence_snapshot: evidenceSnapshot, p_proof_snapshot: proofSnapshot, p_recipient_snapshot: recipientSnapshot,
    p_compliance_snapshot: complianceSnapshot, p_content_hash: contentHash,
  });
  if (error || !data?.[0]?.outreach_id) redirect(`/accounts/${accountId}?error=${encodeURIComponent('Could not create the held outreach revision. No message was sent.')}`);

  revalidatePath(`/accounts/${accountId}`);
  revalidatePath('/outreach');
  redirect(`/accounts/${accountId}?notice=${encodeURIComponent('Outreach draft prepared and held for human review. Nothing was sent.')}`);
}
