
drop policy "am_conversations_director_all" on public.am_conversations;
drop policy "am_conversations_customer_read_own" on public.am_conversations;
create policy "am_conversations_read_own_or_director"
on public.am_conversations for select to authenticated
using (
  (select public.is_active_director())
  or exists (
    select 1 from public.am_clients cl
    where cl.id = am_conversations.client_id
      and cl.client_profile_id = (select auth.uid())
  )
);
create policy "am_conversations_director_insert"
on public.am_conversations for insert to authenticated
with check ((select public.is_active_director()));
create policy "am_conversations_director_update"
on public.am_conversations for update to authenticated
using ((select public.is_active_director()))
with check ((select public.is_active_director()));
create policy "am_conversations_director_delete"
on public.am_conversations for delete to authenticated
using ((select public.is_active_director()));

drop policy "am_messages_director_all" on public.am_messages;
drop policy "am_messages_customer_read_own" on public.am_messages;
drop policy "am_messages_customer_send_own" on public.am_messages;
create policy "am_messages_read_own_or_director"
on public.am_messages for select to authenticated
using (
  (select public.is_active_director())
  or exists (
    select 1
    from public.am_conversations c
    join public.am_clients cl on cl.id = c.client_id
    where c.id = am_messages.conversation_id
      and cl.client_profile_id = (select auth.uid())
  )
);
create policy "am_messages_send_own_or_director"
on public.am_messages for insert to authenticated
with check (
  (
    (select public.is_active_director())
    and sender_type in ('agency','ai','human','system')
  )
  or (
    sender_type = 'customer'
    and sender_id = (select auth.uid())
    and exists (
      select 1
      from public.am_conversations c
      join public.am_clients cl on cl.id = c.client_id
      where c.id = am_messages.conversation_id
        and cl.client_profile_id = (select auth.uid())
        and c.status <> 'closed'
    )
  )
);

drop policy "am_attachments_director_all" on public.am_message_attachments;
drop policy "am_attachments_customer_read_own" on public.am_message_attachments;
drop policy "am_attachments_customer_add_own" on public.am_message_attachments;
create policy "am_attachments_read_own_or_director"
on public.am_message_attachments for select to authenticated
using (
  (select public.is_active_director())
  or exists (
    select 1
    from public.am_conversations c
    join public.am_clients cl on cl.id = c.client_id
    where c.id = am_message_attachments.conversation_id
      and cl.client_profile_id = (select auth.uid())
  )
);
create policy "am_attachments_add_own_or_director"
on public.am_message_attachments for insert to authenticated
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
      and (
        (
          cl.client_profile_id = (select auth.uid())
          and m.sender_type = 'customer'
          and m.sender_id = (select auth.uid())
        )
        or (
          (select public.is_active_director())
          and m.sender_type in ('agency','ai','human','system')
        )
      )
  )
);

create index if not exists am_conversations_created_by_idx
  on public.am_conversations (created_by);
create index if not exists am_messages_sender_id_idx
  on public.am_messages (sender_id);
create index if not exists am_message_attachments_conversation_idx
  on public.am_message_attachments (conversation_id);
create index if not exists am_message_attachments_uploaded_by_idx
  on public.am_message_attachments (uploaded_by);
