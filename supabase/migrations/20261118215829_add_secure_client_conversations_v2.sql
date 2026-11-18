
create table public.am_conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.am_clients(id) on delete cascade,
  project_id uuid not null references public.am_projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  subject text not null default 'محادثة جديدة',
  status text not null default 'open'
    check (status in ('open','waiting','needs_human','closed')),
  preferred_language text not null default 'ar'
    check (preferred_language in ('ar','en','ha')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index am_conversations_client_created_idx
  on public.am_conversations (client_id, created_at desc);
create index am_conversations_project_idx
  on public.am_conversations (project_id);

create table public.am_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.am_conversations(id) on delete cascade,
  sender_type text not null
    check (sender_type in ('customer','agency','ai','human','system')),
  sender_id uuid references auth.users(id) on delete set null,
  content text not null default '',
  message_type text not null default 'text'
    check (message_type in ('text','image','video','audio','file')),
  language text check (language is null or language in ('ar','en','ha')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint am_messages_content_length check (length(content) <= 8000)
);

create index am_messages_conversation_created_idx
  on public.am_messages (conversation_id, created_at asc);

create table public.am_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.am_messages(id) on delete cascade,
  conversation_id uuid not null references public.am_conversations(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size between 1 and 52428800),
  media_kind text not null check (media_kind in ('image','video','audio','file')),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index am_message_attachments_message_idx
  on public.am_message_attachments (message_id);

alter table public.am_conversations enable row level security;
alter table public.am_messages enable row level security;
alter table public.am_message_attachments enable row level security;

create policy "am_conversations_director_all"
on public.am_conversations
for all to authenticated
using ((select public.is_active_director()))
with check ((select public.is_active_director()));

create policy "am_conversations_customer_read_own"
on public.am_conversations
for select to authenticated
using (
  exists (
    select 1 from public.am_clients cl
    where cl.id = am_conversations.client_id
      and cl.client_profile_id = (select auth.uid())
  )
);

create policy "am_messages_director_all"
on public.am_messages
for all to authenticated
using ((select public.is_active_director()))
with check ((select public.is_active_director()));

create policy "am_messages_customer_read_own"
on public.am_messages
for select to authenticated
using (
  exists (
    select 1 from public.am_conversations c
    join public.am_clients cl on cl.id = c.client_id
    where c.id = am_messages.conversation_id
      and cl.client_profile_id = (select auth.uid())
  )
);

create policy "am_messages_customer_send_own"
on public.am_messages
for insert to authenticated
with check (
  sender_type = 'customer'
  and sender_id = (select auth.uid())
  and exists (
    select 1 from public.am_conversations c
    join public.am_clients cl on cl.id = c.client_id
    where c.id = am_messages.conversation_id
      and cl.client_profile_id = (select auth.uid())
      and c.status <> 'closed'
  )
);

create policy "am_attachments_director_all"
on public.am_message_attachments
for all to authenticated
using ((select public.is_active_director()))
with check ((select public.is_active_director()));

create policy "am_attachments_customer_read_own"
on public.am_message_attachments
for select to authenticated
using (
  exists (
    select 1 from public.am_conversations c
    join public.am_clients cl on cl.id = c.client_id
    where c.id = am_message_attachments.conversation_id
      and cl.client_profile_id = (select auth.uid())
  )
);

create policy "am_attachments_customer_add_own"
on public.am_message_attachments
for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1
    from public.am_conversations c
    join public.am_clients cl on cl.id = c.client_id
    join public.am_messages m
      on m.id = am_message_attachments.message_id
     and m.conversation_id = c.id
    where c.id = am_message_attachments.conversation_id
      and cl.client_profile_id = (select auth.uid())
      and m.sender_type = 'customer'
      and m.sender_id = (select auth.uid())
  )
);

create or replace function public.customer_start_conversation(
  p_project_id uuid,
  p_language text default 'ar'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_language is null or p_language not in ('ar','en','ha') then
    raise exception 'unsupported language';
  end if;

  insert into public.am_conversations (
    client_id, project_id, created_by, preferred_language
  )
  select cl.id, pr.id, auth.uid(), p_language
  from public.am_clients cl
  join public.am_projects pr on pr.client_id = cl.id
  where cl.client_profile_id = auth.uid()
    and pr.id = p_project_id
  returning id into v_conversation_id;

  if v_conversation_id is null then
    raise exception 'project not found for this customer account';
  end if;

  return v_conversation_id;
end;
$function$;

revoke all on function public.customer_start_conversation(uuid,text) from public, anon;
grant execute on function public.customer_start_conversation(uuid,text) to authenticated;

grant select, update on public.am_conversations to authenticated;
grant select, insert on public.am_messages to authenticated;
grant select, insert on public.am_message_attachments to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'am-client-chat-media',
  'am-client-chat-media',
  false,
  52428800,
  array[
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/webm','video/quicktime',
    'audio/mpeg','audio/mp4','audio/webm','audio/ogg','audio/wav','audio/x-m4a',
    'application/pdf'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "am_chat_media_read_own_or_director"
on storage.objects
for select to authenticated
using (
  bucket_id = 'am-client-chat-media'
  and (
    (select public.is_active_director())
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and exists (
        select 1
        from public.am_conversations c
        join public.am_clients cl on cl.id = c.client_id
        where c.id::text = (storage.foldername(name))[2]
          and cl.client_profile_id = (select auth.uid())
      )
    )
  )
);

create policy "am_chat_media_upload_own_or_director"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'am-client-chat-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.am_conversations c
    where c.id::text = (storage.foldername(name))[2]
      and (
        (select public.is_active_director())
        or exists (
          select 1 from public.am_clients cl
          where cl.id = c.client_id
            and cl.client_profile_id = (select auth.uid())
        )
      )
  )
);
