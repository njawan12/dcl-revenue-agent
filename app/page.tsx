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

type ChangeItem = {
  id: string;
  accountId: string;
  accountName: string;
  kind: 'signal'|'pipeline';
  title: string;
  detail: string;
  occurredAt: string;
  confidence?: number | null;
  source?: string | null;
  priority: number;
};

function relativeDate(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default async function Home() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const recentCutoff = new Date(Date.now() - 7 * 86400000).toISOString();

  const [accountsResult, signalsResult, contactsResult, outreachResult, verifiedCountResult, dueResult, recentSignalsResult, recentPipelineResult] = await Promise.all([
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
    supabase.from('accounts').select('id,name,next_action,next_action_due,pipeline_stage').eq('workspace_id',workspace.id).eq('suppressed',false).lte('next_action_due',new Date().toISOString().slice(0,10)).not('pipeline_stage','in','(won,lost)').order('next_action_due',{ascending:true}).limit(6),
    supabase.from('signals').select('id,account_id,title,signal_type,observed_at,source_name,confidence,accounts!inner(name,domain,suppressed)').eq('workspace_id', workspace.id).eq('accounts.suppressed', false).gte('observed_at', recentCutoff).order('observed_at',{ascending:false}).limit(12),
    supabase.from('pipeline_events').select('id,account_id,previous_stage,stage,next_action,next_action_due,recorded_at,accounts!inner(name,domain,suppressed)').eq('workspace_id', workspace.id).eq('accounts.suppressed', false).gte('recorded_at', recentCutoff).order('recorded_at',{ascending:false}).limit(12),
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

  const recentChanges: ChangeItem[] = [];
  if (!recentSignalsResult.error) {
    for (const signal of recentSignalsResult.data ?? []) {
      const account = Array.isArray(signal.accounts) ? signal.accounts[0] : signal.accounts;
      if (!account) continue;
      const confidence = typeof signal.confidence === 'number' ? signal.confidence : Number(signal.confidence ?? 0);
      recentChanges.push({
        id: `signal-${signal.id}`,
        accountId: signal.account_id,
        accountName: account.name,
        kind: 'signal',
        title: signal.title,
        detail: `${signal.signal_type.replaceAll('_',' ')} observed${signal.source_name ? ` via ${signal.source_name}` : ''}`,
        occurredAt: signal.observed_at,
        confidence,
        source: signal.source_name,
        priority: 20 + Math.round(confidence * 10),
      });
    }
  }
  if (!recentPipelineResult.error) {
    for (const event of recentPipelineResult.data ?? []) {
      const account = Array.isArray(event.accounts) ? event.accounts[0] : event.accounts;
      if (!account) continue;
      const stageChanged = event.previous_stage !== event.stage;
      recentChanges.push({
        id: `pipeline-${event.id}`,
        accountId: event.account_id,
        accountName: account.name,
        kind: 'pipeline',
        title: stageChanged ? `${event.previous_stage} → ${event.stage}` : 'Next action updated',
        detail: event.next_action || 'Pipeline state changed',
        occurredAt: event.recorded_at,
        priority: stageChanged ? 18 : 12,
      });
    }
  }
  const changeQueue = recentChanges
    .sort((a,b) => b.priority - a.priority || new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0,6);
  const changesUnavailable = Boolean(recentSignalsResult.error && recentPipelineResult.error);

  return <div className="shell"><Sidebar/><main>
    <header><div><div className="eyebrow">Daily command center</div><h1>{workspace.name}</h1><p>Start with the accounts that have the strongest evidence-backed reason to talk today.</p></div><a className="primary" href="/discover">Run discovery</a></header>

    <section className="panel"><div className="panelHead"><div><span className="eyebrow">Change intelligence · last 7 days</span><h2>What changed — and deserves attention</h2></div><a href="/accounts">Explore opportunities</a></div>
      {changesUnavailable ? <div className="emptyState"><strong>Change intelligence is temporarily unavailable.</strong><p>Your opportunity and pipeline data remain intact. Refresh after the underlying read recovers.</p></div> : changeQueue.length ? <div className="evidenceList">{changeQueue.map(change => <a className="evidenceItem" href={`/accounts/${change.accountId}`} key={change.id}><div><span className="eyebrow">{change.kind === 'signal' ? 'Observed signal' : 'Pipeline movement'} · {relativeDate(change.occurredAt)}</span><strong>{change.accountName} · {change.title}</strong><small>{change.detail}{change.kind === 'signal' && change.confidence != null ? ` · ${Math.round(change.confidence * 100)}% confidence` : ''}</small></div><strong>Review →</strong></a>)}</div> : <div className="emptyState"><strong>No material changes recorded in the last 7 days.</strong><p>This queue stays quiet rather than inventing urgency. New observed signals and audited pipeline movement will appear here.</p></div>}
    </section>

    <section className="panel"><div className="panelHead"><div><span className="eyebrow">Next actions</span><h2>Due for attention</h2></div><a href="/pipeline">Open pipeline</a></div>{dueResult.error ? <p>Next actions are unavailable. Check the pipeline setup.</p> : dueResult.data?.length ? <div className="evidenceList">{dueResult.data.map(item=><div className="evidenceItem" key={item.id}><div><strong>{item.name}</strong><small>{item.next_action} · Due {item.next_action_due}</small></div><a href="/pipeline">Update progress →</a></div>)}</div> : <p>No actions due through today (UTC). Record your next step in the pipeline.</p>}</section>
    <section className="metrics">
      <div className="card"><span>Ready in priority queue</span><strong>{ready.length}</strong><small>70+ score, observed evidence and a verified primary buyer</small></div>
      <div className="card"><span>Verified Shopify</span><strong>{verifiedCountResult.count ?? 0}</strong><small>Unsuppressed workspace storefronts</small></div>
      <div className="card"><span>Evidence signals</span><strong>{signals.length}</strong><small>Observed reasons to investigate</small></div>
    </section>

    {topOpportunity ? <section className="panel"><div className="panelHead"><div><span className="eyebrow">{isReady(topOpportunity) ? 'Start here' : 'Research next'}</span><h2>{topOpportunity.name}</h2></div><ScoreRing score={topOpportunity.opportunity_score ?? 0}/></div><p>{topOpportunity.domain} is the strongest current candidate in this workspace. Readiness is earned from score, evidence and a verified buyer — never score alone.</p><div className="split"><div><span className="eyebrow">Recommended buyer</span><h3>{topOpportunity.suggested_buyer_role || 'Research buyer map'}</h3></div><div><span className="eyebrow">Recommended motion</span><h3>{topOpportunity.recommended_motion || 'Review evidence first'}</h3></div></div><div className="split"><div><span className="eyebrow">Evidence</span><h3>{topHasEvidence ? 'Observed' : 'Needs evidence'}</h3></div><div><span className="eyebrow">Buyer readiness</span><h3>{topHasBuyer ? 'Verified primary buyer' : 'Buyer research required'}</h3></div></div><p><span className="pill">{topHasHeldDraft ? 'Draft held for human review' : 'No approved outbound queued'}</span></p><p><a className="primary" href={`/accounts/${topOpportunity.id}`}>Open opportunity intelligence</a></p></section> : <section className="panel"><span className="eyebrow">Your first signal</span><h2>No qualified opportunities yet.</h2><p>This command center only shows real workspace data. Run discovery to find and verify commerce accounts; nothing here is padded with demo prospects or invented activity.</p><p><a className="primary" href="/discover">Open discovery</a></p></section>}

    {opportunities.length ? <section id="opportunities" className="panel"><div className="panelHead"><div><span className="eyebrow">Priority queue</span><h2>What deserves attention next</h2></div><a href="/accounts">View all accounts</a></div><div className="table"><div className="row tableHeader"><span>Score</span><span>Company</span><span>Readiness</span><span>Buyer</span><span>Motion</span><span>Action</span></div>{opportunities.map((account)=><a href={`/accounts/${account.id}`} className="row" key={account.id}><ScoreRing score={account.opportunity_score ?? 0}/><span><strong>{account.name}</strong><br/><small>{account.domain}</small></span><span className="pill">{isReady(account) ? 'Ready' : signalAccounts.has(account.id) ? 'Research buyer' : 'Build evidence'}</span><span>{account.suggested_buyer_role || 'Research first'}</span><span>{account.recommended_motion || 'Review evidence'}</span><strong>Inspect →</strong></a>)}</div></section> : null}

    <section className="split"><div className="panel"><span className="eyebrow">Evidence rule</span><h2>No reason, no outreach.</h2><p>Every recommendation must trace back to observed evidence. A technology match alone is context, not proof of service need.</p></div><div className="panel"><span className="eyebrow">Human control</span><h2>Decision support, not autopilot.</h2><p>Research and drafting can accelerate the work. External outreach remains behind explicit human review and approval.</p></div></section>
  </main></div>;
}
