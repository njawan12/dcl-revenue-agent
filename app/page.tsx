import Link from 'next/link';
import { Sidebar } from '../components/Sidebar';
import { createClient } from '../lib/supabase/server';
import { requireActiveWorkspace } from '../lib/workspaces/session';

export const dynamic = 'force-dynamic';

function score(value:any){const n=Number(value);return Number.isFinite(n)?Math.round(n):0;}
function ago(value:string|null|undefined){if(!value)return 'recently';const t=new Date(value).getTime();if(!Number.isFinite(t))return 'recently';const d=Math.max(0,Math.floor((Date.now()-t)/86400000));if(d===0)return 'today';if(d===1)return 'yesterday';return `${d} days ago`;}
function fitLabel(value:any){const s=score(value);if(s>=80)return 'Excellent fit';if(s>=65)return 'Strong fit';if(s>=50)return 'Good fit';return 'Review';}

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

  return <div className="shell premiumShell"><Sidebar/><main className="commandMain appHome">
    <header className="commandHeader homeHero"><div><div className="eyebrow">Your sales radar</div><h1>Find companies that already have a reason to buy.</h1><p>We watch fresh hiring activity, find the right decision maker, and prepare a personalized message for you to approve.</p></div><Link className="primary commandCta" href="/discover">Find new leads</Link></header>

    {dataUnavailable?<section className="commandAlert"><strong>Some lead data is temporarily unavailable.</strong><span>We are hiding anything we cannot verify.</span></section>:null}

    <section className="commandKpis simpleKpis">
      <div><span>New leads</span><strong>{dataUnavailable?'—':queue.length}</strong><small>{activeProfile?`Found from the last ${activeProfile.lookback_days} days`:'Choose an offer profile first'}</small></div>
      <div><span>People found</span><strong>{dataUnavailable?'—':verifiedCount}</strong><small>With a verified work email</small></div>
      <div><span>Messages ready</span><strong>{dataUnavailable?'—':draftCount}</strong><small>Waiting for your approval</small></div>
      <div><span>Last search</span><strong>{latestRun?String(latestRun.status).replaceAll('_',' '):'Not run'}</strong><small>{latestRun?`${latestRun.accounts_discovered||0} companies checked`:'Run your first search'}</small></div>
    </section>

    {spotlight?<section className="revenueSpotlight leadSpotlight">
      <div className="revenueSpotlightMain"><div className="spotlightTop"><div><span className="signalBadge">Best lead right now</span><h2>{spotlight.account.name}</h2><p>{spotlight.account.domain}{spotlight.account.country?` · ${spotlight.account.country}`:''}</p></div><div className="opportunityNumber"><strong>{score(spotlight.match.opportunity_score)}</strong><span>{fitLabel(spotlight.match.opportunity_score)}</span></div></div>
      <div className="hiringReason"><span>Why this company now</span><h3>They are hiring a {spotlight.job.title}</h3><p>The role was posted {ago(spotlight.job.evidence?.postedAt||spotlight.job.observed_at)}. That creates a timely reason to offer an alternative to another full-time hire.</p><a href={spotlight.job.source_url} target="_blank" rel="noreferrer">View the job post ↗</a></div>
      <div className="spotlightEvidence plainEvidence"><div><span>Company fit</span><strong>{fitLabel(spotlight.match.fit_score)}</strong></div><div><span>Hiring signal</span><strong>{score(spotlight.match.intent_score)} / 100</strong></div><div><span>Extra evidence</span><strong>{score(spotlight.match.need_score)} / 100</strong></div></div></div>
      <aside className="revenueSpotlightAside"><span className="eyebrow">Ready to contact?</span>{spotlight.buyer?<><h3>{spotlight.buyer.full_name||[spotlight.buyer.first_name,spotlight.buyer.last_name].filter(Boolean).join(' ')}</h3><div className="buyerMini"><span>{spotlight.buyer.title}</span><small>{spotlight.buyer.email}</small></div></>:<><h3>We still need the right person.</h3><p>The lead is real, but we will not prepare outreach until a work email is verified.</p></>}{spotlight.draft?<Link className="primary" href="/outreach">Review message</Link>:<Link className="primary" href={`/accounts/${spotlight.account.id}`}>Review lead</Link>}<small className="safetyNote">Nothing is sent automatically.</small></aside>
    </section>:<section className="revenueEmpty"><span className="eyebrow">Start here</span><h2>Find companies hiring for work you can sell instead.</h2><p>Revenue Agent looks for fresh job postings, checks company fit, finds a decision maker, and prepares a message only when the lead is strong enough.</p><Link className="primary" href="/discover">Find my first leads</Link></section>}

    {queue.length?<section className="commandSection"><div className="commandSectionHead"><div><span className="eyebrow">Leads to review</span><h2>Best opportunities this week</h2></div><Link href="/accounts">See all leads →</Link></div><div className="revenueQueue">{queue.map(({match,account,job,buyer,draft},index)=><Link href={`/accounts/${account.id}`} className="revenueQueueRow" key={`${match.offer_profile_id}-${account.id}`}><span className="queueRank">{String(index+1).padStart(2,'0')}</span><div className="queueCompany"><strong>{account.name}</strong><small>Hiring {job.title} · {ago(job.evidence?.postedAt||job.observed_at)}</small></div><div className="queueTrigger"><span>Fit</span><strong>{fitLabel(match.opportunity_score)}</strong></div><div className="queueBuyer"><span>Contact</span><strong>{buyer?buyer.full_name||'Found':'Still looking'}</strong></div><div className="queueState"><span className={`stateDot ${draft?'stateReady':buyer?'stateBuyer':'stateResearch'}`}/><strong>{draft?'Message ready':buyer?'Contact ready':'Researching'}</strong></div><div className="queueScore">{score(match.opportunity_score)}</div></Link>)}</div></section>:null}

    <section className="commandFooterGrid simpleExplainer"><article><span className="eyebrow">1 · Find the moment</span><h3>A company posts a role you can replace.</h3><p>That hiring event is the reason to look. Other company signals help us decide if it is worth your time.</p></article><article><span className="eyebrow">2 · Find the person</span><h3>We identify the likely decision maker.</h3><p>A message is prepared only after a professional work email is verified. You review it before anything happens.</p></article></section>
  </main></div>;
}
