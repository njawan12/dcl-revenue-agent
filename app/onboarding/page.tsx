import { redirect } from 'next/navigation';
import { createWorkspace } from './actions';
import { listUserWorkspaces } from '../../lib/workspaces/session';

const services = ['Shopify development','CRO','UX/UI','Klaviyo / retention','Analytics','Subscriptions','QA','B2B'];
const industries = ['beauty','wellness','supplements','apparel','food-beverage','fitness','pet','home'];

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const existing = await listUserWorkspaces();
  if (existing.length) redirect('/');
  const params = await searchParams;
  return <main style={{maxWidth:760,margin:'60px auto',padding:'0 24px'}}>
    <div className="eyebrow">Set up your revenue engine</div>
    <h1>Create your first workspace</h1>
    <p>This tells the engine what your agency sells and which ecommerce businesses should rank highest.</p>
    {params.error ? <div className="panel"><strong>Could not create workspace</strong><p>{params.error}</p></div> : null}
    <form action={createWorkspace} className="panel" style={{display:'grid',gap:20,marginTop:24}}>
      <label>Agency / company name<input required name="name" style={{display:'block',width:'100%',marginTop:6,padding:12}}/></label>
      <label>Workspace slug<input name="slug" placeholder="my-agency" style={{display:'block',width:'100%',marginTop:6,padding:12}}/></label>
      <fieldset><legend>Services you want to sell</legend><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:10}}>{services.map(s=><label key={s}><input type="checkbox" name="services" value={s}/> {s}</label>)}</div></fieldset>
      <fieldset><legend>Primary markets</legend><div style={{display:'flex',gap:16,marginTop:10}}><label><input type="checkbox" name="countries" value="US" defaultChecked/> United States</label><label><input type="checkbox" name="countries" value="CA" defaultChecked/> Canada</label><label><input type="checkbox" name="countries" value="GB"/> United Kingdom</label></div></fieldset>
      <fieldset><legend>Preferred verticals</legend><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:10}}>{industries.map(i=><label key={i}><input type="checkbox" name="industries" value={i}/> {i}</label>)}</div></fieldset>
      <button className="primary" type="submit">Create workspace</button>
    </form>
  </main>;
}
