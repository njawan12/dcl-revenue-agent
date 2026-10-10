import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';
import { PIPELINE_STAGES } from '../../lib/pipeline/stages';

export const dynamic = 'force-dynamic';

function fit(value:any){const n=Number(value);if(n>=80)return 'Excellent';if(n>=65)return 'Strong';if(n>=50)return 'Good';return 'Review';}
function label(value:string){return value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());}

export default async function AccountsPage({searchParams}:{searchParams:Promise<{q?:string;stage?:string;fit?:string}>}) {
  const [workspace,params] = await Promise.all([requireActiveWorkspace(),searchParams]);
  const supabase = await createClient();
  const q = String(params.q||'').trim();
  const stage = String(params.stage||'').trim();
  const fitFilter = String(params.fit||'').trim();
  let request = supabase.from('accounts').select('id,name,domain,industry,country,shopify,shopify_plus,opportunity_score,tier,suggested_buyer_role,recommended_motion,pipeline_stage').eq('workspace_id', workspace.id);
  if (q) request = request.ilike('name', `%${q.replace(/[%_]/g,'')}%`);
  if (stage && PIPELINE_STAGES.includes(stage)) request = request.eq('pipeline_stage', stage);
  if (fitFilter === 'excellent') request = request.gte('opportunity_score',80);
  else if (fitFilter === 'strong') request = request.gte('opportunity_score',65).lt('opportunity_score',80);
  else if (fitFilter === 'good') request = request.gte('opportunity_score',50).lt('opportunity_score',65);
  const { data, error } = await request.order('opportunity_score', { ascending:false, nullsFirst:false }).limit(100);
  const accounts:any[] = data || [];
  const hasFilters = Boolean(q||stage||fitFilter);
  return <div className="shell premiumShell"><Sidebar/><main className="commandMain">
    <header className="commandHeader"><div><div className="eyebrow">Leads</div><h1>Companies worth your time.</h1><p>Ranked by how strong the buying moment looks right now.</p></div><Link className="primary inlineAction" href="/discover">Find new leads</Link></header>
    <form className="leadFilters" method="get"><label><span>Search companies</span><input name="q" defaultValue={q} placeholder="Search by company name"/></label><label><span>Stage</span><select name="stage" defaultValue={stage}><option value="">All stages</option>{PIPELINE_STAGES.map(value=><option value={value} key={value}>{label(value)}</option>)}</select></label><label><span>Fit</span><select name="fit" defaultValue={fitFilter}><option value="">Any fit</option><option value="excellent">Excellent</option><option value="strong">Strong</option><option value="good">Good</option></select></label><button className="primary" type="submit">Apply</button>{hasFilters?<Link className="ghost clearFilters" href="/accounts">Clear</Link>:null}</form>
    {error ? <section className="panel noticePanel"><div className="eyebrow">Could not load leads</div><h2>We are not showing incomplete results.</h2><p>Try again shortly. Anything we cannot verify stays hidden.</p></section> : accounts.length ? <><div className="leadListMeta"><strong>{accounts.length} lead{accounts.length===1?'':'s'}</strong><span>{hasFilters?'matching your filters':'ranked by priority'}</span></div><section className="accountDirectory" aria-label="Ranked leads">{accounts.map((account:any,index:number)=><Link key={account.id} href={`/accounts/${account.id}`} className="accountDirectoryRow"><div className="accountRank"><span>#{index+1}</span><strong>{account.opportunity_score ?? '—'}</strong></div><div className="accountIdentity"><strong>{account.name}</strong><small>{account.domain} · {[account.country,account.industry].filter(Boolean).join(' · ') || 'Company details pending'}</small></div><div className="accountMotion"><span className="eyebrow">Best next step</span><strong>{account.recommended_motion || 'Review the lead'}</strong><small>{account.suggested_buyer_role || 'Find the right decision maker'}</small></div><div className="accountOpen"><span className="pill">{fit(account.opportunity_score)} fit</span><small>{label(account.pipeline_stage||'new')}</small><strong aria-hidden="true">→</strong></div></Link>)}</section></> : <section className="panel emptyState"><div className="eyebrow">No leads found</div><h2>{hasFilters?'Try a wider search.':'Start with companies that are actively hiring.'}</h2><p>{hasFilters?'Clear one or more filters to see more companies.':'Run a search and Revenue Agent will bring back the companies with the strongest reason to talk now.'}</p>{hasFilters?<Link className="primary inlineAction" href="/accounts">Clear filters</Link>:<Link className="primary inlineAction" href="/discover">Find leads</Link>}</section>}
  </main></div>;
}
