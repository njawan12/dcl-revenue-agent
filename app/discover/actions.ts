'use server';

import { redirect } from 'next/navigation';
import { buildDurableJob, enqueueDurableJob } from '../../lib/jobs.js';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

export async function queueDiscovery(formData: FormData) {
  const workspace = await requireActiveWorkspace();
  if (!['owner','admin','member'].includes(workspace.role)) redirect('/discover?error=operator_required');

  const source = String(formData.get('source') || 'commerce-discovery').trim().slice(0,80);
  const query = String(formData.get('query') || 'shopify brands').trim().slice(0,160);
  const country = String(formData.get('country') || '').trim().slice(0,2).toUpperCase();
  const supabase = await createClient();

  try {
    const job = buildDurableJob({
      workspaceId: workspace.id,
      jobType: 'discovery',
      scope: { source, query, country: country || null },
      payload: { source, query, country: country || null, requestedBy: workspace.userId },
      maxAttempts: 3,
    });
    const queued = await enqueueDurableJob(supabase, job);
    redirect(`/discover?notice=${encodeURIComponent(queued.status === 'succeeded' ? 'This discovery scope already completed.' : 'Discovery queued safely. You can leave this page while the worker processes it.')}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'queue_failed';
    redirect(`/discover?error=${encodeURIComponent(message)}`);
  }
}
