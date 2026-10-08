import { Sidebar } from '../../components/Sidebar';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';
import { updateWorkspaceSettings } from './actions';

const serviceOptions = ['Shopify development','CRO','UX/UI','Klaviyo / retention','Analytics','Subscriptions','QA','B2B'];
const industryOptions = ['beauty','wellness','supplements','apparel','food-beverage','fitness','pet','home'];

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase.from('workspace_sales_config').select('*').eq('workspace_id', workspace.id).single();
  if (error) throw new Error(error.message);

  const services = new Set((data.services || []).map(String));
  const countries = new Set((data.target_countries || []).map(String));
  const industries = new Set((data.target_industries || []).map(String));
  const outreach = data.outreach_rules || {};
  const canEdit = ['owner','admin'].includes(workspace.role);

  return <div className="shell"><Sidebar/><main>
    <header><div><div className="eyebrow">Workspace settings</div><h1>{workspace.name}</h1><p>Configure who the engine should find, what you sell, and which outreach safeguards must remain enabled.</p></div></header>
    <form action={updateWorkspaceSettings} className="panel" style={{display:'grid',gap:24}}>
      <fieldset disabled={!canEdit}><legend>Services</legend><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:10}}>{serviceOptions.map(s=><label key={s}><input type="checkbox" name="services" value={s} defaultChecked={services.has(s)}/> {s}</label>)}</div></fieldset>
      <fieldset disabled={!canEdit}><legend>Target countries</legend><div style={{display:'flex',gap:16,marginTop:10}}>{['US','CA','GB'].map(c=><label key={c}><input type="checkbox" name="countries" value={c} defaultChecked={countries.has(c)}/> {c}</label>)}</div></fieldset>
      <fieldset disabled={!canEdit}><legend>Preferred verticals</legend><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:10}}>{industryOptions.map(i=><label key={i}><input type="checkbox" name="industries" value={i} defaultChecked={industries.has(i)}/> {i}</label>)}</div></fieldset>
      <fieldset disabled={!canEdit}><legend>Outreach guardrails</legend><div style={{display:'grid',gap:8,marginTop:10}}><label><input type="checkbox" name="requireReasonToContact" defaultChecked={outreach.requireReasonToContact !== false}/> Require a source-backed reason to contact</label><label><input type="checkbox" name="requireVerifiedEmail" defaultChecked={outreach.requireVerifiedEmail !== false}/> Require verified professional email</label><label><input type="checkbox" name="requireHumanApproval" defaultChecked={outreach.requireHumanApproval !== false}/> Require human approval before sending</label></div></fieldset>
      {canEdit ? <button className="primary" type="submit">Save workspace settings</button> : <p>Viewer/member access is read-only. An owner or admin can change these settings.</p>}
    </form>
  </main></div>;
}
