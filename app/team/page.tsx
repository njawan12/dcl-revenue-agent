import { Sidebar } from '../../components/Sidebar';
import { createClient } from '../../lib/supabase/server';
import { requireActiveWorkspace } from '../../lib/workspaces/session';
import { removeMember, updateMemberRole } from './actions';

export const dynamic='force-dynamic';

export default async function TeamPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const [workspace,params]=await Promise.all([requireActiveWorkspace(),searchParams]);
  const supabase=await createClient();
  const {data,error}=await supabase.rpc('get_workspace_member_directory',{p_workspace_id:workspace.id});
  const members:any[]=data||[]; const canManage=['owner','admin'].includes(workspace.role);
  return <div className="shell premiumShell"><Sidebar/><main className="commandMain"><header className="commandHeader"><div><div className="eyebrow">Team</div><h1>Give people the access they need—nothing more.</h1><p>Simple roles for owners, managers, operators and read-only viewers.</p></div></header>
    {params.notice?<div className="commandAlert"><strong>{params.notice}</strong></div>:null}{params.error?<div className="commandAlert"><strong>Could not update team</strong><span>{params.error}</span></div>:null}
    <section className="roleCards"><article><strong>Owner</strong><p>Everything, including workspace policy and team control.</p></article><article><strong>Admin</strong><p>Manage team, settings, offers and approvals.</p></article><article><strong>Member</strong><p>Research leads, work the pipeline and prepare drafts.</p></article><article><strong>Viewer</strong><p>Read-only access to workspace data.</p></article></section>
    {error?<section className="panel noticePanel"><h2>Team directory unavailable</h2><p>{error.message}</p></section>:<section className="teamTable"><div className="teamTableHead"><span>User</span><span>Role</span><span>Joined</span><span>Actions</span></div>{members.map(member=><div className="teamRow" key={member.user_id}><div><strong>{member.email||'User'}</strong>{member.role==='owner'?<small>Workspace owner</small>:null}</div><div>{canManage&&member.role!=='owner'?<form action={updateMemberRole} className="roleForm"><input type="hidden" name="userId" value={member.user_id}/><select name="role" defaultValue={member.role}><option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option></select><button className="ghost" type="submit">Save</button></form>:<span className="pill">{member.role}</span>}</div><span>{new Date(member.joined_at).toLocaleDateString()}</span><div>{canManage&&member.role!=='owner'?<form action={removeMember}><input type="hidden" name="userId" value={member.user_id}/><button className="dangerGhost" type="submit">Remove</button></form>:<span>—</span>}</div></div>)}</section>}
    <section className="storyPanel"><div className="commandSectionHead"><div><span className="eyebrow">Invites</span><h2>Invite links come next, not fake email sending.</h2></div></div><p>The role system is live. I am keeping invitation delivery out until we have a dedicated app email provider rather than pretending an invite was sent.</p></section>
  </main></div>;
}
