import Link from 'next/link';
import { getActiveWorkspace, listUserWorkspaces } from '../lib/workspaces/session';
import { switchWorkspace } from '../app/workspace/actions';
import { signOut } from '../app/login/actions';

const items = [
  { label: 'Command Center', href: '/' },
  { label: 'Discover', href: '/discover' },
  { label: 'Opportunities', href: '/#opportunities' },
  { label: 'Accounts', href: '/accounts' },
  { label: 'Contacts', href: '/contacts' },
  { label: 'Held outbox', href: '/outreach' },
  { label: 'Pipeline', href: '/pipeline' },
  { label: 'Settings', href: '/settings' },
];

export async function Sidebar() {
  const [active, workspaces] = await Promise.all([getActiveWorkspace(), listUserWorkspaces()]);
  return <aside className="sidebar" aria-label="Workspace navigation">
    <div className="sidebarTop">
      <Link className="brand" href="/" aria-label="Commerce Revenue Agent home">Commerce<span>Revenue Agent</span></Link>
      {active ? <form action={switchWorkspace} className="workspaceSwitcher">
        <label htmlFor="workspace-switcher">Workspace</label>
        <div className="workspaceSwitcherRow"><select id="workspace-switcher" name="workspaceId" defaultValue={active.id} aria-label="Active workspace">
          {workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
        </select>{workspaces.length > 1 ? <button className="ghost" type="submit">Switch</button> : null}</div>
      </form> : null}
    </div>
    <nav aria-label="Primary">{items.map((item)=><Link key={item.label} href={item.href}>{item.label}</Link>)}</nav>
    <div className="sidebarFoot"><div><small>Operating mode</small><strong>Human approval</strong></div><form action={signOut}><button className="ghost" type="submit">Sign out</button></form></div>
  </aside>;
}
