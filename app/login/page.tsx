import Link from 'next/link';
import { requestPasswordReset, signIn, signUp } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  const error = params.error;
  const notice = params.notice;
  const next = params.next || '/';
  const mode = params.mode === 'signup' ? 'signup' : params.mode === 'forgot' ? 'forgot' : 'signin';
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';

  return <main className="loginShell">
    <section className="loginBrandPanel"><div className="loginBrand"><span className="brandMark">R</span><span>Revenue Agent</span></div><div className="loginPitch"><div className="eyebrow">Signal-led prospecting</div><h1>Know who to contact, why now, and what to say.</h1><p>Turn fresh hiring activity into qualified sales opportunities without wasting time on cold lists.</p><div className="loginPoints"><span><i/>Fresh hiring signals first</span><span><i/>Right buyer and verified work email</span><span><i/>Personalized message ready for your approval</span></div></div><small>Nothing is sent automatically.</small></section>
    <section className="loginFormPanel"><div className="loginFormCard"><div className="eyebrow">{isSignup?'Create account':isForgot?'Password recovery':'Welcome back'}</div><h2>{isSignup ? 'Start your workspace' : isForgot ? 'Reset your password' : 'Sign in'}</h2><p>{isSignup ? 'Use your work email and choose a password.' : isForgot ? 'Enter your work email. We’ll send a secure reset link if the account exists.' : 'Open your Revenue Agent workspace.'}</p>
      {error ? <div className="commandAlert" style={{marginTop:18}}><strong>Could not continue</strong><span>{error}</span></div> : null}
      {notice ? <div className="commandAlert" style={{marginTop:18}}><strong>Check your email</strong><span>{notice}</span></div> : null}
      {isSignup ? <form action={signUp} className="loginForm"><label>Email address<input required autoComplete="email" type="email" name="email"/></label><label>Create password<input required autoComplete="new-password" minLength={8} type="password" name="password"/></label><label>Confirm password<input required autoComplete="new-password" minLength={8} type="password" name="confirmPassword"/></label><button className="primary" type="submit">Create account</button><p>Already have an account? <Link href="/login">Sign in</Link></p></form> : isForgot ? <form action={requestPasswordReset} className="loginForm"><label>Email address<input required autoComplete="email" type="email" name="email"/></label><button className="primary" type="submit">Send reset link</button><p><Link href="/login">Back to sign in</Link></p></form> : <form action={signIn} className="loginForm"><input type="hidden" name="next" value={next}/><label>Email address<input required autoComplete="email" type="email" name="email"/></label><label>Password<input required autoComplete="current-password" minLength={8} type="password" name="password"/></label><div style={{textAlign:'right'}}><Link href="/login?mode=forgot">Forgot password?</Link></div><button className="primary" type="submit">Sign in</button><p>New here? <Link href="/login?mode=signup">Create an account</Link></p></form>}
    </div></section>
  </main>;
}
