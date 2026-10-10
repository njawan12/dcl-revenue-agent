import Link from 'next/link';
import { createClient } from '../../lib/supabase/server';
import { updatePassword } from './actions';

export default async function ResetPasswordPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const params=await searchParams;
  const supabase=await createClient();
  const {data}=await supabase.auth.getClaims();
  const hasSession=Boolean(data?.claims?.sub);
  return <main className="loginShell">
    <section className="loginBrandPanel"><div className="loginBrand"><span className="brandMark">R</span><span>Revenue Agent</span></div><div className="loginPitch"><div className="eyebrow">Secure account recovery</div><h1>Choose a new password and get back to your workspace.</h1><p>Your reset link must create a valid recovery session before a password can be changed.</p></div><small>Revenue Agent never asks for your old password here.</small></section>
    <section className="loginFormPanel"><div className="loginFormCard"><div className="eyebrow">Password reset</div><h2>{hasSession?'Create a new password':'Reset link required'}</h2>{params.error?<div className="commandAlert" style={{marginTop:18}}><strong>Could not update password</strong><span>{params.error}</span></div>:null}
      {hasSession?<form action={updatePassword} className="loginForm"><label>New password<input required autoComplete="new-password" minLength={8} type="password" name="password"/></label><label>Confirm password<input required autoComplete="new-password" minLength={8} type="password" name="confirmPassword"/></label><button className="primary" type="submit">Update password</button></form>:<div className="loginForm"><p>Open the password-reset link from your email. If it expired, request another one.</p><Link className="primary" style={{textAlign:'center'}} href="/login?mode=forgot">Request a new reset link</Link></div>}
    </div></section>
  </main>;
}
