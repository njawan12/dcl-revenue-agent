import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

export const dynamic = 'force-dynamic';

function fit(value:any){const n=Number(value);if(n>=80)return 'Excellent';if(n>=65)return 'Strong';if(n>=50)return 'Good';return 'Review';}

export default async function AccountsPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase.from('accounts').select('id,name,domain,industry,country,shopify,shopify_plus,opportunity_score,tier,suggested_buyer_role,recommended_motion').eq('workspace_id', workspace.id).order('opportunity_score', { ascending:false, nullsFirst:false }).limit(100);
  const accounts:any[] = data || [];
  return <div className="shell premiumShell"><Sidebar/><main className="commandMain">
    <header className="commandHeader"><div><div className="eyebrow">Leads</div><h1>Companies worth your time.</h1><p>Ranked by how strong the buying moment looks right now.</p></div><Link className="primary inlineAction" href="/discover">Find new leads</Link></header>
    {error ? <section className="panel noticePanel"><div className="eyebrow">Could not load leads</div><h2>We are not showing incomplete results.</h2><p>Try again shortly. Anything we cannot verify stays hidden.</p></section> : accounts.length ? <section className="accountDirectory" aria-label="Ranked leads">{accounts.map((account:any,index:number)=><Link key={account.id} href={`/accounts/${account.id}`} className="accountDirectoryRow"><div className="accountRank"><span>#{index+1}</span><strong>{account.opportunity_score ?? '—'}</strong></div><div className="accountIdentity"><strong>{account.name}</strong><small>{account.domain} · {[account.country,account.industry].filter(Boolean).join(' · ') || 'Company details pending'}</small></div><div className="accountMotion"><span className="eyebrow">Best next step</span><strong>{account.recommended_motion || 'Review the lead'}</strong><small>{account.suggested_buyer_role || 'Find the right decision maker'}</small></div><div className="accountOpen"><span className="pill">{fit(account.opportunity_score)} fit</span><strong aria-hidden="true">→</strong></div></Link>)}</section> : <section className="panel emptyState"><div className="eyebrow">No leads yet</div><h2>Start with companies that are actively hiring.</h2><p>Run a search and Revenue Agent will bring back the companies with the strongest reason to talk now.</p><Link className="primary inlineAction" href="/discover">Find leads</Link></section>}
  </main></div>;
}
