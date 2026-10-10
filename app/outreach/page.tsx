import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';
import { decideOutreach } from './actions';

export const dynamic = 'force-dynamic';

function text(value: unknown, fallback = '—') { return typeof value === 'string' && value.trim() ? value : fallback; }
function date(value: unknown) { if (typeof value !== 'string') return 'Unknown date'; const parsed = new Date(value); return Number.isNaN(parsed.valueOf()) ? 'Unknown date' : parsed.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function simpleBlockReason(reason:string){const map:Record<string,string>={suppressed:'This person or company is on your do-not-contact list.',unverified_professional_email:'The work email is not verified yet.',unresolved_region:'The contact region is unknown.',policy_basis_unverified:'Your outreach policy for this region still needs review.',purpose_missing:'The outreach purpose is not configured.',source_provenance_unready:'The lead source still needs verification.'};return map[reason]||'This message is not ready to approve yet.';}

export default async function OutreachPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const [workspace, query] = await Promise.all([requireActiveWorkspace(), searchParams]);
  const supabase = await createClient();
  const { data: held } = await supabase.from('outreach').select('id,account_id,contact_id,status,current_revision_id,approved_revision_id,held_at,created_at').eq('workspace_id', workspace.id).not('current_revision_id','is',null).order('held_at',{ascending:false,nullsFirst:false}).limit(30);
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
  const latestDecision = new Map<string,any>(); for (const item of decisions || []) if (!latestDecision.has(item.outreach_id)) latestDecision.set(item.outreach_id,item);
  const canReview = ['owner','admin'].includes(workspace.role);
  const pendingCount = rows.filter((row:any)=>row.status === 'ready').length;
  const approvedCount = rows.filter((row:any)=>row.approved_revision_id === row.current_revision_id).length;

  return <div className="shell premiumShell"><Sidebar/><main className="commandMain">
    <header className="commandHeader"><div><div className="eyebrow">Messages</div><h1>Review before anything goes out.</h1><p>Every message is tied to a real buying signal and verified work email. You decide what is good enough to use.</p></div><div className="outboxSafety"><strong>Sending is off</strong><span>Approval does not send the message.</span></div></header>
    {query.error ? <section className="commandAlert"><strong>Could not save your decision</strong><span>{query.error}</span></section> : null}
    {query.notice ? <section className="commandAlert"><strong>{query.notice}</strong></section> : null}
    <section className="commandKpis simpleKpis"><div><span>Waiting for you</span><strong>{pendingCount}</strong><small>Messages ready to review</small></div><div><span>Approved</span><strong>{approvedCount}</strong><small>Still held, not sent</small></div><div><span>Approval</span><strong>Manual</strong><small>You make the decision</small></div><div><span>Auto-send</span><strong>Off</strong><small>Hard disabled</small></div></section>

    {rows.length ? <div className="outboxStack simpleMessageStack">{rows.map((row:any)=>{
      const revision:any = revisionById.get(row.current_revision_id); const account:any = accountById.get(row.account_id); if (!revision || !account) return null;
      const recipient:any = revision.recipient_snapshot || {}; const evidence:any[] = Array.isArray(revision.evidence_snapshot) ? revision.evidence_snapshot : []; const compliance:any = revision.compliance_snapshot || {}; const policy:any = revision.policy_receipt || {}; const policyReasons:string[] = Array.isArray(policy.reasons) ? policy.reasons : [];
      const policyEligible = policy.contractVersion === 'outreach-policy-v1' && policy.decision === 'eligible_for_human_review' && policyReasons.length === 0; const decision:any = latestDecision.get(row.id); const approved = row.approved_revision_id === revision.id && row.status === 'approved';
      const primaryEvidence=evidence[0];
      return <article className="outboxCard simpleMessageCard" key={row.id}>
        <div className="outboxTop"><div><div className="eyebrow">{approved ? 'Approved · still held' : decision?.decision === 'rejected' ? 'Rejected' : 'Ready for review'}</div><h2>{account.name}</h2><p>{text(recipient.name,'Decision maker')} · {text(recipient.title,'Role unavailable')} · {text(recipient.email,'Email unavailable')}</p></div><div className="outboxScore"><span>Lead score</span><strong>{account.opportunity_score ?? '—'}</strong></div></div>
        <div className="messageReasonBar"><div><span>Why now</span><strong>{primaryEvidence?.title||revision.reason_to_contact}</strong>{primaryEvidence?.sourceUrl?<a href={primaryEvidence.sourceUrl} target="_blank" rel="noreferrer">View source ↗</a>:null}</div><div><span>Why this person</span><strong>{recipient.emailVerified?'Verified work email':'Email still needs verification'}</strong><small>{text(recipient.title,'Decision-maker role')}</small></div></div>
        <div className="reviewGrid simpleReviewGrid"><section className="messagePreview"><div className="subjectLine"><small>Subject</small><strong>{revision.subject || '(no subject)'}</strong></div><pre>{revision.body}</pre></section><aside className="simpleReviewRail"><span className="eyebrow">Ready?</span>{policyEligible?<><strong className="readyText">All checks passed for human review.</strong><p>The lead has a verified work email, is not suppressed, and has the required source/policy record.</p></>:<><strong className="blockedText">Not ready to approve yet.</strong><div className="simpleBlockList">{policyReasons.map(reason=><p key={reason}>{simpleBlockReason(reason)}</p>)}</div></>}<Link href={`/accounts/${account.id}`}>Review the lead →</Link><details><summary>Advanced details</summary><div className="advancedReceipt"><small>Revision #{revision.revision_number}</small><small>Region: {text(policy.region,'Unknown')}</small><small>Human approval: {compliance.humanApprovalRequired === true ? 'required' : 'not confirmed'}</small><small>Auto-send: {compliance.autonomousSendEnabled === false ? 'off' : 'unknown'}</small><small>Suppressed: {compliance.suppressed === false ? 'no' : 'yes / unresolved'}</small><code>{revision.content_hash}</code></div></details></aside></div>
        <div className="reviewFooter"><div>{decision ? <small>Last decision: {decision.decision} · {date(decision.decided_at)}</small> : <small>Prepared {date(revision.created_at)}</small>}</div>{canReview && !approved && policyEligible ? <form action={decideOutreach} className="reviewActions"><input type="hidden" name="outreachId" value={row.id}/><input type="hidden" name="revisionId" value={revision.id}/><input name="note" aria-label="Review note" placeholder="Optional note"/><button className="ghost" name="decision" value="rejected" type="submit">Reject</button><button className="primary" name="decision" value="approved" type="submit">Approve message</button></form> : <div className="approvalSeal"><strong>{approved ? 'Approved' : policyEligible ? 'Review locked' : 'Blocked'}</strong><span>{approved ? 'Still held. Nothing sent.' : policyEligible ? 'Owner/admin required.' : 'Fix the issue above first.'}</span></div>}</div>
      </article>;
    })}</div> : <section className="panel emptyState"><div className="eyebrow">No messages yet</div><h2>Messages appear after a lead and contact are ready.</h2><p>Revenue Agent prepares a draft only after it has a real reason to contact the company and a verified work email.</p><Link className="primary inlineAction" href="/accounts">View leads</Link></section>}
  </main></div>;
}
