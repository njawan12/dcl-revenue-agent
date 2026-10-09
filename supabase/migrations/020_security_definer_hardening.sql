-- Staging-linter hardening for SECURITY DEFINER and trigger/helper functions.
-- Anonymous callers must never reach tenant/security helpers or worker RPCs.
-- Authenticated execution is preserved only where the product contract requires it.

-- Lock helper search paths to prevent object-shadowing attacks.
alter function guard_pipeline_fields() set search_path = public;
alter function enforce_outreach_revision_workspace() set search_path = public;
alter function enforce_outreach_approval_binding() set search_path = public;
alter function invalidate_outreach_approval_on_revision_change() set search_path = public;
alter function prevent_scoring_snapshot_mutation() set search_path = public;
alter function prevent_source_provenance_mutation() set search_path = public;
alter function validate_outreach_policy_receipt(jsonb) set search_path = public;

-- Tenant/security helpers: never anonymous. Authenticated callers are allowed only
-- where the function is part of the tenant product contract or an RLS helper.
revoke execute on function is_workspace_member(uuid) from public, anon;
revoke execute on function can_manage_workspace(uuid) from public, anon;
revoke execute on function can_operate_workspace(uuid) from public, anon;
revoke execute on function operator_can_prepare_outreach(uuid) from public, anon;
revoke execute on function is_outreach_suppressed(uuid,uuid,uuid) from public, anon;
revoke execute on function update_native_pipeline(uuid,uuid,integer,text,text,date) from public, anon;
revoke execute on function create_workspace_with_owner(text,text,jsonb,text[],text[]) from public, anon;

grant execute on function is_workspace_member(uuid) to authenticated;
grant execute on function can_manage_workspace(uuid) to authenticated;
grant execute on function can_operate_workspace(uuid) to authenticated;
grant execute on function operator_can_prepare_outreach(uuid) to authenticated;
grant execute on function is_outreach_suppressed(uuid,uuid,uuid) to authenticated;
grant execute on function update_native_pipeline(uuid,uuid,integer,text,text,date) to authenticated;
grant execute on function create_workspace_with_owner(text,text,jsonb,text[],text[]) to authenticated;

-- Worker transitions are service-role only. Function bodies already re-check
-- auth.role(); remove API-level execution from anonymous and signed-in users too.
revoke execute on function claim_durable_job(uuid,integer) from public, anon, authenticated;
revoke execute on function complete_durable_job(uuid,uuid,jsonb) from public, anon, authenticated;
revoke execute on function fail_durable_job(uuid,uuid,text,text,integer) from public, anon, authenticated;
grant execute on function claim_durable_job(uuid,integer) to service_role;
grant execute on function complete_durable_job(uuid,uuid,jsonb) to service_role;
grant execute on function fail_durable_job(uuid,uuid,text,text,integer) to service_role;

-- Trigger-only helpers are not API surface.
revoke execute on function guard_pipeline_fields() from public, anon, authenticated;
revoke execute on function enforce_outreach_revision_workspace() from public, anon, authenticated;
revoke execute on function enforce_outreach_approval_binding() from public, anon, authenticated;
revoke execute on function invalidate_outreach_approval_on_revision_change() from public, anon, authenticated;
revoke execute on function prevent_scoring_snapshot_mutation() from public, anon, authenticated;
revoke execute on function prevent_source_provenance_mutation() from public, anon, authenticated;
