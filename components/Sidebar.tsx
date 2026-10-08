import { getActiveWorkspace, listUserWorkspaces } from '../lib/workspaces/session';
import { switchWorkspace } from '../app/workspace/actions';
import { signOut } from '../app/login/actions';

const items = [
  { label: 'Home', href: '/' },
  { label: 'Discover', href: '/discover' },
  { label: 'Opportunities', href: '/#opportunities' },
  { label: 'Accounts', href: '/accounts' },
  { label: 'Contacts', href: '/contacts' },
  { label: 'Outreach', href: '/#outreach' },
  { label: 'Inbox', href: '/#inbox' },
  { label: 'Pipeline', href: '/#pipeline' },
  { label: 'Analytics', href: '/#analytics' },
  { label: 'Knowledge', href: '/#knowledge' },
  { label: 'Settings', href: '/settings' },
];

export async function Sidebar() {
  const [active, workspaces] = await Promise.all([getActiveWorkspace(), listUserWorkspaces()]);
  return <aside className="sidebar">
    <div className="brand">Commerce<span>Revenue Agent</span></div>
    {active ? <form action={switchWorkspace} style={{margin:'18px 0',display:'grid',gap:7}}>
      <small>Workspace</small>
      <select name="workspaceId" defaultValue={active.id} style={{width:'100%',padding:8}}>
        {workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
      </select>
      <button className="ghost" type="submit">Switch</button>
    </form> : null}
    <nav>{items.map((item)=><a key={item.label} href={item.href}>{item.label}</a>)}</nav>
    <div className="sidebarFoot"><small>Mode</small><strong>Human approval</strong><form action={signOut}><button className="ghost" style={{marginTop:10}}>Sign out</button></form></div>
  </aside>;
}
