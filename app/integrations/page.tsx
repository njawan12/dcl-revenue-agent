import { Sidebar } from '../../components/Sidebar';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

export const dynamic='force-dynamic';

type Integration={name:string;category:string;state:'connected'|'ready'|'planned';description:string;detail?:string};

export default async function IntegrationsPage(){
  await requireActiveWorkspace();
  const integrations:Integration[]=[
    {name:'Crustdata',category:'Data',state:process.env.CRUSTDATA_API_KEY?'connected':'ready',description:'Job posts, company data, decision makers and verified work emails.',detail:'Primary data provider'},
    {name:'Anthropic Claude',category:'AI',state:process.env.ANTHROPIC_API_KEY?'connected':'ready',description:'Writes personalized drafts after the lead and recipient are verified.',detail:'Drafting only'},
    {name:'Greenhouse',category:'Hiring signals',state:'connected',description:'Public job-board verification when a target company uses Greenhouse.',detail:'No key required'},
    {name:'Lever',category:'Hiring signals',state:'connected',description:'Public job-board verification when a target company uses Lever.',detail:'No key required'},
    {name:'HubSpot',category:'CRM',state:'ready',description:'Portable CRM sync contract is implemented. OAuth/provider adapter is not connected yet.'},
    {name:'Salesforce',category:'CRM',state:'ready',description:'Portable CRM sync contract is implemented. OAuth/provider adapter is not connected yet.'},
    {name:'Attio',category:'CRM',state:'ready',description:'Portable CRM sync contract is implemented. OAuth/provider adapter is not connected yet.'},
    {name:'Pipedrive',category:'CRM',state:'ready',description:'Portable CRM sync contract is implemented. OAuth/provider adapter is not connected yet.'},
    {name:'Slack',category:'Notifications',state:'planned',description:'Owner alerts for hot leads, failed jobs and approval-ready messages.'},
    {name:'Webhooks',category:'Developer',state:'planned',description:'Push lead, contact, message and pipeline events to external systems.'},
  ];
  const connected=integrations.filter(i=>i.state==='connected').length;
  return <div className="shell premiumShell"><Sidebar/><main className="commandMain"><header className="commandHeader"><div><div className="eyebrow">Integrations</div><h1>Connect the systems your sales team already uses.</h1><p>Real connection states only. “Supported” never means “connected.”</p></div></header>
    <section className="commandKpis simpleKpis"><div><span>Connected</span><strong>{connected}</strong><small>Working in this environment</small></div><div><span>Ready to connect</span><strong>{integrations.filter(i=>i.state==='ready').length}</strong><small>Adapter or API contract exists</small></div><div><span>Planned</span><strong>{integrations.filter(i=>i.state==='planned').length}</strong><small>Deliberately not faked</small></div><div><span>Outbound sending</span><strong>Off</strong><small>No sending integration enabled</small></div></section>
    <section className="integrationGrid">{integrations.map(item=><article className="integrationCard" key={item.name}><div className="integrationTop"><div className="integrationLogo">{item.name.slice(0,2).toUpperCase()}</div><span className={`integrationState state-${item.state}`}>{item.state==='connected'?'Connected':item.state==='ready'?'Ready':'Planned'}</span></div><div><span className="eyebrow">{item.category}</span><h2>{item.name}</h2><p>{item.description}</p>{item.detail?<small>{item.detail}</small>:null}</div></article>)}</section>
    <section className="storyPanel"><div className="commandSectionHead"><div><span className="eyebrow">Integration principle</span><h2>One operating system, not another data island.</h2></div></div><p>Revenue Agent should sync the buying signal, company, person, message and pipeline outcome into the tools you already run. The internal data model remains the source of truth for why a lead was selected and what evidence justified it.</p></section>
  </main></div>;
}
