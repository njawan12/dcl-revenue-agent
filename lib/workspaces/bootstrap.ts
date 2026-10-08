import 'server-only';
import { createClient } from '../supabase/server';

export async function getBootstrapEligibility() {
  const workspaceId = process.env.BOOTSTRAP_WORKSPACE_ID || '';
  const allowedEmail = (process.env.BOOTSTRAP_OWNER_EMAIL || '').trim().toLowerCase();
  if (!workspaceId || !allowedEmail) return { enabled: false, eligible: false, workspaceId: null as string | null };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = String(data?.claims?.sub || '');
  const email = String(data?.claims?.email || '').trim().toLowerCase();

  return {
    enabled: true,
    eligible: Boolean(userId && email && email === allowedEmail),
    workspaceId,
    userId: userId || null,
    email: email || null,
  };
}
