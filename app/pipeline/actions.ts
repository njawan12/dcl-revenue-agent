'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';
import { validatePipelineInput } from '../../lib/pipeline/stages';

export async function updatePipeline(formData: FormData) {
  const workspace = await requireActiveWorkspace();
  if (!['owner','admin','member'].includes(workspace.role)) throw new Error('workspace_operator_required');
  const stage = String(formData.get('stage') || '');
  const nextAction = String(formData.get('nextAction') || '').trim();
  const due = String(formData.get('due') || '');
  const revision = Number(formData.get('revision'));
  const validation = validatePipelineInput({stage,nextAction,due,revision});
  if (validation) redirect(`/pipeline?error=${encodeURIComponent(validation)}`);
  const supabase = await createClient();
  const {error} = await supabase.rpc('update_native_pipeline', {
    p_workspace_id:workspace.id,p_account_id:String(formData.get('accountId') || ''),
    p_expected_revision:revision,p_stage:stage,p_next_action:nextAction,p_due:due || null,
  });
  if (error) redirect(`/pipeline?error=${encodeURIComponent('Could not save. Refresh to check for another edit, and confirm the account is not suppressed.')}`);
  revalidatePath('/pipeline'); revalidatePath('/');
  redirect('/pipeline?notice=Pipeline%20updated.');
}
