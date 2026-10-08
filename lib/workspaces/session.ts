import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../supabase/server';

export type UserWorkspace = {
  id: string;
  name: string;
  slug: string;
  planKey: string;
  role: string;
};

export async function listUserWorkspaces(): Promise<UserWorkspace[]> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return [];
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role, workspace_id, workspaces!inner(id,name,slug,plan_key)')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`workspace_list:${error.message}`);
  return (data || []).map((row: any) => ({
    id: row.workspaces.id,
    name: row.workspaces.name,
    slug: row.workspaces.slug,
    planKey: row.workspaces.plan_key,
    role: row.role,
  }));
}

export async function getActiveWorkspace() {
  const workspaces = await listUserWorkspaces();
  if (!workspaces.length) return null;
  const cookieStore = await cookies();
  const requested = cookieStore.get('dcl_workspace')?.value;
  return workspaces.find((workspace) => workspace.id === requested) || workspaces[0];
}

export async function requireActiveWorkspace() {
  const workspace = await getActiveWorkspace();
  if (!workspace) redirect('/onboarding');
  return workspace;
}
