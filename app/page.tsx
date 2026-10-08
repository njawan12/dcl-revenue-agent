import { Sidebar } from '../components/Sidebar';
import { ScoreRing } from '../components/ScoreRing';
import { createClient } from '../lib/supabase/server';
import { requireActiveWorkspace } from '../lib/workspaces/session';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const [accountsResult, signalCountResult, verifiedCountResult] = await Promise.all([
    supabase
      .from('accounts')
      .select('id,name,domain,opportunity_score,tier,suggested_buyer_role,recommended_motion')
      .eq('workspace_id', workspace.id)
      .order('opportunity_score', { ascending: false, nullsFirst: false })
      .limit(8),
    supabase.from('signals').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
    supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id).eq('shopify', true),
  ]);

  for (const result of [accountsResult, signalCountResult, verifiedCountResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const opportunities = accountsResult.data ?? [];
  const qualified = opportunities.filter((account:any) => typeof account.opportunity_score === 'number');
  const ready = qualified.filter((account:any) => account.opportunity_score >= 70);
  const topOpportunity = qualified[0];

  return <div className="shell"><Sidebar/><main>
    <header><div><div className="eyebrow">Daily command center</div><h1>{workspace.name}</h1><p>Start with the accounts that have the strongest evidence-backed reason to talk today.</p></div><a className="primary" href="/discover">Run discovery</a></header>

    <section className="metrics">
      <div className="card"><span>Ready to pursue</span><strong>{ready.length}</strong><small>Score 70+ in the current priority set</small></div>
      <div className="card"><span>Verified Shopify</span><strong>{verifiedCountResult.count ?? 0}</strong><small>Workspace-scoped storefronts</small></div>
      <div className="card"><span>Evidence signals</span><strong>{signalCountResult.count ?? 0}</strong><small>Observed reasons to investigate</small></div>
    </section>

    {topOpportunity ? <section className="panel"><div className="panelHead"><div><span className="eyebrow">Start here</span><h2>{topOpportunity.name}</h2></div><ScoreRing score={topOpportunity.opportunity_score}/></div><p>{topOpportunity.domain} is currently the highest-ranked account in this workspace. Review the evidence and buyer context before deciding whether it deserves outreach.</p><div className="split"><div><span className="eyebrow">Recommended buyer</span><h3>{topOpportunity.suggested_buyer_role || 'Research buyer map'}</h3></div><div><span className="eyebrow">Recommended motion</span><h3>{topOpportunity.recommended_motion || 'Review evidence first'}</h3></div></div><p><a className="primary" href={`/accounts/${topOpportunity.id}`}>Open opportunity intelligence</a></p></section> : <section className="panel"><span className="eyebrow">Your first signal</span><h2>No qualified opportunities yet.</h2><p>This command center only shows real workspace data. Run discovery to find and verify commerce accounts; nothing here is padded with demo prospects or invented activity.</p><p><a className="primary" href="/discover">Open discovery</a></p></section>}

    {opportunities.length ? <section className="panel"><div className="panelHead"><div><span className="eyebrow">Priority queue</span><h2>What deserves attention next</h2></div><a href="/accounts">View all accounts</a></div><div className="table"><div className="row tableHeader"><span>Score</span><span>Company</span><span>Buyer</span><span>Motion</span><span>Tier</span><span>Action</span></div>{opportunities.map((account:any)=><a href={`/accounts/${account.id}`} className="row" key={account.id}><ScoreRing score={account.opportunity_score ?? 0}/><span><strong>{account.name}</strong><br/><small>{account.domain}</small></span><span>{account.suggested_buyer_role || 'Research first'}</span><span>{account.recommended_motion || 'Review evidence'}</span><span className="pill">{account.tier || 'Unranked'}</span><strong>Inspect →</strong></a>)}</div></section> : null}

    <section className="split"><div className="panel"><span className="eyebrow">Evidence rule</span><h2>No reason, no outreach.</h2><p>Every recommendation must trace back to observed evidence. A technology match alone is context, not proof of service need.</p></div><div className="panel"><span className="eyebrow">Human control</span><h2>Decision support, not autopilot.</h2><p>Research and drafting can accelerate the work. External outreach remains behind explicit human review and approval.</p></div></section>
  </main></div>;
}
