import { Sidebar } from '../../../components/Sidebar';
import { ScoreRing } from '../../../components/ScoreRing';
import { opportunities } from '../../../lib/mock-data';

export default async function Opportunity({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params; const o = opportunities.find(x=>x.id===id) ?? opportunities[0];
 return <div className="shell"><Sidebar/><main><a className="back" href="/">← Opportunities</a><header><div><div className="eyebrow">Account intelligence</div><h1>{o.company}</h1><p>{o.signal}</p></div><ScoreRing score={o.score}/></header>
 <section className="scoreGrid"><div><span>Fit</span><strong>{o.fit}</strong></div><div><span>Need</span><strong>{o.need}</strong></div><div><span>Intent</span><strong>{o.intent}</strong></div><div><span>Motion</span><strong>{o.motion}</strong></div></section>
 <section className="split"><div className="panel"><span className="eyebrow">Why DCL should contact them</span><h2>Commercial thesis</h2><p>This account combines strong Shopify fit with evidence of an active ecommerce problem. The recommended motion is <b>{o.motion}</b>. Before outreach, research must attach source evidence for every claim and select a DCL proof point that directly matches the need.</p><div className="tags"><span>Shopify Plus</span><span>CRO</span><span>Analytics</span><span>Subscriptions</span></div></div><div className="panel"><span className="eyebrow">Recommended buyer</span><h2>{o.buyer}</h2><p>Contact enrichment is intentionally gated. No guessed addresses. The system records provider, verification result, confidence and source date.</p><button className="primary">Research contact</button></div></section>
 <section className="panel"><div className="panelHead"><div><span className="eyebrow">Outreach</span><h2>Not generated yet</h2></div><span className="pill">Human approval required</span></div><p>Generation unlocks only after the account has a source-backed problem statement, a verified buyer and an approved DCL proof point.</p><button className="ghost">Generate after research</button></section>
 </main></div>
}
