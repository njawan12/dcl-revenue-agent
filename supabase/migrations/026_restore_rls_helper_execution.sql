-- Live staging caught an important PostgreSQL permission boundary:
-- authenticated users must have EXECUTE on helper functions referenced directly
-- by RLS policy expressions. Revoking those grants makes policy evaluation fail
-- with `permission denied for function ...` before membership can be checked.
--
-- These helpers remain SECURITY DEFINER, fixed-search-path, workspace-scoped,
-- and derive identity exclusively from auth.uid(). Direct RPC invocation exposes
-- only the same boolean authorization decision the caller's RLS policies use.
-- The application mutation entry points remain separately guarded.

begin;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.can_manage_workspace(uuid) to authenticated;
grant execute on function public.can_operate_workspace(uuid) to authenticated;

-- This helper is called from authenticated invoker paths (held-draft creation)
-- and independently checks workspace membership before returning suppression.
grant execute on function public.is_outreach_suppressed(uuid,uuid,uuid) to authenticated;

-- Keep the unused convenience wrapper internal unless a product path explicitly
-- requires it. Worker and trigger-only functions remain service-role-only.
revoke execute on function public.operator_can_prepare_outreach(uuid) from public, anon, authenticated;

commit;
