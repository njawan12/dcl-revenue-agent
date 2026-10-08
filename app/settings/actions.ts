'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

export async function updateWorkspaceSettings(formData: FormData) {
  const workspace = await requireActiveWorkspace();
  if (!['owner','admin'].includes(workspace.role)) throw new Error('workspace_admin_required');

  const services = formData.getAll('services').map(String).filter(Boolean);
  const targetCountries = formData.getAll('countries').map(String).filter(Boolean);
  const targetIndustries = formData.getAll('industries').map(String).filter(Boolean);
  const outreachRules = {
    requireReasonToContact: formData.get('requireReasonToContact') === 'on',
    requireVerifiedEmail: formData.get('requireVerifiedEmail') === 'on',
    requireHumanApproval: formData.get('requireHumanApproval') === 'on',
  };

  const supabase = await createClient();
  const { error } = await supabase.from('workspace_sales_config').update({
    services,
    target_countries: targetCountries,
    target_industries: targetIndustries,
    outreach_rules: outreachRules,
    updated_at: new Date().toISOString(),
  }).eq('workspace_id', workspace.id);
  if (error) throw new Error(`workspace_settings:${error.message}`);

  revalidatePath('/settings');
  revalidatePath('/discover');
  revalidatePath('/');
}
