import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { confirmEmail } from '../../../lib/auth/confirmation';

export async function GET(request: NextRequest) {
  const redirectTo = request.nextUrl.clone();
  redirectTo.search = '';
  const supabase = await createClient();
  if (await confirmEmail(supabase.auth, request.nextUrl.searchParams)) {
    redirectTo.pathname = '/onboarding';
    return NextResponse.redirect(redirectTo);
  }

  redirectTo.pathname = '/login';
  redirectTo.searchParams.set('error', 'Email confirmation failed or expired. Please sign in or request a new confirmation.');
  return NextResponse.redirect(redirectTo);
}
