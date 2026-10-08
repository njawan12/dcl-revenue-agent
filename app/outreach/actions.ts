'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

function reviewRedirect(message: string, kind: 'notice'|'error' = 'notice') {
  redirect(`/outreach?${kind}=${encodeURIComponent(message)}`);
}

export async function decideOutreach(formData: FormData) {
  const outreachId = String(formData.get('outreachId') || '');
  const revisionId = String(formData.get('revisionId') || '');
  const decision = String(formData.get('decision') || '');
  const note = String(formData.get('note') || '').trim().slice(0, 1000);
  const workspace = await requireActiveWorkspace();
  if (!['owner','admin'].includes(workspace.role)) throw new Error('workspace_admin_required');
  if (!outreachId || !revisionId || !['approved','rejected'].includes(decision)) throw new Error('invalid_review_request');

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('authentication_required');

  const { data: outreach } = await supabase
    .from('outreach')
    .select('id,current_revision_id,status')
    .eq('workspace_id', workspace.id)
    .eq('id', outreachId)
    .maybeSingle();
  if (!outreach) reviewRedirect('This held draft no longer exists in the active workspace.', 'error');
  if (outreach.current_revision_id !== revisionId) reviewRedirect('This draft changed after the review opened. Review the newest revision instead.', 'error');

  const { data: revision } = await supabase
    .from('outreach_revisions')
    .select('id,body,reason_to_contact,evidence_snapshot,recipient_snapshot,compliance_snapshot')
    .eq('workspace_id', workspace.id)
    .eq('outreach_id', outreachId)
    .eq('id', revisionId)
    .maybeSingle();
  if (!revision) reviewRedirect('The exact revision could not be verified. Nothing was approved.', 'error');

  const recipient = revision.recipient_snapshot || {};
  const compliance = revision.compliance_snapshot || {};
  const evidence = Array.isArray(revision.evidence_snapshot) ? revision.evidence_snapshot : [];
  if (!revision.body?.trim() || !revision.reason_to_contact?.trim() || !evidence.length) reviewRedirect('This revision is missing required evidence or content and cannot be approved.', 'error');
  if (!recipient.email || recipient.emailVerified !== true) reviewRedirect('The recipient is not a verified business contact. Approval is blocked.', 'error');
  if (compliance.suppressed === true || compliance.humanApprovalRequired !== true || compliance.autonomousSendEnabled !== false) reviewRedirect('The compliance snapshot is not safe for approval.', 'error');

  const { error: approvalError } = await supabase.from('outreach_approvals').insert({
    workspace_id: workspace.id,
    outreach_id: outreachId,
    revision_id: revisionId,
    decision,
    decided_by: userData.user.id,
    decision_note: note || null,
  });
  if (approvalError) reviewRedirect('Could not record the review decision. Nothing was sent.', 'error');

  const update = decision === 'approved'
    ? { status: 'approved', approved_revision_id: revisionId, approved_at: new Date().toISOString(), approved_by: userData.user.id }
    : { status: 'paused', approved_revision_id: null, approved_at: null, approved_by: null };
  const { error: updateError } = await supabase
    .from('outreach')
    .update(update)
    .eq('workspace_id', workspace.id)
    .eq('id', outreachId)
    .eq('current_revision_id', revisionId);
  if (updateError) reviewRedirect('The decision was recorded but the held-outbox state needs attention. Nothing was sent.', 'error');

  revalidatePath('/outreach');
  reviewRedirect(decision === 'approved' ? 'Exact revision approved. It remains held; nothing was sent.' : 'Revision rejected and kept out of sending.');
}
