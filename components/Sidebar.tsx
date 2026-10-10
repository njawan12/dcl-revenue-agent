import Link from 'next/link';
import { getActiveWorkspace, listUserWorkspaces } from '../lib/workspaces/session';
import { switchWorkspace } from '../app/workspace/actions';
import { signOut } from '../app/login/actions';

const primaryItems = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Leads', href: '/accounts', icon: 'leads' },
  { label: 'People', href: '/contacts', icon: 'people' },
  { label: 'Messages', href: '/outreach', icon: 'messages' },
  { label: 'Pipeline', href: '/pipeline', icon: 'pipeline' },
];

const secondaryItems = [
  { label: 'Find leads', href: '/discover' },
  { label: 'Offer profiles', href: '/settings/offers' },
  { label: 'Settings', href: '/settings' },
];

function NavIcon({ name }: { name: string }) {
  return <span className={`navIcon navIcon-${name}`} aria-hidden="true"/>;
}

export async function Sidebar() {
  const [active, workspaces] = await Promise.all([getActiveWorkspace(), listUserWorkspaces()]);
  return <aside className="sidebar" aria-label="Workspace navigation">
    <div className="sidebarTop">
      <Link className="brand" href="/" aria-label="Revenue Agent home"><span className="brandMark">R</span><span className="brandName">Revenue Agent</span></Link>
      {active ? <form action={switchWorkspace} className="workspaceSwitcher">
        <label htmlFor="workspace-switcher">Workspace</label>
        <div className="workspaceSwitcherRow"><select id="workspace-switcher" name="workspaceId" defaultValue={active.id} aria-label="Active workspace">
          {workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
        </select>{workspaces.length > 1 ? <button className="ghost" type="submit">Switch</button> : null}</div>
      </form> : null}
    </div>
    <nav className="primaryNav" aria-label="Primary">{primaryItems.map((item)=><Link key={item.label} href={item.href}><NavIcon name={item.icon}/><span>{item.label}</span></Link>)}</nav>
    <nav className="secondaryNav" aria-label="Secondary">{secondaryItems.map((item)=><Link key={item.label} href={item.href}>{item.label}</Link>)}</nav>
    <div className="sidebarFoot"><div className="safetyMode"><span className="statusPulse"/><div><small>Approval mode</small><strong>You approve every message</strong></div></div><form action={signOut}><button className="ghost" type="submit">Sign out</button></form></div>
  </aside>;
}
