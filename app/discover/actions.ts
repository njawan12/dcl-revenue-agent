'use server';

import crypto from 'node:crypto';
import { redirect } from 'next/navigation';
import { buildDurableJob, enqueueDurableJob } from '../../lib/jobs.js';
import { executeDiscoveryJob } from '../../lib/jobs/discovery-worker.js';
import { createAdminClient } from '../../lib/supabase/admin';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

export async function queueDiscovery(formData: FormData) {
  const workspace = await requireActiveWorkspace();
  if (!['owner','admin','member'].includes(workspace.role)) redirect('/discover?error=operator_required');
  const offerProfileId = String(formData.get('offerProfileId') || '').trim();
  if (!offerProfileId) redirect('/discover?error=offer_profile_required');
  const supabase = await createClient();
  try {
    const job = buildDurableJob({
      workspaceId: workspace.id,
      jobType: 'discovery',
      scope: { offerProfileId },
      payload: { offerProfileId },
      maxAttempts: 3,
    });
    const queued = await enqueueDurableJob(supabase, job);
    redirect(`/discover?notice=${encodeURIComponent(queued.status === 'succeeded' ? 'This offer-profile run already completed.' : 'Hiring-led discovery queued. No outbound sending is attached to this job.')}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'queue_failed';
    redirect(`/discover?error=${encodeURIComponent(message)}`);
  }
}

export async function runControlledDiscovery(formData:FormData){
  const workspace=await requireActiveWorkspace();
  if(!['owner','admin'].includes(workspace.role)) redirect('/discover?error=workspace_admin_required');
  const offerProfileId=String(formData.get('offerProfileId')||'').trim();
  if(!offerProfileId) redirect('/discover?error=offer_profile_required');
  if(!process.env.CRUSTDATA_API_KEY) redirect('/discover?error=CRUSTDATA_API_KEY%20is%20not%20configured%20on%20Revenue%20Agent');
  const admin=createAdminClient();
  try{
    const result=await executeDiscoveryJob(admin,{
      id:crypto.randomUUID(),
      workspace_id:workspace.id,
      job_type:'discovery',
      lease_token:'owner-controlled-run',
      payload:{offerProfileId,controlled:true},
    },process.env);
    redirect(`/discover?notice=${encodeURIComponent(`Controlled run complete: ${result.jobCount} jobs, ${result.verifiedBuyerCount} verified buyers, ${result.draftCount} held drafts, ${Number(result.crustdataCreditsUsed||0).toFixed(2)} Crustdata credits.`)}`);
  }catch(error){
    const message=error instanceof Error?error.message:'controlled_run_failed';
    redirect(`/discover?error=${encodeURIComponent(message)}`);
  }
}
