
create schema if not exists app_private;

create or replace function app_private.customer_client_id_for_project(
  p_project_id uuid,
  p_user_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select cl.id
  from public.am_clients cl
  join public.am_projects pr on pr.client_id = cl.id
  where pr.id = p_project_id
    and cl.client_profile_id = p_user_id
  limit 1;
$function$;

revoke all on function app_private.customer_client_id_for_project(uuid,uuid) from public, anon, authenticated;
grant usage on schema app_private to authenticated;
grant execute on function app_private.customer_client_id_for_project(uuid,uuid) to authenticated;

drop policy "am_conversations_director_insert" on public.am_conversations;
create policy "am_conversations_insert_own_or_director"
on public.am_conversations for insert to authenticated
with check (
  (select public.is_active_director())
  or (
    created_by = (select auth.uid())
    and client_id = app_private.customer_client_id_for_project(project_id, (select auth.uid()))
  )
);

create or replace function public.customer_start_conversation(
  p_project_id uuid,
  p_language text default 'ar'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_client_id uuid;
  v_conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_language is null or p_language not in ('ar','en','ha') then
    raise exception 'unsupported language';
  end if;

  v_client_id := app_private.customer_client_id_for_project(p_project_id, auth.uid());
  if v_client_id is null then
    raise exception 'project not found for this customer account';
  end if;

  insert into public.am_conversations (
    client_id, project_id, created_by, preferred_language
  )
  values (v_client_id, p_project_id, auth.uid(), p_language)
  returning id into v_conversation_id;

  return v_conversation_id;
end;
$function$;

revoke all on function public.customer_start_conversation(uuid,text) from public, anon;
grant execute on function public.customer_start_conversation(uuid,text) to authenticated;
