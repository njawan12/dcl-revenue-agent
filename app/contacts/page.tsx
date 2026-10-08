import { Sidebar } from '../../components/Sidebar';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('id,account_id,full_name,first_name,last_name,title,email,email_verified,verification_status,buyer_score,is_primary_buyer,provider,email_provider,accounts!inner(name,domain)')
    .eq('workspace_id', workspace.id)
    .order('is_primary_buyer', { ascending:false })
    .order('buyer_score', { ascending:false, nullsFirst:false })
    .limit(200);
  if (error) throw new Error(error.message);

  return <div className="shell"><Sidebar/><main>
    <header><div><div className="eyebrow">Buyer intelligence</div><h1>Contacts</h1><p>Ranked and verified decision-makers for {workspace.name}.</p></div></header>
    <section className="panel">
      <div className="table">
        <div className="row tableHeader"><span>Score</span><span>Person</span><span>Company</span><span>Role</span><span>Email</span><span>Status</span></div>
        {(data || []).map((contact:any)=><a href={`/accounts/${contact.account_id}`} className="row" key={contact.id}><strong>{contact.buyer_score ?? '—'}</strong><span><strong>{contact.full_name || [contact.first_name,contact.last_name].filter(Boolean).join(' ')}</strong>{contact.is_primary_buyer ? <><br/><small>Primary buyer</small></> : null}</span><span>{contact.accounts?.name || contact.accounts?.domain || '—'}</span><span>{contact.title || '—'}</span><span>{contact.email || 'Not revealed'}</span><span className="pill">{contact.email_verified ? 'verified' : contact.verification_status || 'candidate'}</span></a>)}
      </div>
      {!data?.length ? <p>No buyer contacts yet. Open a qualified account and run buyer research.</p> : null}
    </section>
  </main></div>;
}
