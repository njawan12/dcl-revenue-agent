'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireActiveWorkspace } from '../../../lib/workspaces/session';
import { researchBuyerContacts } from '../../../lib/buyers/orchestrator';
import { persistBuyerResearch } from '../../../lib/db/contacts';

export async function researchBuyers(formData: FormData) {
  const accountId = String(formData.get('accountId') || '');
  const workspace = await requireActiveWorkspace();
  if (!['owner','admin'].includes(workspace.role)) throw new Error('workspace_admin_required');
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
    qualification: {
      suggestedBuyerRole: account.suggested_buyer_role,
      inputs: account.qualification_inputs || {},
    },
    prospeoApiKey: process.env.PROSPEO_API_KEY,
    hunterApiKey: process.env.HUNTER_API_KEY,
  });

  await persistBuyerResearch(supabase, {
    workspaceId: workspace.id,
    accountId,
    result,
  });

  revalidatePath(`/accounts/${accountId}`);
  redirect(`/accounts/${accountId}?notice=${encodeURIComponent(result.outreachReady ? 'Verified buyer found.' : 'Buyer research completed; no verified email found yet.')}`);
}
