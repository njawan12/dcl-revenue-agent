import { signIn, signUp } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  const error = params.error;
  const next = params.next || '/';
  return <main style={{maxWidth:520,margin:'80px auto',padding:'0 24px'}}>
    <div className="eyebrow">Commerce revenue intelligence</div>
    <h1>Sign in to your workspace</h1>
    <p>Discover Shopify accounts, rank the ones worth pursuing, and turn evidence into relevant outreach.</p>
    {error ? <div className="panel" style={{marginTop:20}}><strong>Could not continue</strong><p>{error}</p></div> : null}
    <form className="panel" style={{marginTop:24,display:'grid',gap:14}}>
      <input type="hidden" name="next" value={next}/>
      <label>Email<input required type="email" name="email" style={{display:'block',width:'100%',marginTop:6,padding:12}}/></label>
      <label>Password<input required minLength={8} type="password" name="password" style={{display:'block',width:'100%',marginTop:6,padding:12}}/></label>
      <div style={{display:'flex',gap:10}}>
        <button className="primary" formAction={signIn}>Sign in</button>
        <button className="ghost" formAction={signUp}>Create account</button>
      </div>
    </form>
  </main>;
}
