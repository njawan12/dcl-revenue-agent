const items = [
  { label: 'Home', href: '/' },
  { label: 'Discover', href: '/discover' },
  { label: 'Opportunities', href: '/#opportunities' },
  { label: 'Accounts', href: '/#accounts' },
  { label: 'Contacts', href: '/#contacts' },
  { label: 'Outreach', href: '/#outreach' },
  { label: 'Inbox', href: '/#inbox' },
  { label: 'Pipeline', href: '/#pipeline' },
  { label: 'Analytics', href: '/#analytics' },
  { label: 'Knowledge', href: '/#knowledge' },
];
export function Sidebar() {
  return <aside className="sidebar"><div className="brand">DCL<span>Revenue Agent</span></div><nav>{items.map((item)=><a key={item.label} href={item.href}>{item.label}</a>)}</nav><div className="sidebarFoot"><small>Mode</small><strong>Human approval</strong></div></aside>
}
