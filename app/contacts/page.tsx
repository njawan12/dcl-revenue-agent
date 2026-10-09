import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase.from('contacts').select('id,account_id,full_name,first_name,last_name,title,email,email_verified,verification_status,buyer_score,is_primary_buyer,provider,email_provider,accounts!inner(name,domain)').eq('workspace_id', workspace.id).order('is_primary_buyer', { ascending:false }).order('buyer_score', { ascending:false, nullsFirst:false }).limit(200);
  const contacts:any[] = data || [];
  const verified = contacts.filter(contact=>contact.email_verified).length;
  const primary = contacts.filter(contact=>contact.is_primary_buyer).length;
  return <div className="shell"><Sidebar/><main>
    <header><div><div className="eyebrow">Buyer intelligence</div><h1>Contacts</h1><p>Ranked professional buyers for {workspace.name}. Verification is shown explicitly; a candidate is never treated as a send-ready recipient.</p></div></header>
    {!error && contacts.length ? <section className="metrics"><div className="card"><span>Buyer candidates</span><strong>{contacts.length}</strong><small>Workspace scoped</small></div><div className="card"><span>Primary buyers</span><strong>{primary}</strong><small>Ranked against account need</small></div><div className="card"><span>Verified emails</span><strong>{verified}</strong><small>Professional recipients only</small></div><div className="card"><span>Outreach boundary</span><strong>Human</strong><small>Approval remains required</small></div></section> : null}
    {error ? <section className="panel noticePanel"><div className="eyebrow">Buyer intelligence unavailable</div><h2>Contacts could not be loaded</h2><p>No verification or recipient-readiness conclusion is drawn from this failed read. Account-level buyer research remains the source of truth when service is restored.</p></section> : contacts.length ? <section className="panel"><div className="panelHead"><div><span className="eyebrow">Ranked buyer bench</span><h2>People worth investigating</h2></div><span className="pill">{verified} verified</span></div><div className="buyerCards">{contacts.map((contact:any)=><Link href={`/accounts/${contact.account_id}`} className="buyerCard" key={contact.id}><div><strong>{contact.full_name || [contact.first_name,contact.last_name].filter(Boolean).join(' ') || 'Named buyer pending'}</strong><small>{contact.title || 'Role pending'} · {contact.accounts?.name || contact.accounts?.domain || 'Account'}</small>{contact.email ? <small>{contact.email}</small> : <small>Email not revealed</small>}</div><div><span className="pill">{contact.email_verified ? 'Verified' : contact.verification_status || 'Candidate'}</span><small>{contact.is_primary_buyer ? 'Primary buyer · ' : ''}Score {contact.buyer_score ?? '—'}</small></div></Link>)}</div></section> : <section className="panel emptyState"><div className="eyebrow">Buyer intelligence</div><h2>No buyer bench yet</h2><p>Buyer research starts from a qualified account so role relevance can be evaluated before enrichment spend. Open an opportunity and research the people who own the observed problem.</p><Link className="primary inlineAction" href="/accounts">Open Accounts</Link></section>}
  </main></div>;
}
