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
  return <div className="shell premiumShell"><Sidebar/><main className="commandMain">
    <header className="commandHeader"><div><div className="eyebrow">People</div><h1>The right person at each company.</h1><p>Decision makers ranked by role relevance, with work-email verification shown clearly.</p></div></header>
    {!error && contacts.length ? <section className="metrics"><div className="card"><span>People found</span><strong>{contacts.length}</strong><small>Across your active leads</small></div><div className="card"><span>Best contacts</span><strong>{primary}</strong><small>Likely decision makers</small></div><div className="card"><span>Verified emails</span><strong>{verified}</strong><small>Professional work emails</small></div><div className="card"><span>Sending</span><strong>Off</strong><small>You approve every message</small></div></section> : null}
    {error ? <section className="panel noticePanel"><div className="eyebrow">Could not load people</div><h2>We are not showing incomplete contact data.</h2><p>Try again shortly.</p></section> : contacts.length ? <section className="panel"><div className="panelHead"><div><span className="eyebrow">Best contacts</span><h2>People to reach when the timing is right</h2></div><span className="pill">{verified} verified</span></div><div className="buyerCards">{contacts.map((contact:any)=><Link href={`/accounts/${contact.account_id}`} className="buyerCard" key={contact.id}><div><strong>{contact.full_name || [contact.first_name,contact.last_name].filter(Boolean).join(' ') || 'Name pending'}</strong><small>{contact.title || 'Role pending'} · {contact.accounts?.name || contact.accounts?.domain || 'Company'}</small>{contact.email ? <small>{contact.email}</small> : <small>Work email not found yet</small>}</div><div><span className="pill">{contact.email_verified ? 'Verified' : contact.verification_status || 'Researching'}</span><small>{contact.is_primary_buyer ? 'Best contact' : 'Candidate'}</small></div></Link>)}</div></section> : <section className="panel emptyState"><div className="eyebrow">No people yet</div><h2>People appear after a company becomes a real lead.</h2><p>That keeps contact lookups focused on companies with a reason to buy instead of wasting credits on a giant database.</p><Link className="primary inlineAction" href="/accounts">View leads</Link></section>}
  </main></div>;
}
