import { Sidebar } from '../../components/Sidebar';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';
import { PIPELINE_STAGES } from '../../lib/pipeline/stages';
import { updatePipeline } from './actions';
export const dynamic = 'force-dynamic';
export default async function Pipeline({searchParams}: {searchParams: Promise<{error?:string;notice?:string}>}) {
  const workspace = await requireActiveWorkspace();
  const params = await searchParams;
  const supabase = await createClient();
  const [accounts,events] = await Promise.all([
    supabase.from('accounts').select('id,name,domain,pipeline_stage,pipeline_revision,next_action,next_action_due,suppressed').eq('workspace_id',workspace.id).order('next_action_due',{ascending:true,nullsFirst:false}).limit(100),
    supabase.from('pipeline_events').select('id,account_id,previous_stage,stage,next_action,recorded_at').eq('workspace_id',workspace.id).order('recorded_at',{ascending:false}).limit(12),
  ]);
  const error = accounts.error || events.error;
  const canEdit = ['owner','admin'].includes(workspace.role);
  const rows = accounts.data || [];
  return <div className="shell"><Sidebar/><main>
    <header><div><div className="eyebrow">Native pipeline</div><h1>Turn attention into progress.</h1><p>Record where each account stands and the next action you intend to take. Stages are operator records; held drafts do not imply contact.</p></div><a className="ghost" href="/">Command Center</a></header>
    {params.error || params.notice ? <section className="panel noticePanel" role="status"><p>{params.error || params.notice}</p></section> : null}
    {error ? <section className="panel" role="alert"><h2>Pipeline is unavailable.</h2><p>The workspace pipeline could not be loaded. Check that the native pipeline migration is applied, then reload.</p><a className="inlineAction" href="/pipeline">Reload pipeline</a></section> : <>
    <section className="pipelineSummary" aria-label="Stages in displayed accounts">{PIPELINE_STAGES.map(stage=><div key={stage}><span>{stage}</span><strong>{rows.filter(account=>account.pipeline_stage===stage).length}</strong></div>)}</section>
    <p className="pipelineCaption">Showing up to 100 accounts, ordered by next action due date. {canEdit ? 'Save each account separately.' : 'Your role has read-only access.'}</p>
    {!rows.length ? <section className="panel emptyState"><h2>Your pipeline starts with discovery.</h2><p>Find a commerce account, inspect its evidence, then record your next step here.</p><a className="primary inlineAction" href="/discover">Discover accounts</a></section> : <section className="pipelineStack">{rows.map(account=><article className="panel" key={account.id}>
      <div className="panelHead"><div><a href={`/accounts/${account.id}`}><h2>{account.name}</h2></a><p>{account.domain}</p></div><span className="pill">{account.suppressed ? 'Suppressed' : account.pipeline_stage}</span></div>
      {canEdit ? <form action={updatePipeline} className="pipelineForm"><input type="hidden" name="accountId" value={account.id}/><input type="hidden" name="revision" value={account.pipeline_revision}/>
      <label>Stage<select name="stage" defaultValue={account.pipeline_stage}>{PIPELINE_STAGES.filter(stage=>!account.suppressed || stage==='lost').map(stage=><option key={stage} value={stage}>{stage}</option>)}</select></label>
      <label>Next action<input name="nextAction" maxLength={1000} defaultValue={account.next_action} placeholder="What will you do next?"/></label>
      <label>Due date<input type="date" name="due" defaultValue={account.next_action_due || ''}/></label><button className="primary">Save</button></form> : <p>{account.next_action || 'No next action recorded.'}{account.next_action_due ? ` · Due ${account.next_action_due}` : ''}</p>}
    </article>)}</section>}
    <section className="panel"><span className="eyebrow">Activity</span><h2>Recent pipeline decisions</h2>{events.data?.length ? <div className="evidenceList">{events.data.map(event=><div className="evidenceItem" key={event.id}><div><a href={`/accounts/${event.account_id}`}>Inspect account</a><strong>{event.previous_stage} → {event.stage}</strong><small>{event.next_action || 'No next action'} · {new Date(event.recorded_at).toLocaleString('en-US',{timeZone:'UTC'})} UTC</small></div></div>)}</div> : <p>Saved changes will appear here with their recorded time.</p>}</section>
    </>}
  </main></div>;
}
