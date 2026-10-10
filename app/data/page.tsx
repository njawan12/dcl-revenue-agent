import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';
import { deleteGlobalView, saveGlobalView } from './actions';

export const dynamic = 'force-dynamic';

export default async function GlobalDataPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const [workspace,params]=await Promise.all([requireActiveWorkspace(),searchParams]);
  const supabase=await createClient();
  const q=String(params.q||'').trim(); const type=String(params.type||'all');
  const [accountsResult,contactsResult,outreachResult,viewsResult]=await Promise.all([
    supabase.from('accounts').select('id,name,domain,country,industry,opportunity_score,pipeline_stage,updated_at').eq('workspace_id',workspace.id).order('updated_at',{ascending:false}).limit(200),
    supabase.from('contacts').select('id,account_id,full_name,first_name,last_name,title,email,email_verified,updated_at,accounts!inner(name,domain)').eq('workspace_id',workspace.id).order('updated_at',{ascending:false}).limit(200),
    supabase.from('outreach').select('id,account_id,status,subject,created_at,accounts!inner(name,domain)').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).limit(200),
    supabase.from('saved_views').select('id,name,entity_type,filters,shared,owner_user_id,updated_at').eq('workspace_id',workspace.id).order('updated_at',{ascending:false}).limit(50),
  ]);
  const accountRows:any[]=accountsResult.data||[]; const contactRows:any[]=contactsResult.data||[]; const messageRows:any[]=outreachResult.data||[]; const views:any[]=viewsResult.data||[];
  const needle=q.toLowerCase();
  const accounts=accountRows.filter(a=>!needle||`${a.name} ${a.domain} ${a.country||''} ${a.industry||''}`.toLowerCase().includes(needle));
  const contacts=contactRows.filter(c=>!needle||`${c.full_name||''} ${c.first_name||''} ${c.last_name||''} ${c.title||''} ${c.email||''} ${c.accounts?.name||''}`.toLowerCase().includes(needle));
  const messages=messageRows.filter(m=>!needle||`${m.subject||''} ${m.status||''} ${m.accounts?.name||''}`.toLowerCase().includes(needle));
  const showAccounts=type==='all'||type==='companies'; const showContacts=type==='all'||type==='people'; const showMessages=type==='all'||type==='messages';
  const readError=Boolean(accountsResult.error||contactsResult.error||outreachResult.error);
  return <div className="shell premiumShell"><Sidebar/><main className="commandMain">
    <header className="commandHeader"><div><div className="eyebrow">Global Data</div><h1>Everything your team knows, in one place.</h1><p>Search companies, people and messages without jumping between separate tools.</p></div></header>
    {params.notice?<div className="commandAlert"><strong>{params.notice}</strong></div>:null}{params.error?<div className="commandAlert"><strong>Could not save</strong><span>{params.error}</span></div>:null}
    <form className="globalSearch" method="get"><input name="q" defaultValue={q} placeholder="Search company, person, email or message"/><select name="type" defaultValue={type}><option value="all">Everything</option><option value="companies">Companies</option><option value="people">People</option><option value="messages">Messages</option></select><button className="primary" type="submit">Search</button>{q||type!=='all'?<Link className="ghost" href="/data">Clear</Link>:null}</form>
    <section className="savedViewStrip"><div><span className="eyebrow">Saved views</span><div className="savedViewLinks"><Link href="/data">All data</Link>{views.map(view=><span className="savedViewItem" key={view.id}><Link href={`/data?q=${encodeURIComponent(view.filters?.q||'')}&type=${encodeURIComponent(view.filters?.type||'all')}`}>{view.name}</Link><form action={deleteGlobalView}><input type="hidden" name="id" value={view.id}/><button aria-label={`Delete ${view.name}`} type="submit">×</button></form></span>)}</div></div><details><summary>Save this view</summary><form action={saveGlobalView} className="saveViewForm"><input type="hidden" name="q" value={q}/><input type="hidden" name="type" value={type}/><input name="name" placeholder="e.g. Strong US leads" required/><label><input type="checkbox" name="shared"/> Share with workspace</label><button className="primary" type="submit">Save</button></form></details></section>
    {readError?<div className="commandAlert"><strong>Some data is unavailable.</strong><span>Incomplete records are hidden rather than guessed.</span></div>:null}
    <section className="globalDataGrid">
      {showAccounts?<article className="globalDataPanel"><div className="panelHead"><div><span className="eyebrow">Companies</span><h2>{accounts.length} found</h2></div><Link href="/accounts">Open leads →</Link></div><div className="globalRows">{accounts.slice(0,50).map(a=><Link href={`/accounts/${a.id}`} key={a.id}><div><strong>{a.name}</strong><small>{a.domain} · {[a.country,a.industry].filter(Boolean).join(' · ')}</small></div><div><span>{a.pipeline_stage||'new'}</span><strong>{a.opportunity_score??'—'}</strong></div></Link>)}</div></article>:null}
      {showContacts?<article className="globalDataPanel"><div className="panelHead"><div><span className="eyebrow">People</span><h2>{contacts.length} found</h2></div><Link href="/contacts">Open people →</Link></div><div className="globalRows">{contacts.slice(0,50).map(c=><Link href={`/accounts/${c.account_id}`} key={c.id}><div><strong>{c.full_name||[c.first_name,c.last_name].filter(Boolean).join(' ')||'Name pending'}</strong><small>{c.title||'Role pending'} · {c.accounts?.name||'Company'}</small></div><div><span>{c.email_verified?'Verified':'Researching'}</span><small>{c.email||'No email yet'}</small></div></Link>)}</div></article>:null}
      {showMessages?<article className="globalDataPanel"><div className="panelHead"><div><span className="eyebrow">Messages</span><h2>{messages.length} found</h2></div><Link href="/outreach">Open messages →</Link></div><div className="globalRows">{messages.slice(0,50).map(m=><Link href="/outreach" key={m.id}><div><strong>{m.subject||'Draft message'}</strong><small>{m.accounts?.name||'Company'}</small></div><div><span>{String(m.status||'draft').replaceAll('_',' ')}</span><small>{new Date(m.created_at).toLocaleDateString()}</small></div></Link>)}</div></article>:null}
    </section>
  </main></div>;
}
