'use server';

import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

function clean(value: FormDataEntryValue | null, max = 120) {
  return String(value || '').trim().slice(0, max);
}

export async function saveGlobalView(formData: FormData) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const name = clean(formData.get('name'));
  if (!name) redirect('/data?error=Give%20the%20view%20a%20name');
  const filters = {
    q: clean(formData.get('q'), 160),
    type: clean(formData.get('type'), 32) || 'all',
  };
  const { error } = await supabase.from('saved_views').insert({
    workspace_id: workspace.id,
    owner_user_id: auth.user.id,
    name,
    entity_type: 'global',
    filters,
    shared: formData.get('shared') === 'on',
  });
  if (error) redirect(`/data?error=${encodeURIComponent(error.message)}`);
  redirect('/data?notice=View%20saved');
}

export async function deleteGlobalView(formData: FormData) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const id = clean(formData.get('id'), 80);
  if (!id) redirect('/data?error=Missing%20view');
  const { error } = await supabase.from('saved_views').delete().eq('workspace_id', workspace.id).eq('id', id);
  if (error) redirect(`/data?error=${encodeURIComponent(error.message)}`);
  redirect('/data?notice=View%20deleted');
}
