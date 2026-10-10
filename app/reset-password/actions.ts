'use server';

import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');
  if (password.length < 8) redirect('/reset-password?error=Use%20at%20least%208%20characters');
  if (password !== confirmPassword) redirect('/reset-password?error=Passwords%20do%20not%20match');
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect('/login?error=Your%20reset%20link%20has%20expired.%20Request%20a%20new%20one.');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  redirect('/?notice=Password%20updated');
}
