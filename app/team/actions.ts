'use server';

import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

const allowedRoles=new Set(['admin','member','viewer']);
function clean(v:FormDataEntryValue|null,max=120){return String(v||'').trim().slice(0,max);}

export async function updateMemberRole(formData:FormData){
  const workspace=await requireActiveWorkspace();
  if(!['owner','admin'].includes(workspace.role)) redirect('/team?error=Only%20owners%20and%20admins%20can%20change%20roles');
  const userId=clean(formData.get('userId'),80); const role=clean(formData.get('role'),20);
  if(!userId||!allowedRoles.has(role)) redirect('/team?error=Invalid%20role%20change');
  const supabase=await createClient();
  const {data:target}=await supabase.from('workspace_members').select('role').eq('workspace_id',workspace.id).eq('user_id',userId).maybeSingle();
  if(target?.role==='owner') redirect('/team?error=Owner%20role%20cannot%20be%20changed%20here');
  const {error}=await supabase.from('workspace_members').update({role}).eq('workspace_id',workspace.id).eq('user_id',userId);
  if(error) redirect(`/team?error=${encodeURIComponent(error.message)}`);
  redirect('/team?notice=Role%20updated');
}

export async function removeMember(formData:FormData){
  const workspace=await requireActiveWorkspace();
  if(!['owner','admin'].includes(workspace.role)) redirect('/team?error=Only%20owners%20and%20admins%20can%20remove%20members');
  const userId=clean(formData.get('userId'),80); if(!userId) redirect('/team?error=Missing%20member');
  const supabase=await createClient();
  const {data:target}=await supabase.from('workspace_members').select('role').eq('workspace_id',workspace.id).eq('user_id',userId).maybeSingle();
  if(target?.role==='owner') redirect('/team?error=Workspace%20owner%20cannot%20be%20removed');
  const {error}=await supabase.from('workspace_members').delete().eq('workspace_id',workspace.id).eq('user_id',userId);
  if(error) redirect(`/team?error=${encodeURIComponent(error.message)}`);
  redirect('/team?notice=Member%20removed');
}
