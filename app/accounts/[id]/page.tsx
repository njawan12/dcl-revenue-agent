import { notFound } from 'next/navigation';
import { Sidebar } from '../../../components/Sidebar';
import { ScoreRing } from '../../../components/ScoreRing';
import { createClient } from '../../../lib/supabase/server';
import { requireActiveWorkspace } from '../../../lib/workspaces/session';
import { researchBuyers } from './actions';

export const dynamic = 'force-dynamic';

export default async function AccountPage({ params, searchParams }: { params: Promise<{id:string}>, searchParams: Promise<Record<string,string|undefined>> }) {
  const [{ id }, query, workspace] = await Promise.all([params, searchParams, requireActiveWorkspace()]);
  const supabase = await createClient();
  const [{ data: account, error }, { data: signals }, { data: contacts }] = await Promise.all([
    supabase.from('accounts').select('*').eq('workspace_id', workspace.id).eq('id', id).maybeSingle(),
    supabase.from('signals').select('id,signal_type,title,source_name,source_url,observed_at,confidence,evidence').eq('workspace_id', workspace.id).eq('account_id', id).order('observed_at', { ascending:false }).limit(20),
    supabase.from('contacts').select('*').eq('workspace_id', workspace.id).eq('account_id', id).order('is_primary_buyer', { ascending:false }).order('buyer_score', { ascending:false, nullsFirst:false }),
  ]);
  if (error || !account) notFound();

  const primary = (contacts || []).find((contact:any) => contact.is_primary_buyer);
  const canResearch = ['owner','admin'].includes(workspace.role);
  const need = account.qualification_inputs?.need || {};

  return <div className="shell"><Sidebar/><main>
    <header><div><div className="eyebrow">Account intelligence</div><h1>{account.name}</h1><p>{account.domain} · {[account.country,account.industry].filter(Boolean).join(' · ')}</p></div><ScoreRing score={account.opportunity_score ?? 0}/></header>
    {query.error ? <section className="panel"><strong>Buyer research could not run</strong><p>{query.error}</p></section> : null}
    {query.notice ? <section className="panel"><strong>{query.notice}</strong></section> : null}

    <section className="metrics">
      <div className="card"><span>Fit</span><strong>{account.fit_score ?? '—'}</strong><small>ICP alignment</small></div>
      <div className="card"><span>Need</span><strong>{account.need_score ?? '—'}</strong><small>Evidence-backed opportunity</small></div>
      <div className="card"><span>Intent</span><strong>{account.intent_score ?? '—'}</strong><small>Why now</small></div>
      <div className="card"><span>Tier</span><strong>{account.tier}</strong><small>{account.recommended_motion || 'research-first'}</small></div>
    </section>

    <section className="split">
      <div className="panel"><span className="eyebrow">Recommended buyer</span><h2>{account.suggested_buyer_role || 'Research required'}</h2><p>The buyer model uses the same need/intent evidence that qualified this account rather than choosing a generic executive.</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{Object.entries(need).filter(([,v])=>Number(v)>0).sort((a,b)=>Number(b[1])-Number(a[1])).map(([key,value])=><span className="pill" key={key}>{key}: {Math.round(Number(value)*100)}%</span>)}</div></div>
      <div className="panel"><span className="eyebrow">Contact status</span>{primary ? <><h2>{primary.full_name || [primary.first_name,primary.last_name].filter(Boolean).join(' ')}</h2><p>{primary.title}</p><p><strong>{primary.email_verified ? 'Verified professional email' : 'Email not verified'}</strong>{primary.email ? ` · ${primary.email}` : ''}</p><small>Buyer score {primary.buyer_score ?? '—'} · {primary.verification_source || primary.provider}</small></> : <><h2>No primary buyer yet</h2><p>Research ranks named people first, then spends enrichment credits only on the strongest candidates.</p></>}
      {canResearch ? <form action={researchBuyers} style={{marginTop:16}}><input type="hidden" name="accountId" value={account.id}/><button className="primary" type="submit">Research buyers</button></form> : <p><small>An owner/admin can run paid buyer research.</small></p>}</div>
    </section>

    <section className="panel"><div className="panelHead"><div><span className="eyebrow">Buyer candidates</span><h2>Ranked people</h2></div></div>{contacts?.length ? <div className="table"><div className="row tableHeader"><span>Score</span><span>Person</span><span>Role</span><span>Email</span><span>Provider</span><span>Status</span></div>{contacts.map((contact:any)=><div className="row" key={contact.id}><strong>{contact.buyer_score ?? '—'}</strong><span><strong>{contact.full_name || [contact.first_name,contact.last_name].filter(Boolean).join(' ')}</strong>{contact.is_primary_buyer ? <><br/><small>Primary buyer</small></> : null}</span><span>{contact.title || '—'}</span><span>{contact.email || 'Not revealed'}</span><span>{contact.email_provider || contact.provider || '—'}</span><span className="pill">{contact.email_verified ? 'verified' : contact.verification_status || 'candidate'}</span></div>)}</div> : <p>No buyer candidates have been researched yet.</p>}</section>

    <section className="panel"><div className="panelHead"><div><span className="eyebrow">Evidence</span><h2>Recent signals</h2></div></div>{signals?.length ? <div style={{display:'grid',gap:12}}>{signals.map((signal:any)=><div key={signal.id}><strong>{signal.title}</strong><br/><small>{signal.signal_type} · {signal.source_name || 'source'} · confidence {Math.round(Number(signal.confidence || 0)*100)}%</small>{signal.source_url ? <><br/><a href={signal.source_url} target="_blank" rel="noreferrer">Source evidence</a></> : null}</div>)}</div> : <p>No signals persisted yet.</p>}</section>
  </main></div>;
}
