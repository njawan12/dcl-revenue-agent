import { Sidebar } from '../components/Sidebar';
import { ScoreRing } from '../components/ScoreRing';
import { metrics, opportunities } from '../lib/mock-data';
import { requireActiveWorkspace } from '../lib/workspaces/session';

export default async function Home() {
  const workspace = await requireActiveWorkspace();
  return <div className="shell"><Sidebar/><main><header><div><div className="eyebrow">Revenue intelligence</div><h1>{workspace.name}</h1><p>Your workspace ranks commerce accounts by fit, evidence-backed need and current buying intent.</p></div><a className="primary" href="/discover">Open discovery</a></header>
  <section className="metrics">{metrics.map(m=><div className="card" key={m.label}><span>{m.label}</span><strong>{m.value}</strong><small>{m.delta}</small></div>)}</section>
  <section className="panel" id="opportunities"><div className="panelHead"><div><span className="eyebrow">Preview data</span><h2>Opportunity experience</h2></div></div>
  <p>This section uses sample accounts until the first live discovery run is connected to the workspace.</p>
  <div className="table"><div className="row tableHeader"><span>Score</span><span>Company</span><span>Why now</span><span>Buyer</span><span>Motion</span><span>Status</span></div>{opportunities.map(o=><a href={`/opportunities/${o.id}`} className="row" key={o.id}><ScoreRing score={o.score}/><strong>{o.company}</strong><span>{o.signal}</span><span>{o.buyer}</span><span>{o.motion}</span><span className="pill">{o.status}</span></a>)}</div></section>
  <section className="split"><div className="panel"><span className="eyebrow">Guardrail</span><h2>No reason, no outreach.</h2><p>The engine will not prepare outreach until it can explain why this specific company should reasonably talk to your team, backed by source evidence.</p></div><div className="panel"><span className="eyebrow">Validation gate</span><h2>Prove account quality first.</h2><p>Live sending remains disabled until a workspace demonstrates that its discovery and scoring rules consistently surface accounts worth pursuing.</p></div></section>
  </main></div>
}
