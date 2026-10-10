import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Sidebar } from '../../../components/Sidebar';
import { createClient } from '../../../lib/supabase/server';
import { requireActiveWorkspace } from '../../../lib/workspaces/session';

export const dynamic = 'force-dynamic';

function humanize(value:string){return String(value||'').replace(/[_-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
function when(value:string|undefined|null){if(!value)return 'Date unavailable';const d=new Date(value);return Number.isNaN(d.getTime())?'Date unavailable':d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}
function age(value:string|undefined|null){if(!value)return 'date unknown';const t=new Date(value).getTime();if(!Number.isFinite(t))return 'date unknown';const days=Math.max(0,Math.floor((Date.now()-t)/86400000));return days===0?'today':days===1?'yesterday':`${days} days ago`;}
function n(value:any){const x=Number(value);return Number.isFinite(x)?Math.round(x):0;}

export default async function AccountPage({params}:{params:Promise<{id:string}>}){
  const [{id},workspace]=await Promise.all([params,requireActiveWorkspace()]);
  const supabase=await createClient();
  const [accountResult,matchesResult,signalsResult,contactsResult,outreachResult,profilesResult,pipelineResult]=await Promise.all([
    supabase.from('accounts').select('*').eq('workspace_id',workspace.id).eq('id',id).maybeSingle(),
    supabase.from('profile_account_matches').select('*').eq('workspace_id',workspace.id).eq('account_id',id).order('opportunity_score',{ascending:false,nullsFirst:false}).limit(1),
    supabase.from('signals').select('*').eq('workspace_id',workspace.id).eq('account_id',id).order('observed_at',{ascending:false}).limit(40),
    supabase.from('contacts').select('*').eq('workspace_id',workspace.id).eq('account_id',id).order('is_primary_buyer',{ascending:false}).order('buyer_score',{ascending:false,nullsFirst:false}),
    supabase.from('outreach').select('id,status,subject,body,current_revision_id,approved_revision_id,offer_profile_id,created_at').eq('workspace_id',workspace.id).eq('account_id',id).order('created_at',{ascending:false}).limit(5),
    supabase.from('offer_profiles').select('id,name,profile_key,buyer_roles,offer,email_config').eq('workspace_id',workspace.id),
    supabase.from('pipeline_events').select('id,previous_stage,stage,next_action,next_action_due,recorded_at').eq('workspace_id',workspace.id).eq('account_id',id).order('recorded_at',{ascending:false}).limit(8),
  ]);
  const account:any=accountResult.data;if(accountResult.error||!account)notFound();
  const match:any=matchesResult.data?.[0]||null; const signals:any[]=signalsResult.data||[]; const contacts:any[]=contactsResult.data||[]; const outreach:any[]=outreachResult.data||[]; const profiles:any[]=profilesResult.data||[]; const pipeline:any[]=pipelineResult.data||[];
  const profile=profiles.find(p=>p.id===match?.offer_profile_id)||profiles[0]||null;
  const jobSignals=signals.filter(s=>s.signal_type==='job'&&(!profile||s.offer_profile_id===profile.id));
  const primaryJob=jobSignals[0]||signals.find(s=>s.signal_type==='job')||null;
  const secondarySignals=signals.filter(s=>s.signal_type!=='job').slice(0,10);
  const primaryBuyer=contacts.find(c=>c.is_primary_buyer&&c.email_verified)||contacts.find(c=>c.is_primary_buyer)||contacts[0]||null;
  const heldDraft=outreach.find(o=>['ready','approved'].includes(o.status))||null;
  const partial=Boolean(matchesResult.error||signalsResult.error||contactsResult.error||outreachResult.error);
  const reason=match?.qualification_reason||'A recent hiring trigger exists, but this account still needs human review.';
  const nextMove=heldDraft?'Review the held draft':primaryBuyer?.email_verified?'Draft from verified evidence':primaryJob?'Find and verify the buyer':'Wait for a real trigger';
  const evidenceConfidence=Math.round(Number(match?.evidence_confidence||account.evidence_confidence||0)*100);

  return <div className="shell premiumShell"><Sidebar/><main className="commandMain">
    <Link className="back" href="/">← Revenue Command Center</Link>
    {partial?<div className="commandAlert"><strong>Some live intelligence could not be read.</strong><span>Readiness is withheld instead of guessed.</span></div>:null}

    <section className="intelligenceBrief">
      <div className="briefMain"><div className="eyebrow">Opportunity intelligence · {profile?.name||'Offer profile'}</div><h1>{account.name}</h1><p className="briefMeta">{account.domain}{account.country?` · ${account.country}`:''}{account.industry?` · ${account.industry}`:''}{account.employee_count?` · ${account.employee_count.toLocaleString()} employees`:''}</p>
        {primaryJob?<div className="briefJob"><span>Primary reason to contact · posted {age(primaryJob.evidence?.postedAt||primaryJob.observed_at)}</span><h2>{primaryJob.title}</h2><p>{primaryJob.evidence?.descriptionExcerpt?String(primaryJob.evidence.descriptionExcerpt).slice(0,280):'A configured target role is actively open. Hiring is the primary commercial trigger for this opportunity.'}</p><a href={primaryJob.source_url} target="_blank" rel="noreferrer">Inspect original job posting ↗</a></div>:<div className="briefJob"><span>No valid trigger</span><h2>No recent target hiring signal is attached.</h2><p>This account should not enter outbound preparation until a configured offer profile observes a valid hiring trigger.</p></div>}
        <div className="briefScoreGrid"><div><span>Fit</span><strong>{n(match?.fit_score??account.fit_score)}</strong></div><div><span>Hiring intent</span><strong>{n(match?.intent_score??account.intent_score)}</strong></div><div><span>Supporting need</span><strong>{n(match?.need_score??account.need_score)}</strong></div><div><span>Priority</span><strong>{n(match?.opportunity_score??account.opportunity_score)}</strong></div></div>
      </div>
      <aside className="briefRail"><span className="eyebrow">What should happen next</span><h2>{nextMove}</h2><p>{reason}</p>{primaryBuyer?<div className="briefBuyer"><strong>{primaryBuyer.full_name||[primaryBuyer.first_name,primaryBuyer.last_name].filter(Boolean).join(' ')}</strong><span>{primaryBuyer.title||match?.suggested_buyer_role||'Decision maker'}</span><small>{primaryBuyer.email_verified?primaryBuyer.email:'Work email not verified yet'}</small></div>:<div className="briefBuyer"><strong>{match?.suggested_buyer_role||profile?.buyer_roles?.[0]||'Decision maker required'}</strong><span>No named verified buyer yet</span><small>The engine will not draft until a professional work email is verified.</small></div>}{heldDraft?<Link className="primary" href="/outreach">Review held draft</Link>:<Link className="primary" href="/discover">Run hiring research</Link>}<small className="safetyNote">Sending remains disabled. Approval is bound to the exact draft revision.</small></aside>
    </section>

    <section className="storyPanel"><div className="commandSectionHead"><div><span className="eyebrow">Commercial story</span><h2>Why DCL has a reason to reach out</h2></div><span className="pill">{match?.tier||account.tier||'review'}</span></div><div className="storyList"><div className="storyRow"><span>Trigger</span><strong>{primaryJob?`${primaryJob.title} · ${age(primaryJob.evidence?.postedAt||primaryJob.observed_at)}`:'No valid hiring trigger'}</strong>{primaryJob?<a href={primaryJob.source_url} target="_blank" rel="noreferrer">Source ↗</a>:<span/>}</div><div className="storyRow"><span>Offer</span><strong>{profile?.offer?.positioning||'Configured offer profile determines what we sell instead of the hire.'}</strong><span/></div><div className="storyRow"><span>Buyer</span><strong>{primaryBuyer?`${primaryBuyer.full_name||'Named buyer'} · ${primaryBuyer.title||'role pending'}`:(match?.suggested_buyer_role||'Buyer research pending')}</strong><span>{primaryBuyer?.email_verified?'Verified':'Not ready'}</span></div><div className="storyRow"><span>Evidence quality</span><strong>{evidenceConfidence}% evidence confidence</strong><span>{signals.length} receipts</span></div><div className="storyRow"><span>Draft</span><strong>{heldDraft?heldDraft.subject||'Held draft ready':'No draft prepared'}</strong><span>{heldDraft?humanize(heldDraft.status):'Blocked until ready'}</span></div></div></section>

    <section className="storyPanel"><div className="commandSectionHead"><div><span className="eyebrow">Supporting evidence</span><h2>What strengthens the hiring signal</h2></div><span>{secondarySignals.length} observed</span></div>{secondarySignals.length?<div className="storyList">{secondarySignals.map(signal=><div className="storyRow" key={signal.id}><span>{humanize(signal.signal_type)}</span><strong>{signal.title}</strong>{signal.source_url?<a href={signal.source_url} target="_blank" rel="noreferrer">Inspect ↗</a>:<span/>}</div>)}</div>:<p>No secondary storefront or company evidence is required to create the trigger. When available, it is used only for prioritization and personalization.</p>}</section>

    <section className="storyPanel"><div className="commandSectionHead"><div><span className="eyebrow">Buyer bench</span><h2>People researched for this account</h2></div></div>{contacts.length?<div className="storyList">{contacts.map(contact=><div className="storyRow" key={contact.id}><span>{contact.is_primary_buyer?'Primary':'Candidate'}</span><strong>{contact.full_name||[contact.first_name,contact.last_name].filter(Boolean).join(' ')} · {contact.title||'Role unknown'}</strong><span>{contact.email_verified?'Verified work email':contact.verification_status||'Not verified'}</span></div>)}</div>:<p>No buyer candidates have been persisted yet.</p>}</section>

    <section className="storyPanel"><div className="commandSectionHead"><div><span className="eyebrow">Recorded movement</span><h2>Opportunity timeline</h2></div></div>{(jobSignals.length||pipeline.length)?<div className="storyList">{[...jobSignals.map(s=>({id:`j-${s.id}`,label:'Hiring',title:s.title,detail:when(s.observed_at),url:s.source_url,at:s.observed_at})),...pipeline.map(p=>({id:`p-${p.id}`,label:'Pipeline',title:p.previous_stage===p.stage?(p.next_action||'Next action updated'):`${humanize(p.previous_stage)} → ${humanize(p.stage)}`,detail:when(p.recorded_at),url:null,at:p.recorded_at}))].sort((a,b)=>new Date(b.at||0).getTime()-new Date(a.at||0).getTime()).slice(0,12).map(item=><div className="storyRow" key={item.id}><span>{item.label}</span><strong>{item.title} · {item.detail}</strong>{item.url?<a href={item.url} target="_blank" rel="noreferrer">Source ↗</a>:<span/>}</div>)}</div>:<p>No recorded movement yet.</p>}</section>
  </main></div>;
}
