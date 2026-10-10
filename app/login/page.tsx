import Link from 'next/link';
import { signIn, signUp } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  const error = params.error;
  const notice = params.notice;
  const next = params.next || '/';
  const mode = params.mode === 'signup' ? 'signup' : 'signin';
  const isSignup = mode === 'signup';

  return <main style={{maxWidth:520,margin:'80px auto',padding:'0 24px'}}>
    <div className="eyebrow">DCL Revenue Agent</div>
    <h1>{isSignup ? 'Create your account' : 'Sign in to your workspace'}</h1>
    <p>{isSignup
      ? 'Use your work email and choose a password. After confirming your email, you’ll be taken into the Revenue Agent.'
      : 'Open your private Revenue Agent workspace.'}</p>

    {error ? <div className="panel" style={{marginTop:20}}><strong>Could not continue</strong><p>{error}</p></div> : null}
    {notice ? <div className="panel" style={{marginTop:20}}><strong>One more step</strong><p>{notice}</p></div> : null}

    {isSignup ? <form action={signUp} className="panel" style={{marginTop:24,display:'grid',gap:14}}>
      <label>Email address<input required autoComplete="email" type="email" name="email" style={{display:'block',width:'100%',marginTop:6,padding:12}}/></label>
      <label>Create password<input required autoComplete="new-password" minLength={8} type="password" name="password" style={{display:'block',width:'100%',marginTop:6,padding:12}}/></label>
      <label>Confirm password<input required autoComplete="new-password" minLength={8} type="password" name="confirmPassword" style={{display:'block',width:'100%',marginTop:6,padding:12}}/></label>
      <button className="primary" type="submit">Create account</button>
      <p style={{margin:0}}>Already have an account? <Link href="/login">Sign in</Link></p>
    </form> : <form action={signIn} className="panel" style={{marginTop:24,display:'grid',gap:14}}>
      <input type="hidden" name="next" value={next}/>
      <label>Email address<input required autoComplete="email" type="email" name="email" style={{display:'block',width:'100%',marginTop:6,padding:12}}/></label>
      <label>Password<input required autoComplete="current-password" minLength={8} type="password" name="password" style={{display:'block',width:'100%',marginTop:6,padding:12}}/></label>
      <button className="primary" type="submit">Sign in</button>
      <p style={{margin:0}}>New here? <Link href="/login?mode=signup">Create an account</Link></p>
    </form>}
  </main>;
}
