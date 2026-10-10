import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Sidebar } from '../../../components/Sidebar';
import { createClient } from '../../../lib/supabase/server';
import { requireActiveWorkspace } from '../../../lib/workspaces/session';

export const dynamic = 'force-dynamic';

function humanize(value:string){return String(value||'').replace(/[_-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
function when(value:string|undefined|null){if(!value)return 'Date unavailable';const d=new Date(value);return Number.isNaN(d.getTime())?'Date unavailable':d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}
function age(value:string|undefined|null){if(!value)return 'recently';const t=new Date(value).getTime();if(!Number.isFinite(t))return 'recently';const days=Math.max(0,Math.floor((Date.now()-t)/86400000));return days===0?'today':days===1?'yesterday':`${days} days ago`;}
function n(value:any){const x=Number(value);return Number.isFinite(x)?Math.round(x):0;}
function fit(value:any){const s=n(value);if(s>=80)return 'Excellent fit';if(s>=65)return 'Strong fit';if(s>=50)return 'Good fit';return 'Review';}

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
  const nextMove=heldDraft?'Review the message':primaryBuyer?.email_verified?'Prepare a message':primaryJob?'Find the right person':'Wait for a fresh trigger';

  return <div className="shell premiumShell"><Sidebar/><main className="commandMain">
    <Link className="back" href="/">← Back to leads</Link>
    {partial?<div className="commandAlert"><strong>Some lead data is temporarily unavailable.</strong><span>Anything we cannot verify is hidden.</span></div>:null}

    <section className="intelligenceBrief">
      <div className="briefMain"><div className="eyebrow">Lead overview</div><h1>{account.name}</h1><p className="briefMeta">{account.domain}{account.country?` · ${account.country}`:''}{account.industry?` · ${account.industry}`:''}{account.employee_count?` · ${account.employee_count.toLocaleString()} employees`:''}</p>
        {primaryJob?<div className="briefJob"><span>Why now · posted {age(primaryJob.evidence?.postedAt||primaryJob.observed_at)}</span><h2>They are hiring a {primaryJob.title}</h2><p>{primaryJob.evidence?.descriptionExcerpt?String(primaryJob.evidence.descriptionExcerpt).slice(0,280):'This fresh opening creates a timely reason to offer an alternative to another full-time hire.'}</p><a href={primaryJob.source_url} target="_blank" rel="noreferrer">View job post ↗</a></div>:<div className="briefJob"><span>No fresh trigger</span><h2>We do not have a recent target job opening for this company.</h2><p>This lead should not be contacted until a valid reason appears.</p></div>}
        <div className="briefScoreGrid"><div><span>Company fit</span><strong>{fit(match?.fit_score??account.fit_score)}</strong></div><div><span>Hiring signal</span><strong>{n(match?.intent_score??account.intent_score)}</strong></div><div><span>Extra evidence</span><strong>{n(match?.need_score??account.need_score)}</strong></div><div><span>Overall</span><strong>{n(match?.opportunity_score??account.opportunity_score)}</strong></div></div>
      </div>
      <aside className="briefRail"><span className="eyebrow">Next step</span><h2>{nextMove}</h2>{primaryBuyer?<div className="briefBuyer"><strong>{primaryBuyer.full_name||[primaryBuyer.first_name,primaryBuyer.last_name].filter(Boolean).join(' ')}</strong><span>{primaryBuyer.title||match?.suggested_buyer_role||'Decision maker'}</span><small>{primaryBuyer.email_verified?primaryBuyer.email:'Work email still needs verification'}</small></div>:<div className="briefBuyer"><strong>{match?.suggested_buyer_role||profile?.buyer_roles?.[0]||'Decision maker needed'}</strong><span>We have not verified the right person yet</span><small>No verified work email means no message is prepared.</small></div>}{heldDraft?<Link className="primary" href="/outreach">Review message</Link>:<Link className="primary" href="/discover">Continue research</Link>}<small className="safetyNote">Nothing is sent automatically.</small></aside>
    </section>

    <section className="storyPanel"><div className="commandSectionHead"><div><span className="eyebrow">Why this lead matters</span><h2>The simple case for reaching out</h2></div><span className="pill">{fit(match?.opportunity_score??account.opportunity_score)}</span></div><div className="storyList"><div className="storyRow"><span>Reason</span><strong>{primaryJob?`Hiring ${primaryJob.title} · ${age(primaryJob.evidence?.postedAt||primaryJob.observed_at)}`:'No fresh hiring reason'}</strong>{primaryJob?<a href={primaryJob.source_url} target="_blank" rel="noreferrer">Source ↗</a>:<span/>}</div><div className="storyRow"><span>What we can offer</span><strong>{profile?.offer?.positioning||'Your active offer profile decides what to sell instead of the hire.'}</strong><span/></div><div className="storyRow"><span>Who to contact</span><strong>{primaryBuyer?`${primaryBuyer.full_name||'Named contact'} · ${primaryBuyer.title||'role pending'}`:(match?.suggested_buyer_role||'Research in progress')}</strong><span>{primaryBuyer?.email_verified?'Verified':'Not ready'}</span></div><div className="storyRow"><span>Message</span><strong>{heldDraft?heldDraft.subject||'Message ready for review':'No message yet'}</strong><span>{heldDraft?'Ready for you':'Waiting on research'}</span></div></div></section>

    <section className="storyPanel"><div className="commandSectionHead"><div><span className="eyebrow">What else we know</span><h2>Extra signals that make the message more relevant</h2></div></div>{secondarySignals.length?<div className="storyList">{secondarySignals.map(signal=><div className="storyRow" key={signal.id}><span>{humanize(signal.signal_type)}</span><strong>{signal.title}</strong>{signal.source_url?<a href={signal.source_url} target="_blank" rel="noreferrer">View ↗</a>:<span/>}</div>)}</div>:<p>No extra company signals yet. The hiring event is enough to keep this lead on the radar.</p>}</section>

    <section className="storyPanel"><div className="commandSectionHead"><div><span className="eyebrow">People</span><h2>Contacts found at this company</h2></div></div>{contacts.length?<div className="storyList">{contacts.map(contact=><div className="storyRow" key={contact.id}><span>{contact.is_primary_buyer?'Best contact':'Candidate'}</span><strong>{contact.full_name||[contact.first_name,contact.last_name].filter(Boolean).join(' ')} · {contact.title||'Role unknown'}</strong><span>{contact.email_verified?'Verified work email':contact.verification_status||'Not verified'}</span></div>)}</div>:<p>No contacts have been found yet.</p>}</section>

    <section className="storyPanel"><div className="commandSectionHead"><div><span className="eyebrow">Activity</span><h2>What changed recently</h2></div></div>{(jobSignals.length||pipeline.length)?<div className="storyList">{[...jobSignals.map(s=>({id:`j-${s.id}`,label:'Hiring',title:s.title,detail:when(s.observed_at),url:s.source_url,at:s.observed_at})),...pipeline.map(p=>({id:`p-${p.id}`,label:'Pipeline',title:p.previous_stage===p.stage?(p.next_action||'Next step updated'):`${humanize(p.previous_stage)} → ${humanize(p.stage)}`,detail:when(p.recorded_at),url:null,at:p.recorded_at}))].sort((a,b)=>new Date(b.at||0).getTime()-new Date(a.at||0).getTime()).slice(0,12).map(item=><div className="storyRow" key={item.id}><span>{item.label}</span><strong>{item.title} · {item.detail}</strong>{item.url?<a href={item.url} target="_blank" rel="noreferrer">Source ↗</a>:<span/>}</div>)}</div>:<p>No recent activity yet.</p>}</section>
  </main></div>;
}
