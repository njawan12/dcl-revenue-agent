import { Sidebar } from '../../components/Sidebar';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';
import { updateWorkspaceSettings } from './actions';
import { suppressDomain, liftSuppression } from './suppression-actions';

const serviceOptions=['Shopify development','CRO','UX/UI','Klaviyo / retention','Analytics','Subscriptions','QA','B2B'];
const industryOptions=['beauty','wellness','supplements','apparel','food-beverage','fitness','pet','home'];
export const dynamic='force-dynamic';

export default async function SettingsPage({searchParams}:{searchParams:Promise<{notice?:string,error?:string}>}) {
 const workspace=await requireActiveWorkspace(); const supabase=await createClient(); const params=await searchParams;
 const [{data,error},{data:suppressions},{data:accounts}]=await Promise.all([
  supabase.from('workspace_sales_config').select('*').eq('workspace_id',workspace.id).single(),
  supabase.from('suppression_entries').select('id,scope,normalized_value,reason,source,created_at,lifted_at,lift_reason').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).limit(50),
  supabase.from('accounts').select('id,name,domain').eq('workspace_id',workspace.id).order('name').limit(200)
 ]); if(error) throw new Error(error.message);
 const services=new Set((data.services||[]).map(String)),countries=new Set((data.target_countries||[]).map(String)),industries=new Set((data.target_industries||[]).map(String));
 const outreach=data.outreach_rules||{}; const canEdit=['owner','admin'].includes(workspace.role); const active=(suppressions||[]).filter(s=>!s.lifted_at), history=(suppressions||[]).filter(s=>s.lifted_at);
 return <div className="shell"><Sidebar/><main>
  <header><div><div className="eyebrow">Workspace settings</div><h1>{workspace.name}</h1><p>Control targeting, operating policy and the safety boundaries around commercial outreach.</p></div></header>
  {params.notice&&<div className="panel" style={{marginBottom:18}}><strong>Saved</strong><p>{params.notice}</p></div>}{params.error&&<div className="panel" style={{marginBottom:18}}><strong>Could not complete that action</strong><p>{params.error}</p></div>}
  <form action={updateWorkspaceSettings} className="panel" style={{display:'grid',gap:24}}>
   <fieldset disabled={!canEdit}><legend>Services</legend><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:10}}>{serviceOptions.map(s=><label key={s}><input type="checkbox" name="services" value={s} defaultChecked={services.has(s)}/> {s}</label>)}</div></fieldset>
   <fieldset disabled={!canEdit}><legend>Target countries</legend><div style={{display:'flex',gap:16,marginTop:10}}>{['US','CA','GB'].map(c=><label key={c}><input type="checkbox" name="countries" value={c} defaultChecked={countries.has(c)}/> {c}</label>)}</div></fieldset>
   <fieldset disabled={!canEdit}><legend>Preferred verticals</legend><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:10}}>{industryOptions.map(i=><label key={i}><input type="checkbox" name="industries" value={i} defaultChecked={industries.has(i)}/> {i}</label>)}</div></fieldset>
   <fieldset disabled={!canEdit}><legend>Outreach guardrails</legend><div style={{display:'grid',gap:8,marginTop:10}}><label><input type="checkbox" name="requireReasonToContact" defaultChecked={outreach.requireReasonToContact!==false}/> Require source-backed reason to contact</label><label><input type="checkbox" name="requireVerifiedEmail" defaultChecked={outreach.requireVerifiedEmail!==false}/> Require verified professional email</label><label><input type="checkbox" name="requireHumanApproval" defaultChecked={outreach.requireHumanApproval!==false}/> Require human approval before sending</label></div></fieldset>
   {canEdit?<button className="primary" type="submit">Save workspace settings</button>:<p>Workspace policy is read-only for your role.</p>}
  </form>

  <section style={{marginTop:28}}><div className="eyebrow">Outreach safety</div><h2 style={{marginBottom:6}}>Suppression ledger</h2><p style={{maxWidth:720}}>A durable stop list checked again at draft creation and approval. Lifting a suppression preserves its audit history; it does not send anything.</p>
   {canEdit&&<form action={suppressDomain} className="panel" style={{display:'grid',gap:14,marginTop:16}}><div><strong>Suppress a business domain</strong><p style={{margin:'4px 0 0'}}>Use for opt-outs, legal/policy holds, relationship conflicts or any business you do not want contacted.</p></div><select name="accountId" required defaultValue=""><option value="" disabled>Select account context</option>{(accounts||[]).map(a=><option key={a.id} value={a.id}>{a.name} · {a.domain}</option>)}</select><input name="domain" placeholder="example.com" required/><input name="reason" placeholder="Reason for suppression" maxLength={500} required/><button className="primary" type="submit">Add to suppression ledger</button></form>}
   <div style={{display:'grid',gap:12,marginTop:16}}>{active.length===0?<div className="panel"><strong>No active suppressions</strong><p>The ledger is clear. Existing account-level legacy suppression is still enforced separately.</p></div>:active.map(s=><article className="panel" key={s.id}><div style={{display:'flex',justifyContent:'space-between',gap:20,alignItems:'flex-start',flexWrap:'wrap'}}><div><div className="eyebrow">{s.scope} · active</div><h3 style={{margin:'6px 0'}}>{s.normalized_value||'Scoped record'}</h3><p style={{margin:0}}>{s.reason}</p><small>{s.source} · {new Date(s.created_at).toLocaleDateString()}</small></div>{canEdit&&<form action={liftSuppression} style={{display:'grid',gap:8,minWidth:260}}><input type="hidden" name="suppressionId" value={s.id}/><input name="liftReason" placeholder="Why is it safe to lift?" maxLength={500} required/><button type="submit">Lift suppression</button></form>}</div></article>)}</div>
   {history.length>0&&<details className="panel" style={{marginTop:16}}><summary><strong>Audit history · {history.length} lifted</strong></summary><div style={{display:'grid',gap:12,marginTop:16}}>{history.map(s=><div key={s.id}><strong>{s.normalized_value||s.scope}</strong><p style={{margin:'3px 0'}}>Suppressed: {s.reason}</p><small>Lifted: {s.lift_reason||'reason retained in audit record'}</small></div>)}</div></details>}
  </section>
 </main></div>;
}
