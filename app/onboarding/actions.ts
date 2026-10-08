'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}

export async function createWorkspace(formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  const rawSlug = String(formData.get('slug') || '').trim();
  const slug = slugify(rawSlug || name);
  const services = formData.getAll('services').map(String).filter(Boolean);
  const countries = formData.getAll('countries').map(String).filter(Boolean);
  const industries = formData.getAll('industries').map(String).filter(Boolean);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_workspace_with_owner', {
    workspace_name: name,
    workspace_slug: slug,
    starter_services: services,
    starter_countries: countries.length ? countries : ['US','CA'],
    starter_industries: industries,
  });
  if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);

  const workspaceId = String(data || '');
  const cookieStore = await cookies();
  cookieStore.set('dcl_workspace', workspaceId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  redirect('/');
}
