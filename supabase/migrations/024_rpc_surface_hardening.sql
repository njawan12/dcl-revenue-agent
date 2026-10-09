-- Minimize the authenticated PostgREST RPC surface.
-- RLS may invoke SECURITY DEFINER helpers without granting clients EXECUTE.
-- Keep only intentional application RPCs callable by authenticated users.

begin;

-- Internal authorization/policy helpers. These are implementation details used
-- from RLS policies, triggers, or other trusted database functions; exposing
-- them as client-callable RPCs adds unnecessary attack surface.
revoke execute on function public.is_workspace_member(uuid) from public, anon, authenticated;
revoke execute on function public.can_manage_workspace(uuid) from public, anon, authenticated;
revoke execute on function public.can_operate_workspace(uuid) from public, anon, authenticated;
revoke execute on function public.operator_can_prepare_outreach(uuid) from public, anon, authenticated;
revoke execute on function public.is_outreach_suppressed(uuid,uuid,uuid) from public, anon, authenticated;

-- Intentional application entry points. Workspace creation is the authenticated
-- onboarding boundary; native pipeline mutation is the audited optimistic-lock
-- boundary used by the server action. Their bodies independently authorize the
-- caller and must remain callable by signed-in application users.
revoke execute on function public.create_workspace_with_owner(text,text,jsonb,text[],text[]) from public, anon;
grant execute on function public.create_workspace_with_owner(text,text,jsonb,text[],text[]) to authenticated;

revoke execute on function public.update_native_pipeline(uuid,uuid,integer,text,text,date) from public, anon;
grant execute on function public.update_native_pipeline(uuid,uuid,integer,text,text,date) to authenticated;

-- Worker and trigger-only functions were already restricted by migration 020;
-- repeat no grants here so future reviews can reason from an explicit allowlist.

commit;
