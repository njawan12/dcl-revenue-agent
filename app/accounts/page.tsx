import { Sidebar } from '../../components/Sidebar';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('id,name,domain,industry,country,shopify,shopify_plus,opportunity_score,tier,suggested_buyer_role,recommended_motion')
    .eq('workspace_id', workspace.id)
    .order('opportunity_score', { ascending:false, nullsFirst:false })
    .limit(100);
  if (error) throw new Error(error.message);

  return <div className="shell"><Sidebar/><main>
    <header><div><div className="eyebrow">Account intelligence</div><h1>Accounts</h1><p>Qualified commerce accounts for {workspace.name}, ranked by opportunity score.</p></div></header>
    <section className="panel">
      <div className="table">
        <div className="row tableHeader"><span>Score</span><span>Company</span><span>Market</span><span>Buyer</span><span>Motion</span><span>Tier</span></div>
        {(data || []).map((account:any)=><a key={account.id} href={`/accounts/${account.id}`} className="row"><strong>{account.opportunity_score ?? '—'}</strong><span><strong>{account.name}</strong><br/><small>{account.domain}</small></span><span>{[account.country, account.industry].filter(Boolean).join(' · ') || '—'}</span><span>{account.suggested_buyer_role || 'Research first'}</span><span>{account.recommended_motion || '—'}</span><span className="pill">{account.tier}</span></a>)}
      </div>
      {!data?.length ? <p>No live accounts yet. Run discovery for this workspace first.</p> : null}
    </section>
  </main></div>;
}
