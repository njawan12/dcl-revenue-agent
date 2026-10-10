-- Optimize the new saved-view policies without changing their authorization semantics.

create index if not exists saved_views_owner_user_idx on saved_views(owner_user_id);

drop policy if exists saved_views_select on saved_views;
drop policy if exists saved_views_insert on saved_views;
drop policy if exists saved_views_update on saved_views;
drop policy if exists saved_views_delete on saved_views;

create policy saved_views_select on saved_views
for select using (
  is_workspace_member(workspace_id)
  and (shared = true or owner_user_id = (select auth.uid()) or can_manage_workspace(workspace_id))
);

create policy saved_views_insert on saved_views
for insert with check (
  is_workspace_member(workspace_id)
  and owner_user_id = (select auth.uid())
);

create policy saved_views_update on saved_views
for update using (
  owner_user_id = (select auth.uid()) or can_manage_workspace(workspace_id)
) with check (
  owner_user_id = (select auth.uid()) or can_manage_workspace(workspace_id)
);

create policy saved_views_delete on saved_views
for delete using (
  owner_user_id = (select auth.uid()) or can_manage_workspace(workspace_id)
);
