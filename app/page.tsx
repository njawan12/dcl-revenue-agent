import { Sidebar } from '../components/Sidebar';
import { ScoreRing } from '../components/ScoreRing';
import { metrics, opportunities } from '../lib/mock-data';

export default function Home() {
  return <div className="shell"><Sidebar/><main><header><div><div className="eyebrow">Revenue intelligence</div><h1>Good morning, Nouman.</h1><p>Seven accounts have a strong enough reason for DCL to contact them today.</p></div><button className="primary">Run discovery</button></header>
  <section className="metrics">{metrics.map(m=><div className="card" key={m.label}><span>{m.label}</span><strong>{m.value}</strong><small>{m.delta}</small></div>)}</section>
  <section className="panel"><div className="panelHead"><div><span className="eyebrow">Prioritized by fit + need + intent</span><h2>Best opportunities right now</h2></div><button className="ghost">View all</button></div>
  <div className="table"><div className="row tableHeader"><span>Score</span><span>Company</span><span>Why now</span><span>Buyer</span><span>Motion</span><span>Status</span></div>{opportunities.map(o=><a href={`/opportunities/${o.id}`} className="row" key={o.id}><ScoreRing score={o.score}/><strong>{o.company}</strong><span>{o.signal}</span><span>{o.buyer}</span><span>{o.motion}</span><span className="pill">{o.status}</span></a>)}</div></section>
  <section className="split"><div className="panel"><span className="eyebrow">Guardrail</span><h2>No reason, no outreach.</h2><p>The engine will not create an email until it can explain why this specific company should reasonably talk to DCL, backed by source evidence.</p></div><div className="panel"><span className="eyebrow">M1 acceptance test</span><h2>50 qualified real accounts.</h2><p>Before outbound automation, at least 70% of the first 50 surfaced accounts should be companies DCL would genuinely pursue.</p></div></section>
  </main></div>
}
