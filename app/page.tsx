import Link from 'next/link';
import { Sidebar } from '../components/Sidebar';
import { createClient } from '../lib/supabase/server';
import { requireActiveWorkspace } from '../lib/workspaces/session';

export const dynamic = 'force-dynamic';

function score(value:any){const n=Number(value);return Number.isFinite(n)?Math.round(n):0;}
function ago(value:string|null|undefined){if(!value)return 'date unknown';const t=new Date(value).getTime();if(!Number.isFinite(t))return 'date unknown';const d=Math.max(0,Math.floor((Date.now()-t)/86400000));if(d===0)return 'today';if(d===1)return 'yesterday';return `${d} days ago`;}
function statusLabel(match:any, hasBuyer:boolean, hasDraft:boolean){if(hasDraft)return 'Draft ready for review';if(hasBuyer)return 'Buyer verified';if(['priority','qualified'].includes(match.tier))return 'Find decision maker';return 'Research';}

export default async function Home(){
  const workspace=await requireActiveWorkspace();
  const supabase=await createClient();
  const [profilesResult,matchesResult,accountsResult,signalsResult,contactsResult,outreachResult,runsResult]=await Promise.all([
    supabase.from('offer_profiles').select('id,name,profile_key,lookback_days,target_job_titles,target_countries,caps').eq('workspace_id',workspace.id).eq('active',true).order('priority').limit(3),
    supabase.from('profile_account_matches').select('*').eq('workspace_id',workspace.id).order('opportunity_score',{ascending:false,nullsFirst:false}).limit(20),
    supabase.from('accounts').select('id,name,domain,country,industry,employee_count,suppressed').eq('workspace_id',workspace.id).eq('suppressed',false),
    supabase.from('signals').select('id,account_id,offer_profile_id,signal_type,title,source_url,source_name,observed_at,evidence').eq('workspace_id',workspace.id).order('observed_at',{ascending:false}).limit(120),
    supabase.from('contacts').select('id,account_id,full_name,first_name,last_name,title,email,email_verified,is_primary_buyer').eq('workspace_id',workspace.id).eq('is_primary_buyer',true),
    supabase.from('outreach').select('id,account_id,offer_profile_id,status,current_revision_id,created_at').eq('workspace_id',workspace.id).in('status',['ready','approved']).order('created_at',{ascending:false}),
    supabase.from('discovery_runs').select('id,status,started_at,completed_at,accounts_discovered,signals_discovered,error_count,offer_profile_id,metadata').eq('workspace_id',workspace.id).order('started_at',{ascending:false}).limit(1),
  ]);
  const dataUnavailable=[profilesResult,matchesResult,accountsResult,signalsResult,contactsResult,outreachResult].some(r=>Boolean(r.error));
  const profiles:any[]=profilesResult.data||[]; const activeProfile=profiles[0];
  const matches:any[]=matchesResult.data||[]; const accounts:any[]=accountsResult.data||[]; const signals:any[]=signalsResult.data||[]; const contacts:any[]=contactsResult.data||[]; const drafts:any[]=outreachResult.data||[];
  const accountById=new Map(accounts.map(a=>[a.id,a]));
  const buyerByAccount=new Map(contacts.filter(c=>c.email_verified).map(c=>[c.account_id,c]));
  const draftByAccount=new Map(drafts.map(d=>[d.account_id,d]));
  const jobsByAccount=new Map<string,any[]>();
  for(const signal of signals.filter(s=>s.signal_type==='job')){const list=jobsByAccount.get(signal.account_id)||[];list.push(signal);jobsByAccount.set(signal.account_id,list);}
  const queue=matches.map(match=>({match,account:accountById.get(match.account_id),job:(jobsByAccount.get(match.account_id)||[])[0],buyer:buyerByAccount.get(match.account_id),draft:draftByAccount.get(match.account_id)})).filter(item=>item.account&&item.job).slice(0,12);
  const spotlight=queue[0]; const latestRun:any=runsResult.data?.[0];
  const draftCount=queue.filter(x=>x.draft).length; const verifiedCount=queue.filter(x=>x.buyer).length;

  return <div className="shell premiumShell"><Sidebar/><main className="commandMain">
    <header className="commandHeader"><div><div className="eyebrow">Revenue Command Center</div><h1>Who should DCL pursue today?</h1><p>Fresh hiring demand first. Buyer evidence second. Nothing leaves the system without your approval.</p></div><Link className="primary commandCta" href="/discover">Find fresh hiring signals</Link></header>

    {dataUnavailable?<section className="commandAlert"><strong>Part of the live intelligence is unavailable.</strong><span>Readiness is withheld instead of guessed.</span></section>:null}

    <section className="commandKpis">
      <div><span>Active hiring opportunities</span><strong>{dataUnavailable?'—':queue.length}</strong><small>{activeProfile?`${activeProfile.name} · ${activeProfile.lookback_days} day window`:'Offer profile required'}</small></div>
      <div><span>Verified decision makers</span><strong>{dataUnavailable?'—':verifiedCount}</strong><small>Professional work email verified</small></div>
      <div><span>Held drafts</span><strong>{dataUnavailable?'—':draftCount}</strong><small>Waiting for human review · zero auto-send</small></div>
      <div><span>Latest discovery</span><strong>{latestRun?String(latestRun.status).replaceAll('_',' '):'Not run'}</strong><small>{latestRun?`${latestRun.accounts_discovered||0} accounts · ${latestRun.error_count||0} errors`:'Run the first controlled batch'}</small></div>
    </section>

    {spotlight?<section className="revenueSpotlight">
      <div className="revenueSpotlightMain"><div className="spotlightTop"><div><span className="signalBadge">Fresh hiring trigger</span><h2>{spotlight.account.name}</h2><p>{spotlight.account.domain}{spotlight.account.country?` · ${spotlight.account.country}`:''}</p></div><div className="opportunityNumber"><strong>{score(spotlight.match.opportunity_score)}</strong><span>priority score</span></div></div>
      <div className="hiringReason"><span>Why now</span><h3>{spotlight.job.title}</h3><p>Posted {ago(spotlight.job.evidence?.postedAt||spotlight.job.observed_at)}. This observed opening is the primary reason to investigate the account.</p><a href={spotlight.job.source_url} target="_blank" rel="noreferrer">Open original job post ↗</a></div>
      <div className="spotlightEvidence"><div><span>Fit</span><strong>{score(spotlight.match.fit_score)}</strong></div><div><span>Intent</span><strong>{score(spotlight.match.intent_score)}</strong></div><div><span>Supporting need</span><strong>{score(spotlight.match.need_score)}</strong></div></div></div>
      <aside className="revenueSpotlightAside"><span className="eyebrow">Next move</span><h3>{statusLabel(spotlight.match,Boolean(spotlight.buyer),Boolean(spotlight.draft))}</h3>{spotlight.buyer?<div className="buyerMini"><strong>{spotlight.buyer.full_name||[spotlight.buyer.first_name,spotlight.buyer.last_name].filter(Boolean).join(' ')}</strong><span>{spotlight.buyer.title}</span><small>{spotlight.buyer.email}</small></div>:<p>Find the highest-priority buyer role from this offer profile and verify a business email before drafting.</p>}{spotlight.draft?<Link className="primary" href="/outreach">Review held draft</Link>:<Link className="primary" href={`/accounts/${spotlight.account.id}`}>Open intelligence brief</Link>}<small className="safetyNote">Human approval required. Sending is disabled.</small></aside>
    </section>:<section className="revenueEmpty"><span className="eyebrow">No fresh queue yet</span><h2>Your first real opportunity starts with a hiring signal.</h2><p>Run the DCL offer profile. The engine will search recent Shopify/ecommerce developer openings, score the company, research a buyer and prepare a held draft only when the evidence is strong enough.</p><Link className="primary" href="/discover">Run controlled discovery</Link></section>}

    {queue.length?<section className="commandSection"><div className="commandSectionHead"><div><span className="eyebrow">Priority queue</span><h2>Fresh reasons to sell</h2></div><Link href="/accounts">All accounts →</Link></div><div className="revenueQueue">{queue.map(({match,account,job,buyer,draft},index)=><Link href={`/accounts/${account.id}`} className="revenueQueueRow" key={`${match.offer_profile_id}-${account.id}`}><span className="queueRank">{String(index+1).padStart(2,'0')}</span><div className="queueCompany"><strong>{account.name}</strong><small>{account.domain} · {job.title}</small></div><div className="queueTrigger"><span>Trigger</span><strong>{ago(job.evidence?.postedAt||job.observed_at)}</strong></div><div className="queueBuyer"><span>Buyer</span><strong>{buyer?buyer.full_name||'Verified':'Not verified'}</strong></div><div className="queueState"><span className={`stateDot ${draft?'stateReady':buyer?'stateBuyer':'stateResearch'}`}/><strong>{draft?'Draft held':buyer?'Buyer ready':String(match.tier||'review')}</strong></div><div className="queueScore">{score(match.opportunity_score)}</div></Link>)}</div></section>:null}

    <section className="commandFooterGrid"><article><span className="eyebrow">Primary trigger</span><h3>Hiring proves there is a live capacity problem.</h3><p>Storefront issues can strengthen the case and personalize the message, but they cannot create a DCL opportunity by themselves.</p></article><article><span className="eyebrow">Commercial control</span><h3>Evidence → buyer → draft → your approval.</h3><p>No verified professional email means no draft. A changed draft invalidates the old approval. Suppression is checked again before approval.</p></article></section>
  </main></div>;
}
