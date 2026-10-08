import { Sidebar } from '../../components/Sidebar';
import { getDiscoveryDashboard } from '../../lib/db/dashboard';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

export const dynamic = 'force-dynamic';

export default async function DiscoverPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const data = await getDiscoveryDashboard(supabase, workspace.id);
  return <div className="shell"><Sidebar/><main><header><div><div className="eyebrow">Discovery engine</div><h1>Shopify prospect discovery</h1><p>{workspace.name}: find, verify and rank Shopify brands before any outreach is generated.</p></div></header>
  {!data.configured ? <section className="panel"><span className="eyebrow">Setup required</span><h2>Connect Supabase to activate discovery history.</h2><p>The discovery pipeline is built, but this environment does not yet have the Supabase credentials required to persist and display live runs.</p></section> : <>
  <section className="metrics"><div className="card"><span>Accounts discovered</span><strong>{data.totals.accounts}</strong><small>Workspace-scoped domains</small></div><div className="card"><span>Verified Shopify</span><strong>{data.totals.verifiedShopify}</strong><small>Independent storefront verification</small></div><div className="card"><span>Signals</span><strong>{data.totals.signals}</strong><small>Storefront + tech + hiring + growth</small></div></section>
  <section className="panel"><div className="panelHead"><div><span className="eyebrow">Run history</span><h2>Recent discovery runs</h2></div></div>
  <div className="table"><div className="row tableHeader"><span>Status</span><span>Started</span><span>Sources</span><span>Accounts</span><span>Signals</span><span>Errors</span></div>{data.runs.map((run:any)=><div className="row" key={run.id}><span className="pill">{run.status}</span><strong>{new Date(run.started_at).toLocaleString()}</strong><span>{(run.source_names ?? []).join(', ')}</span><span>{run.accounts_discovered}</span><span>{run.signals_discovered}</span><span>{run.error_count}</span></div>)}</div></section></>}
  <section className="split"><div className="panel"><span className="eyebrow">Verification rule</span><h2>Vendor match ≠ verified Shopify.</h2><p>Candidate providers can nominate accounts, but a storefront is only marked verified after our crawler finds sufficient public Shopify evidence.</p></div><div className="panel"><span className="eyebrow">Current gate</span><h2>50 real accounts.</h2><p>M1 remains incomplete until the system produces 50 real accounts and at least 70% are judged genuinely worth pursuing.</p></div></section>
  </main></div>;
}
