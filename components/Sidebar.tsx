const items = ['Home', 'Discover', 'Opportunities', 'Accounts', 'Contacts', 'Outreach', 'Inbox', 'Pipeline', 'Analytics', 'Knowledge'];
export function Sidebar() {
  return <aside className="sidebar"><div className="brand">DCL<span>Revenue Agent</span></div><nav>{items.map((i,idx)=><a className={idx===0?'active':''} key={i} href="#">{i}</a>)}</nav><div className="sidebarFoot"><small>Mode</small><strong>Human approval</strong></div></aside>
}
