'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminClient } from '../../lib/supabase/admin';
import { getBootstrapEligibility } from '../../lib/workspaces/bootstrap';

export async function claimBootstrapWorkspace() {
  const eligibility = await getBootstrapEligibility();
  if (!eligibility.enabled || !eligibility.eligible || !eligibility.workspaceId || !eligibility.userId) {
    throw new Error('bootstrap_not_allowed');
  }

  const admin = createAdminClient();
  const { count, error: countError } = await admin
    .from('workspace_members')
    .select('workspace_id', { count: 'exact', head: true })
    .eq('workspace_id', eligibility.workspaceId);
  if (countError) throw new Error(`bootstrap_member_check:${countError.message}`);
  if ((count ?? 0) > 0) throw new Error('bootstrap_workspace_already_claimed');

  const { error } = await admin.from('workspace_members').insert({
    workspace_id: eligibility.workspaceId,
    user_id: eligibility.userId,
    role: 'owner',
  });
  if (error) throw new Error(`bootstrap_claim:${error.message}`);

  const cookieStore = await cookies();
  cookieStore.set('dcl_workspace', eligibility.workspaceId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  redirect('/');
}
