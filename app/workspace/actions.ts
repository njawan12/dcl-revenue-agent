'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { listUserWorkspaces } from '../../lib/workspaces/session';

export async function switchWorkspace(formData: FormData) {
  const workspaceId = String(formData.get('workspaceId') || '');
  const memberships = await listUserWorkspaces();
  if (!memberships.some((workspace) => workspace.id === workspaceId)) {
    throw new Error('workspace_access_denied');
  }
  const cookieStore = await cookies();
  cookieStore.set('dcl_workspace', workspaceId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  redirect('/');
}
