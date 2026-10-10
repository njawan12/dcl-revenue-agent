import { Sidebar } from '../../components/Sidebar';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

export const dynamic='force-dynamic';
function pct(a:number,b:number){return b>0?Math.round((a/b)*100):0;}

export default async function AnalyticsPage(){
  const workspace=await requireActiveWorkspace(); const supabase=await createClient();
  const since=new Date(Date.now()-30*86400000).toISOString();
  const [accountsResult,contactsResult,outreachResult,pipelineResult,usageResult,runsResult]=await Promise.all([
    supabase.from('accounts').select('id,opportunity_score,pipeline_stage,created_at').eq('workspace_id',workspace.id).gte('created_at',since),
    supabase.from('contacts').select('id,account_id,email_verified,is_primary_buyer,created_at').eq('workspace_id',workspace.id).gte('created_at',since),
    supabase.from('outreach').select('id,account_id,status,created_at').eq('workspace_id',workspace.id).gte('created_at',since),
    supabase.from('pipeline_events').select('id,account_id,stage,recorded_at').eq('workspace_id',workspace.id).gte('recorded_at',since),
    supabase.from('provider_usage').select('provider,action,units,estimated_cost_usd,occurred_at').eq('workspace_id',workspace.id).gte('occurred_at',since),
    supabase.from('discovery_runs').select('id,status,accounts_discovered,signals_discovered,error_count,started_at').eq('workspace_id',workspace.id).gte('started_at',since),
  ]);
  const accounts:any[]=accountsResult.data||[];const contacts:any[]=contactsResult.data||[];const outreach:any[]=outreachResult.data||[];const pipeline:any[]=pipelineResult.data||[];const usage:any[]=usageResult.data||[];const runs:any[]=runsResult.data||[];
  const qualified=accounts.filter(a=>Number(a.opportunity_score)>=65).length;const verifiedAccounts=new Set(contacts.filter(c=>c.email_verified).map(c=>c.account_id));const messageAccounts=new Set(outreach.map(o=>o.account_id));const approvedAccounts=new Set(outreach.filter(o=>o.status==='approved').map(o=>o.account_id));const meetingAccounts=new Set(pipeline.filter(p=>['meeting','won'].includes(p.stage)).map(p=>p.account_id));const wonAccounts=new Set(pipeline.filter(p=>p.stage==='won').map(p=>p.account_id));
  const credits=usage.filter(u=>u.provider==='crustdata').reduce((s,u)=>s+Number(u.units||0),0);const cost=usage.reduce((s,u)=>s+Number(u.estimated_cost_usd||0),0);const completedRuns=runs.filter(r=>r.status==='completed').length;
  const funnel=[['New leads',accounts.length],['Qualified',qualified],['Verified contact',verifiedAccounts.size],['Message prepared',messageAccounts.size],['Approved',approvedAccounts.size],['Meeting / Won',meetingAccounts.size],['Won',wonAccounts.size]] as const;
  const top=Math.max(1,...funnel.map(([,v])=>v));
  return <div className="shell premiumShell"><Sidebar/><main className="commandMain"><header className="commandHeader"><div><div className="eyebrow">Analytics</div><h1>Measure whether the engine creates revenue opportunities.</h1><p>Thirty-day funnel, provider usage and conversion—not vanity activity.</p></div></header>
    <section className="commandKpis simpleKpis"><div><span>Qualified leads</span><strong>{qualified}</strong><small>{pct(qualified,accounts.length)}% of new leads</small></div><div><span>Verified contacts</span><strong>{verifiedAccounts.size}</strong><small>{pct(verifiedAccounts.size,qualified)}% of qualified leads</small></div><div><span>Messages approved</span><strong>{approvedAccounts.size}</strong><small>{pct(approvedAccounts.size,messageAccounts.size)}% of prepared messages</small></div><div><span>Meetings / wins</span><strong>{meetingAccounts.size}</strong><small>{wonAccounts.size} marked won</small></div></section>
    <section className="analyticsGrid"><article className="analyticsPanel"><div className="panelHead"><div><span className="eyebrow">30-day funnel</span><h2>Where leads are moving or leaking</h2></div></div><div className="funnelBars">{funnel.map(([label,value],i)=><div className="funnelRow" key={label}><span>{label}</span><div><i style={{width:`${Math.max(value?6:0,(value/top)*100)}%`}}/></div><strong>{value}</strong>{i>0?<small>{pct(value,funnel[i-1][1])}%</small>:<small>base</small>}</div>)}</div></article>
    <article className="analyticsPanel"><div className="panelHead"><div><span className="eyebrow">Economics</span><h2>What it costs to create opportunity</h2></div></div><div className="economicsList"><div><span>Crustdata credits used</span><strong>{credits.toFixed(1)}</strong></div><div><span>Recorded provider cost</span><strong>{cost?`$${cost.toFixed(2)}`:'Not priced yet'}</strong></div><div><span>Completed searches</span><strong>{completedRuns}</strong></div><div><span>Credits / qualified lead</span><strong>{qualified?(credits/qualified).toFixed(2):'—'}</strong></div><div><span>Cost / qualified lead</span><strong>{qualified&&cost?`$${(cost/qualified).toFixed(2)}`:'—'}</strong></div></div></article></section>
    <section className="storyPanel"><div className="commandSectionHead"><div><span className="eyebrow">Provider usage</span><h2>Where credits are going</h2></div></div><div className="storyList">{Object.entries(usage.reduce((acc:any,u:any)=>{const k=`${u.provider} · ${u.action}`;acc[k]=(acc[k]||0)+Number(u.units||0);return acc;},{})).sort((a:any,b:any)=>b[1]-a[1]).slice(0,12).map(([label,units]:any)=><div className="storyRow" key={label}><span>Usage</span><strong>{label}</strong><span>{Number(units).toFixed(2)} units</span></div>)}</div></section>
  </main></div>;
}
