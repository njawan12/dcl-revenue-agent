import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase.from('accounts').select('id,name,domain,industry,country,shopify,shopify_plus,opportunity_score,tier,suggested_buyer_role,recommended_motion').eq('workspace_id', workspace.id).order('opportunity_score', { ascending:false, nullsFirst:false }).limit(100);
  const accounts:any[] = data || [];
  return <div className="shell"><Sidebar/><main>
    <header><div><div className="eyebrow">Account intelligence</div><h1>Accounts</h1><p>Qualified commerce accounts for {workspace.name}, ranked for investigation rather than treated as a generic lead database.</p></div><Link className="primary inlineAction" href="/discover">Run discovery</Link></header>
    {error ? <section className="panel noticePanel"><div className="eyebrow">Intelligence unavailable</div><h2>Accounts could not be loaded</h2><p>The workspace remains active, but account ranking is withheld rather than showing an empty list that could be mistaken for no opportunities.</p></section> : accounts.length ? <section className="accountDirectory" aria-label="Ranked accounts">{accounts.map((account:any,index:number)=><Link key={account.id} href={`/accounts/${account.id}`} className="accountDirectoryRow"><div className="accountRank"><span>#{index+1}</span><strong>{account.opportunity_score ?? '—'}</strong></div><div className="accountIdentity"><strong>{account.name}</strong><small>{account.domain} · {[account.country,account.industry].filter(Boolean).join(' · ') || 'Market context pending'}</small></div><div className="accountMotion"><span className="eyebrow">Recommended motion</span><strong>{account.recommended_motion || 'Research first'}</strong><small>{account.suggested_buyer_role || 'Buyer mapping required'}</small></div><div className="accountOpen"><span className="pill">{account.tier || 'Un-tiered'}</span><strong aria-hidden="true">→</strong></div></Link>)}</section> : <section className="panel emptyState"><div className="eyebrow">Account intelligence</div><h2>Your opportunity bench starts with evidence</h2><p>No qualified accounts are persisted in this workspace yet. Run Discovery with a focused commerce research brief; accounts only appear here after the research pipeline records them.</p><Link className="primary inlineAction" href="/discover">Open Discovery</Link></section>}
  </main></div>;
}
