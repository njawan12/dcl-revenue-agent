import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { requireActiveWorkspace } from '../../lib/workspaces/session';

const items=[
  ['People','See decision makers and verified work emails.','/contacts'],
  ['Global Data','Search companies, people and messages in one place.','/data'],
  ['Analytics','See funnel conversion, costs and provider usage.','/analytics'],
  ['Find leads','Run hiring-led discovery from an offer profile.','/discover'],
  ['Integrations','See what is connected, ready or planned.','/integrations'],
  ['Team','Manage workspace roles and access.','/team'],
  ['Offer profiles','Change what Revenue Agent searches for and sells.','/settings/offers'],
  ['Settings','Workspace policy, suppression and governance.','/settings'],
] as const;

export default async function MorePage(){await requireActiveWorkspace();return <div className="shell premiumShell"><Sidebar/><main className="commandMain"><header className="commandHeader"><div><div className="eyebrow">More</div><h1>Run the rest of your revenue workspace.</h1><p>People, data, analytics, integrations, team access and configuration.</p></div></header><section className="moreGrid">{items.map(([title,description,href])=><Link href={href} key={href}><strong>{title}</strong><p>{description}</p><span>Open →</span></Link>)}</section></main></div>}
