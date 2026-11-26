
begin;

-- =========================================================
-- AL MAJID CLIENT CHAT
-- Safe policy update: preserve existing tables and data
-- No table recreation, no bucket modification, no function replacement
-- =========================================================

-- 1. Ensure RLS is enabled on existing tables
alter table public.am_conversations enable row level security;
alter table public.am_messages enable row level security;
alter table public.am_message_attachments enable row level security;

-- 2. Add missing indexes without replacing existing indexes
create index if not exists am_conversations_client_created_idx
  on public.am_conversations (client_id, created_at desc);

create index if not exists am_conversations_project_idx
  on public.am_conversations (project_id);

create index if not exists am_messages_conversation_created_idx
  on public.am_messages (conversation_id, created_at asc);

create index if not exists am_message_attachments_message_idx
  on public.am_message_attachments (message_id);

-- 3. Remove known previous conversation policies
drop policy if exists am_conversations_director_delete
  on public.am_conversations;
drop policy if exists am_conversations_director_update
  on public.am_conversations;
drop policy if exists am_conversations_insert_own_or_director
  on public.am_conversations;
drop policy if exists am_conversations_read_own_or_director
  on public.am_conversations;

-- Remove policies from the proposed version, if already created
drop policy if exists am_conversations_director_all
  on public.am_conversations;
drop policy if exists am_conversations_customer_read_own
  on public.am_conversations;
drop policy if exists am_conversations_customer_insert_own
  on public.am_conversations;

-- 4. Conversation policies
create policy am_conversations_director_all
on public.am_conversations
for all to authenticated
using ((select public.is_active_director()))
with check ((select public.is_active_director()));

create policy am_conversations_customer_read_own
on public.am_conversations
for select to authenticated
using (
  exists (
    select 1
    from public.am_clients cl
    where cl.id = am_conversations.client_id
      and cl.client_profile_id = (select auth.uid())
  )
);

create policy am_conversations_customer_insert_own
on public.am_conversations
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.am_clients cl
    join public.am_projects pr
      on pr.client_id = cl.id
    where cl.id = am_conversations.client_id
      and cl.client_profile_id = (select auth.uid())
      and pr.id = am_conversations.project_id
  )
);

-- 5. Remove known previous message policies
drop policy if exists am_messages_read_own_or_director
  on public.am_messages;
drop policy if exists am_messages_send_own_or_director
  on public.am_messages;

drop policy if exists am_messages_director_all
  on public.am_messages;
drop policy if exists am_messages_customer_read_own
  on public.am_messages;
drop policy if exists am_messages_customer_send_own
  on public.am_messages;

-- 6. Message policies
create policy am_messages_director_all
on public.am_messages
for all to authenticated
using ((select public.is_active_director()))
with check ((select public.is_active_director()));

create policy am_messages_customer_read_own
on public.am_messages
for select to authenticated
using (
  exists (
    select 1
    from public.am_conversations c
    join public.am_clients cl on cl.id = c.client_id
    where c.id = am_messages.conversation_id
      and cl.client_profile_id = (select auth.uid())
  )
);

create policy am_messages_customer_send_own
on public.am_messages
for insert to authenticated
with check (
  sender_type = 'customer'
  and sender_id = (select auth.uid())
  and exists (
    select 1
    from public.am_conversations c
    join public.am_clients cl on cl.id = c.client_id
    where c.id = am_messages.conversation_id
      and cl.client_profile_id = (select auth.uid())
      and c.status in ('open', 'waiting', 'needs_human')
  )
);

-- 7. Remove known previous attachment policies
drop policy if exists am_attachments_add_own_or_director
  on public.am_message_attachments;
drop policy if exists am_attachments_read_own_or_director
  on public.am_message_attachments;

drop policy if exists am_attachments_director_all
  on public.am_message_attachments;
drop policy if exists am_attachments_customer_read_own
  on public.am_message_attachments;
drop policy if exists am_attachments_customer_add_own
  on public.am_message_attachments;

-- 8. Attachment policies
create policy am_attachments_director_all
on public.am_message_attachments
for all to authenticated
using ((select public.is_active_director()))
with check ((select public.is_active_director()));

create policy am_attachments_customer_read_own
on public.am_message_attachments
for select to authenticated
using (
  exists (
    select 1
    from public.am_conversations c
    join public.am_clients cl on cl.id = c.client_id
    where c.id = am_message_attachments.conversation_id
      and cl.client_profile_id = (select auth.uid())
  )
);

create policy am_attachments_customer_add_own
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

-- 9. Remove known previous Storage policies
drop policy if exists am_chat_media_read_own_or_director
  on storage.objects;
drop policy if exists am_chat_media_upload_own_or_director
  on storage.objects;

-- 10. Storage read policy
create policy am_chat_media_read_own_or_director
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

-- 11. Storage upload policy
-- Expected path: user_id/conversation_id/file_name
create policy am_chat_media_upload_own_or_director
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
          select 1
          from public.am_clients cl
          where cl.id = c.client_id
            and cl.client_profile_id = (select auth.uid())
        )
      )
  )
);

commit;
