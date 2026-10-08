'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

function reviewRedirect(message: string, kind: 'notice'|'error' = 'notice'): never {
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

  // Keep a tenant-scoped preflight so stale browser tabs get a useful message.
  // The RPC repeats all safety checks under a row lock and commits the audit decision
  // plus held-outbox state atomically. It contains no send/provider operation.
  const { data: outreach } = await supabase
    .from('outreach')
    .select('id,current_revision_id')
    .eq('workspace_id', workspace.id)
    .eq('id', outreachId)
    .maybeSingle();
  if (!outreach) reviewRedirect('This held draft no longer exists in the active workspace.', 'error');
  if (outreach.current_revision_id !== revisionId) reviewRedirect('This draft changed after the review opened. Review the newest revision instead.', 'error');

  const { error } = await supabase.rpc('review_outreach_revision', {
    p_outreach_id: outreachId,
    p_revision_id: revisionId,
    p_decision: decision,
    p_decision_note: note || null,
  });
  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (message.includes('stale')) reviewRedirect('This draft changed. Review the newest revision instead.', 'error');
    if (message.includes('verified recipient')) reviewRedirect('The recipient is no longer safe to approve as verified.', 'error');
    if (message.includes('suppressed')) reviewRedirect('This outreach is suppressed and cannot be approved.', 'error');
    reviewRedirect('The review could not be committed safely. Nothing was sent.', 'error');
  }

  revalidatePath('/outreach');
  revalidatePath('/');
  reviewRedirect(decision === 'approved' ? 'Exact revision approved. It remains held; nothing was sent.' : 'Revision rejected and kept out of sending.');
}
