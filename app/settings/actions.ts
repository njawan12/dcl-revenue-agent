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
  const regionPolicyBasis: Record<string, unknown> = {};
  for (const region of ['US','CA','GB','EU']) {
    const reference = String(formData.get(`policyReference_${region}`) || '').trim().slice(0,500);
    regionPolicyBasis[region] = { status: reference && formData.get(`policyReviewed_${region}`) === 'on' ? 'verified' : 'unknown', reference };
  }
  const outreachRules = {
    requireReasonToContact: true,
    requireVerifiedEmail: true,
    requireHumanApproval: true,
    regionPolicyBasis,
  };
  const purpose = String(formData.get('collectionPurpose') || '').trim().slice(0,1000);
  if (!purpose) throw new Error('collection_purpose_required');

  const supabase = await createClient();
  const { error } = await supabase.from('workspace_sales_config').update({
    services,
    target_countries: targetCountries,
    target_industries: targetIndustries,
    outreach_rules: outreachRules,
    updated_at: new Date().toISOString(),
  }).eq('workspace_id', workspace.id);
  if (error) throw new Error(`workspace_settings:${error.message}`);

  const { error: governanceError } = await supabase.from('data_governance_policies').upsert({ workspace_id: workspace.id, purpose, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
  if (governanceError) throw new Error(`workspace_governance:${governanceError.message}`);
  revalidatePath('/settings');
  revalidatePath('/discover');
  revalidatePath('/');
}
