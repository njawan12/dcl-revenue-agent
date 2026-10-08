'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

function done(message: string): never { redirect(`/settings?notice=${encodeURIComponent(message)}`); }
function fail(message: string): never { redirect(`/settings?error=${encodeURIComponent(message)}`); }

export async function suppressDomain(formData: FormData) {
  const workspace = await requireActiveWorkspace();
  if (!['owner','admin'].includes(workspace.role)) fail('Owner or admin access is required.');
  const domain=String(formData.get('domain')||'').trim().toLowerCase();
  const reason=String(formData.get('reason')||'').trim();
  const accountId=String(formData.get('accountId')||'').trim();
  if (!domain || !reason || !accountId) fail('Domain, account context and reason are required.');
  const supabase=await createClient();
  const { error }=await supabase.rpc('add_suppression',{p_scope:'domain',p_account_id:accountId,p_contact_id:null,p_value:domain,p_reason:reason,p_source:'operator'});
  if(error) fail('Suppression could not be recorded safely.');
  revalidatePath('/settings'); revalidatePath('/outreach'); revalidatePath('/pipeline');
  done(`${domain} is now suppressed from outreach in this workspace.`);
}

export async function liftSuppression(formData: FormData) {
  const workspace=await requireActiveWorkspace();
  if(!['owner','admin'].includes(workspace.role)) fail('Owner or admin access is required.');
  const id=String(formData.get('suppressionId')||'');
  const reason=String(formData.get('liftReason')||'').trim();
  if(!id || !reason) fail('A suppression and lift reason are required.');
  const supabase=await createClient();
  const { error }=await supabase.rpc('lift_suppression',{p_suppression_id:id,p_reason:reason});
  if(error) fail('Suppression could not be lifted safely.');
  revalidatePath('/settings'); revalidatePath('/outreach'); revalidatePath('/pipeline');
  done('Suppression lifted. The audit history remains preserved.');
}
