import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';
import { decideOutreach } from './actions';

export const dynamic = 'force-dynamic';

function text(value: unknown, fallback = '—') { return typeof value === 'string' && value.trim() ? value : fallback; }
function date(value: unknown) { if (typeof value !== 'string') return 'Unknown date'; const parsed = new Date(value); return Number.isNaN(parsed.valueOf()) ? 'Unknown date' : parsed.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }

export default async function OutreachPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const [workspace, query] = await Promise.all([requireActiveWorkspace(), searchParams]);
  const supabase = await createClient();
  const { data: held } = await supabase
    .from('outreach')
    .select('id,account_id,contact_id,status,current_revision_id,approved_revision_id,held_at,created_at')
    .eq('workspace_id', workspace.id)
    .not('current_revision_id','is',null)
    .order('held_at',{ascending:false,nullsFirst:false})
    .limit(30);

  const rows = held || [];
  const revisionIds = rows.map((row:any)=>row.current_revision_id).filter(Boolean);
  const accountIds = [...new Set(rows.map((row:any)=>row.account_id).filter(Boolean))];
  const [{ data: revisions }, { data: accounts }, { data: decisions }] = await Promise.all([
    revisionIds.length ? supabase.from('outreach_revisions').select('*').eq('workspace_id',workspace.id).in('id',revisionIds) : Promise.resolve({data:[] as any[]}),
    accountIds.length ? supabase.from('accounts').select('id,name,domain,country,opportunity_score,recommended_motion').eq('workspace_id',workspace.id).in('id',accountIds) : Promise.resolve({data:[] as any[]}),
    rows.length ? supabase.from('outreach_approvals').select('outreach_id,revision_id,decision,decision_note,decided_at').eq('workspace_id',workspace.id).order('decided_at',{ascending:false}) : Promise.resolve({data:[] as any[]}),
  ]);
  const revisionById = new Map((revisions || []).map((item:any)=>[item.id,item]));
  const accountById = new Map((accounts || []).map((item:any)=>[item.id,item]));
  const latestDecision = new Map<string,any>();
  for (const item of decisions || []) if (!latestDecision.has(item.outreach_id)) latestDecision.set(item.outreach_id,item);
  const canReview = ['owner','admin'].includes(workspace.role);
  const pendingCount = rows.filter((row:any)=>row.status === 'ready').length;
  const approvedCount = rows.filter((row:any)=>row.approved_revision_id === row.current_revision_id).length;

  return <div className="shell"><Sidebar/><main>
    <header className="outboxHeader"><div><div className="eyebrow">Human approval boundary</div><h1>Held outbox</h1><p>Inspect the exact message, evidence, recipient and compliance receipt before making a decision. Approval never sends.</p></div><div className="outboxSafety"><strong>Sending disabled</strong><span>Every message remains held after approval.</span></div></header>
    {query.error ? <section className="panel noticePanel"><strong>Review blocked</strong><p>{query.error}</p></section> : null}
    {query.notice ? <section className="panel noticePanel"><strong>{query.notice}</strong></section> : null}
    <section className="metrics outboxMetrics"><div className="card"><span>Awaiting review</span><strong>{pendingCount}</strong><small>Exact revisions</small></div><div className="card"><span>Approved & held</span><strong>{approvedCount}</strong><small>Not sent</small></div><div className="card"><span>Review mode</span><strong>Human</strong><small>Owner/admin only</small></div><div className="card"><span>Autonomous send</span><strong>Off</strong><small>Hard boundary</small></div></section>

    {rows.length ? <div className="outboxStack">{rows.map((row:any)=>{
      const revision:any = revisionById.get(row.current_revision_id);
      const account:any = accountById.get(row.account_id);
      if (!revision || !account) return null;
      const recipient:any = revision.recipient_snapshot || {};
      const evidence:any[] = Array.isArray(revision.evidence_snapshot) ? revision.evidence_snapshot : [];
      const proof:any[] = Array.isArray(revision.proof_snapshot) ? revision.proof_snapshot : [];
      const compliance:any = revision.compliance_snapshot || {};
      const decision:any = latestDecision.get(row.id);
      const approved = row.approved_revision_id === revision.id && row.status === 'approved';
      return <article className="outboxCard" key={row.id}>
        <div className="outboxTop"><div><div className="eyebrow">{approved ? 'Approved · still held' : decision?.decision === 'rejected' ? 'Rejected' : 'Awaiting review'}</div><h2>{account.name}</h2><p>{account.domain} · {text(recipient.name,'Verified buyer')} · {text(recipient.title,'Role unavailable')}</p></div><div className="outboxScore"><span>Opportunity</span><strong>{account.opportunity_score ?? '—'}</strong></div></div>
        <div className="reviewGrid">
          <section className="messagePreview"><span className="eyebrow">Exact revision #{revision.revision_number}</span><div className="subjectLine"><small>Subject</small><strong>{revision.subject || '(no subject)'}</strong></div><pre>{revision.body}</pre><div className="hashLine"><span>SHA-256</span><code>{revision.content_hash}</code></div></section>
          <aside className="receiptRail"><div><span className="eyebrow">Reason to contact</span><p>{revision.reason_to_contact}</p></div><div><span className="eyebrow">Recipient receipt</span><strong>{text(recipient.email)}</strong><small>{recipient.emailVerified ? 'Verified business email' : 'Not verified'} · {text(recipient.verificationSource,'source unavailable')}</small></div><div><span className="eyebrow">Compliance receipt</span><div className="receiptChecks"><span>Human approval {compliance.humanApprovalRequired === true ? '✓' : '✕'}</span><span>Autonomous send {compliance.autonomousSendEnabled === false ? 'off ✓' : 'unsafe ✕'}</span><span>Suppressed {compliance.suppressed === false ? 'no ✓' : 'yes ✕'}</span><span>Jurisdiction {text(compliance.jurisdictionReviewStatus,'review required')}</span></div></div></aside>
        </div>
        <div className="receiptSection"><div className="panelHead"><div><span className="eyebrow">Evidence receipts</span><h2>What justifies this message</h2></div><span className="pill">{evidence.length} observed</span></div><div className="evidenceList">{evidence.map((item:any,index:number)=><div className="evidenceItem" key={item.id || index}><div><strong>{text(item.title,'Observed evidence')}</strong><small>{text(item.type,'signal')} · {text(item.sourceName,'source')} · {date(item.observedAt)}</small></div>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">Inspect source ↗</a> : <span className="pill">Persisted</span>}</div>)}</div>{proof.length ? <p className="proofNote">Approved proof available: {proof.map((item:any)=>item.clientName).filter(Boolean).join(', ')}. No proof claim is inserted into this revision unless explicitly reviewed.</p> : <p className="proofNote">No case-study claim is used in this revision.</p>}</div>
        <div className="reviewFooter"><div><Link className="back" href={`/accounts/${account.id}`}>Open opportunity intelligence →</Link>{decision ? <small>Latest decision: {decision.decision} · {date(decision.decided_at)}</small> : <small>Prepared {date(revision.created_at)} · motion {text(revision.motion,'research-first')}</small>}</div>{canReview && !approved ? <form action={decideOutreach} className="reviewActions"><input type="hidden" name="outreachId" value={row.id}/><input type="hidden" name="revisionId" value={revision.id}/><input name="note" aria-label="Review note" placeholder="Optional review note"/><button className="ghost" name="decision" value="rejected" type="submit">Reject</button><button className="primary" name="decision" value="approved" type="submit">Approve exact revision</button></form> : <div className="approvalSeal"><strong>{approved ? 'Approved' : 'Review locked'}</strong><span>{approved ? 'Still held. Nothing sent.' : 'Owner/admin required.'}</span></div>}</div>
      </article>;
    })}</div> : <section className="panel emptyState"><div className="eyebrow">Held outbox</div><h2>Nothing is waiting for review</h2><p>When an evidence-backed opportunity has a verified buyer, prepare outreach from its Opportunity Intelligence page. The draft will appear here without being sent.</p><Link className="primary inlineAction" href="/">Return to Command Center</Link></section>}
  </main></div>;
}
