import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Sidebar } from '../../../components/Sidebar';
import { ScoreRing } from '../../../components/ScoreRing';
import { createClient } from '../../../lib/supabase/server';
import { requireActiveWorkspace } from '../../../lib/workspaces/session';
import { prepareOutreach, researchBuyers } from './actions';

export const dynamic = 'force-dynamic';

function humanize(value:string){return value.replace(/[_-]/g,' ').replace(/\b\w/g,(c)=>c.toUpperCase())}
function when(value:string|undefined|null){if(!value)return 'Date unavailable';const date=new Date(value);return Number.isNaN(date.getTime())?'Date unavailable':date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}

export default async function AccountPage({ params, searchParams }: { params: Promise<{id:string}>, searchParams: Promise<Record<string,string|undefined>> }) {
  const [{ id }, query, workspace] = await Promise.all([params, searchParams, requireActiveWorkspace()]);
  const supabase = await createClient();
  const [{ data: account, error }, { data: signals }, { data: contacts }, { data: pipelineEvents }] = await Promise.all([
    supabase.from('accounts').select('*').eq('workspace_id', workspace.id).eq('id', id).maybeSingle(),
    supabase.from('signals').select('id,signal_type,title,source_name,source_url,observed_at,confidence,evidence').eq('workspace_id', workspace.id).eq('account_id', id).order('observed_at', { ascending:false }).limit(20),
    supabase.from('contacts').select('*').eq('workspace_id', workspace.id).eq('account_id', id).order('is_primary_buyer', { ascending:false }).order('buyer_score', { ascending:false, nullsFirst:false }),
    supabase.from('pipeline_events').select('id,previous_stage,stage,next_action,next_action_due,revision,recorded_at').eq('workspace_id',workspace.id).eq('account_id',id).order('recorded_at',{ascending:false}).limit(12),
  ]);
  if (error || !account) notFound();

  const primary = (contacts || []).find((contact:any) => contact.is_primary_buyer);
  const verifiedBuyer = Boolean(primary?.email_verified);
  const hasEvidence = Boolean(signals?.length);
  const score = Number(account.opportunity_score || 0);
  const ready = score >= 70 && hasEvidence && verifiedBuyer;
  const canOperate = ['owner','admin','member'].includes(workspace.role);
  const need = account.qualification_inputs?.need || {};
  const topNeed = Object.entries(need).filter(([,v])=>Number(v)>0).sort((a,b)=>Number(b[1])-Number(a[1]))[0];
  const topSignal = signals?.[0];
  const nextAction = !hasEvidence ? 'Build evidence' : !primary ? 'Research the buyer' : !verifiedBuyer ? 'Verify the buyer' : ready ? 'Prepare outreach' : 'Keep researching';
  const whyNow = topSignal?.title || 'No observed trigger has been persisted yet.';
  const thesis = hasEvidence
    ? `${account.name} has observed evidence supporting a ${account.recommended_motion || 'research-first'} motion${topNeed ? `, with ${humanize(topNeed[0])} as the strongest modeled need` : ''}.`
    : `${account.name} fits the account model, but there is not yet enough observed evidence to justify outreach.`;

  return <div className="shell"><Sidebar/><main>
    <Link className="back" href="/">← Daily Command Center</Link>
    <header className="opportunityHero"><div><div className="eyebrow">Opportunity intelligence</div><h1>{account.name}</h1><p>{account.domain} · {[account.country,account.industry].filter(Boolean).join(' · ')}</p><div className="tags"><span>{account.tier || 'Un-tiered'}</span><span>{account.recommended_motion || 'research-first'}</span><span>{ready ? 'Ready for review' : 'Research in progress'}</span></div></div><ScoreRing score={score}/></header>

    {query.error ? <section className="panel noticePanel"><strong>Action could not complete</strong><p>{query.error}</p></section> : null}
    {query.notice ? <section className="panel noticePanel"><strong>{query.notice}</strong></section> : null}

    <section className="opportunityLead">
      <div className="panel thesisPanel"><span className="eyebrow">Commercial thesis</span><h2>{thesis}</h2><p className="whyNow"><strong>Why now</strong><br/>{whyNow}</p></div>
      <div className="panel actionPanel"><span className="eyebrow">Next best action</span><h2>{nextAction}</h2><p>{ready ? 'Evidence and a verified primary buyer are present. Prepare an exact draft for the held outbox; a human must review it before any external action.' : 'The system will not treat this account as outreach-ready until the missing proof is resolved.'}</p>{!primary && canOperate ? <form action={researchBuyers}><input type="hidden" name="accountId" value={account.id}/><button className="primary" type="submit">Research buyers</button></form> : null}{ready && canOperate ? <form action={prepareOutreach}><input type="hidden" name="accountId" value={account.id}/><button className="primary" type="submit">Prepare held draft</button><small>Creates a revision-bound review item. Does not send.</small></form> : null}</div>
    </section>

    <section className="metrics opportunityMetrics">
      <div className="card"><span>Fit</span><strong>{account.fit_score ?? '—'}</strong><small>ICP alignment</small></div>
      <div className="card"><span>Need</span><strong>{account.need_score ?? '—'}</strong><small>Evidence-backed opportunity</small></div>
      <div className="card"><span>Intent</span><strong>{account.intent_score ?? '—'}</strong><small>Timing strength</small></div>
      <div className="card"><span>Readiness</span><strong>{ready ? 'Ready' : 'Hold'}</strong><small>{hasEvidence ? 'Evidence ✓' : 'Evidence needed'} · {verifiedBuyer ? 'Buyer ✓' : 'Buyer needed'}</small></div>
    </section>

    <section className="split">
      <div className="panel"><span className="eyebrow">Buyer readiness</span>{primary ? <><h2>{primary.full_name || [primary.first_name,primary.last_name].filter(Boolean).join(' ')}</h2><p>{primary.title || account.suggested_buyer_role || 'Recommended buyer'}</p><div className="readinessLine"><span className="pill">{primary.email_verified ? 'Verified email' : 'Verification required'}</span><small>Buyer score {primary.buyer_score ?? '—'} · {primary.verification_source || primary.provider || 'source pending'}</small></div></> : <><h2>{account.suggested_buyer_role || 'Buyer research required'}</h2><p>No named primary buyer is attached yet. Research ranks candidates before enrichment spend.</p>{canOperate ? <form action={researchBuyers}><input type="hidden" name="accountId" value={account.id}/><button className="primary" type="submit">Research buyers</button></form> : <p><small>An operator can run buyer research; viewers remain read-only.</small></p>}</>}</div>
      <div className="panel"><span className="eyebrow">Need model</span><h2>What the evidence suggests</h2>{Object.entries(need).filter(([,v])=>Number(v)>0).length ? <div className="needStack">{Object.entries(need).filter(([,v])=>Number(v)>0).sort((a,b)=>Number(b[1])-Number(a[1])).map(([key,value])=><div key={key}><span>{humanize(key)}</span><strong>{Math.round(Number(value)*100)}%</strong></div>)}</div> : <p>No need dimensions have enough evidence yet.</p>}</div>
    </section>

    <section className="panel"><div className="panelHead"><div><span className="eyebrow">What changed</span><h2>Opportunity timeline</h2></div><span className="pill">{(signals?.length || 0)+(pipelineEvents?.length || 0)} recorded events</span></div>{(signals?.length || pipelineEvents?.length) ? <div className="evidenceList">{[...(signals || []).map((signal:any)=>({id:`signal-${signal.id}`,at:signal.observed_at,title:signal.title,detail:`${humanize(signal.signal_type)} · ${signal.source_name || 'Persisted source'} · ${Math.round(Number(signal.confidence || 0)*100)}% confidence`,url:signal.source_url})),...(pipelineEvents || []).map((event:any)=>({id:`pipeline-${event.id}`,at:event.recorded_at,title:event.previous_stage===event.stage?`Next action updated in ${humanize(event.stage)}`:`Pipeline moved ${humanize(event.previous_stage)} → ${humanize(event.stage)}`,detail:event.next_action?`${event.next_action}${event.next_action_due?` · Due ${when(event.next_action_due)}`:''}`:`Revision ${event.revision}`,url:null}))].sort((a,b)=>new Date(b.at || 0).getTime()-new Date(a.at || 0).getTime()).slice(0,12).map((event:any)=><article className="evidenceItem" key={event.id}><div><strong>{event.title}</strong><small>{when(event.at)} · {event.detail}</small></div>{event.url?<a href={event.url} target="_blank" rel="noreferrer">Inspect source ↗</a>:<span className="pill">Recorded change</span>}</article>)}</div> : <div className="emptyState"><strong>No material changes recorded yet</strong><p>New evidence and operator pipeline movement will appear here instead of being flattened into current-state fields.</p></div>}</section>

    <section className="panel"><div className="panelHead"><div><span className="eyebrow">Evidence receipts</span><h2>Why the system believes this</h2></div><span className="pill">{signals?.length || 0} observed</span></div>{signals?.length ? <div className="evidenceList">{signals.map((signal:any)=><article key={signal.id} className="evidenceItem"><div><strong>{signal.title}</strong><small>{when(signal.observed_at)} · {humanize(signal.signal_type)} · {signal.source_name || 'source'} · {Math.round(Number(signal.confidence || 0)*100)}% confidence</small></div>{signal.source_url ? <a href={signal.source_url} target="_blank" rel="noreferrer">Inspect source ↗</a> : <span className="pill">Persisted evidence</span>}</article>)}</div> : <div className="emptyState"><strong>No observed evidence yet</strong><p>Technology fit or account score alone is not treated as proof of need.</p></div>}</section>

    <section className="panel"><div className="panelHead"><div><span className="eyebrow">Buyer bench</span><h2>Ranked people</h2></div></div>{contacts?.length ? <div className="buyerCards">{contacts.map((contact:any)=><article className="buyerCard" key={contact.id}><div><strong>{contact.full_name || [contact.first_name,contact.last_name].filter(Boolean).join(' ')}</strong><small>{contact.title || 'Role unknown'}</small></div><div><span className="pill">{contact.email_verified ? 'verified' : contact.verification_status || 'candidate'}</span><small>Score {contact.buyer_score ?? '—'}</small></div></article>)}</div> : <div className="emptyState"><strong>No buyer candidates yet</strong><p>Buyer research has not been run for this account.</p></div>}</section>
  </main></div>;
}