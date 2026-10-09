-- Align row-level permissions with the documented product role contract.
-- Owner/Admin manage workspace configuration and destructive actions.
-- Member may research/edit/draft and operate pipeline, but may not approve
-- outreach or perform destructive workspace administration.

begin;

-- Research and commerce intelligence authored by operators.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'accounts',
    'contacts',
    'discovery_runs',
    'discovery_observations',
    'signals',
    'storefront_findings'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_tenant_insert', table_name);
    execute format(
      'create policy %I on public.%I for insert with check (public.can_operate_workspace(workspace_id))',
      table_name || '_tenant_insert', table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_tenant_update', table_name);
    execute format(
      'create policy %I on public.%I for update using (public.can_operate_workspace(workspace_id)) with check (public.can_operate_workspace(workspace_id))',
      table_name || '_tenant_update', table_name
    );
  end loop;
end $$;

-- Proof is intentionally stricter: operators may curate drafts, while the
-- approved-claim boundary remains enforced by application/RPC contracts.
drop policy if exists proof_points_tenant_insert on public.proof_points;
create policy proof_points_tenant_insert on public.proof_points
  for insert with check (public.can_operate_workspace(workspace_id));

drop policy if exists proof_points_tenant_update on public.proof_points;
create policy proof_points_tenant_update on public.proof_points
  for update using (public.can_operate_workspace(workspace_id))
  with check (public.can_operate_workspace(workspace_id));

-- Members can create and edit outreach drafts. Approval records remain
-- Owner/Admin-only and held-outbox eligibility is enforced independently.
drop policy if exists outreach_tenant_insert on public.outreach;
create policy outreach_tenant_insert on public.outreach
  for insert with check (public.can_operate_workspace(workspace_id));

drop policy if exists outreach_tenant_update on public.outreach;
create policy outreach_tenant_update on public.outreach
  for update using (public.can_operate_workspace(workspace_id))
  with check (public.can_operate_workspace(workspace_id));

drop policy if exists outreach_revisions_tenant_insert on public.outreach_revisions;
create policy outreach_revisions_tenant_insert on public.outreach_revisions
  for insert with check (public.can_operate_workspace(workspace_id));

-- Deliberately unchanged:
-- * *_tenant_delete policies remain Owner/Admin-only.
-- * outreach_approvals INSERT/DELETE remains Owner/Admin-only.
-- * workspace/config/member management remains Owner/Admin-only.
-- * Viewer remains read-only through is_workspace_member SELECT policies.
-- * durable jobs/scoring/provenance already use can_operate_workspace.

commit;
