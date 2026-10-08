import { Sidebar } from '../components/Sidebar';
import { ScoreRing } from '../components/ScoreRing';
import { createClient } from '../lib/supabase/server';
import { requireActiveWorkspace } from '../lib/workspaces/session';

export const dynamic = 'force-dynamic';

type Account = {
  id: string;
  name: string;
  domain: string;
  opportunity_score: number | null;
  tier: string | null;
  suggested_buyer_role: string | null;
  recommended_motion: string | null;
  suppressed: boolean | null;
};

export default async function Home() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const [accountsResult, signalsResult, contactsResult, outreachResult, verifiedCountResult] = await Promise.all([
    supabase
      .from('accounts')
      .select('id,name,domain,opportunity_score,tier,suggested_buyer_role,recommended_motion,suppressed')
      .eq('workspace_id', workspace.id)
      .eq('suppressed', false)
      .order('opportunity_score', { ascending: false, nullsFirst: false })
      .limit(8),
    supabase.from('signals').select('id,account_id').eq('workspace_id', workspace.id),
    supabase.from('contacts').select('id,account_id,email_verified,is_primary_buyer').eq('workspace_id', workspace.id),
    supabase.from('outreach').select('id,account_id,status').eq('workspace_id', workspace.id),
    supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id).eq('shopify', true).eq('suppressed', false),
  ]);

  for (const result of [accountsResult, signalsResult, contactsResult, outreachResult, verifiedCountResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const opportunities = (accountsResult.data ?? []) as Account[];
  const signals = signalsResult.data ?? [];
  const contacts = contactsResult.data ?? [];
  const outreach = outreachResult.data ?? [];
  const signalAccounts = new Set(signals.map((signal:any) => signal.account_id));
  const buyerAccounts = new Set(contacts.filter((contact:any) => contact.email_verified && contact.is_primary_buyer).map((contact:any) => contact.account_id));
  const heldOutreachAccounts = new Set(outreach.filter((item:any) => ['ready','approved'].includes(item.status)).map((item:any) => item.account_id));

  const qualified = opportunities.filter((account) => typeof account.opportunity_score === 'number');
  const isReady = (account: Account) => (account.opportunity_score ?? 0) >= 70 && signalAccounts.has(account.id) && buyerAccounts.has(account.id);
  const ready = qualified.filter(isReady);
  const topOpportunity = ready[0] ?? qualified[0];
  const topHasEvidence = topOpportunity ? signalAccounts.has(topOpportunity.id) : false;
  const topHasBuyer = topOpportunity ? buyerAccounts.has(topOpportunity.id) : false;
  const topHasHeldDraft = topOpportunity ? heldOutreachAccounts.has(topOpportunity.id) : false;

  return <div className="shell"><Sidebar/><main>
    <header><div><div className="eyebrow">Daily command center</div><h1>{workspace.name}</h1><p>Start with the accounts that have the strongest evidence-backed reason to talk today.</p></div><a className="primary" href="/discover">Run discovery</a></header>

    <section className="metrics">
      <div className="card"><span>Ready to pursue</span><strong>{ready.length}</strong><small>70+ score, observed evidence and a verified primary buyer</small></div>
      <div className="card"><span>Verified Shopify</span><strong>{verifiedCountResult.count ?? 0}</strong><small>Unsuppressed workspace storefronts</small></div>
      <div className="card"><span>Evidence signals</span><strong>{signals.length}</strong><small>Observed reasons to investigate</small></div>
    </section>

    {topOpportunity ? <section className="panel"><div className="panelHead"><div><span className="eyebrow">{isReady(topOpportunity) ? 'Start here' : 'Research next'}</span><h2>{topOpportunity.name}</h2></div><ScoreRing score={topOpportunity.opportunity_score ?? 0}/></div><p>{topOpportunity.domain} is the strongest current candidate in this workspace. Readiness is earned from score, evidence and a verified buyer — never score alone.</p><div className="split"><div><span className="eyebrow">Recommended buyer</span><h3>{topOpportunity.suggested_buyer_role || 'Research buyer map'}</h3></div><div><span className="eyebrow">Recommended motion</span><h3>{topOpportunity.recommended_motion || 'Review evidence first'}</h3></div></div><div className="split"><div><span className="eyebrow">Evidence</span><h3>{topHasEvidence ? 'Observed' : 'Needs evidence'}</h3></div><div><span className="eyebrow">Buyer readiness</span><h3>{topHasBuyer ? 'Verified primary buyer' : 'Buyer research required'}</h3></div></div><p><span className="pill">{topHasHeldDraft ? 'Draft held for human review' : 'No approved outbound queued'}</span></p><p><a className="primary" href={`/accounts/${topOpportunity.id}`}>Open opportunity intelligence</a></p></section> : <section className="panel"><span className="eyebrow">Your first signal</span><h2>No qualified opportunities yet.</h2><p>This command center only shows real workspace data. Run discovery to find and verify commerce accounts; nothing here is padded with demo prospects or invented activity.</p><p><a className="primary" href="/discover">Open discovery</a></p></section>}

    {opportunities.length ? <section className="panel"><div className="panelHead"><div><span className="eyebrow">Priority queue</span><h2>What deserves attention next</h2></div><a href="/accounts">View all accounts</a></div><div className="table"><div className="row tableHeader"><span>Score</span><span>Company</span><span>Readiness</span><span>Buyer</span><span>Motion</span><span>Action</span></div>{opportunities.map((account)=><a href={`/accounts/${account.id}`} className="row" key={account.id}><ScoreRing score={account.opportunity_score ?? 0}/><span><strong>{account.name}</strong><br/><small>{account.domain}</small></span><span className="pill">{isReady(account) ? 'Ready' : signalAccounts.has(account.id) ? 'Research buyer' : 'Build evidence'}</span><span>{account.suggested_buyer_role || 'Research first'}</span><span>{account.recommended_motion || 'Review evidence'}</span><strong>Inspect →</strong></a>)}</div></section> : null}

    <section className="split"><div className="panel"><span className="eyebrow">Evidence rule</span><h2>No reason, no outreach.</h2><p>Every recommendation must trace back to observed evidence. A technology match alone is context, not proof of service need.</p></div><div className="panel"><span className="eyebrow">Human control</span><h2>Decision support, not autopilot.</h2><p>Research and drafting can accelerate the work. External outreach remains behind explicit human review and approval.</p></div></section>
  </main></div>;
}
