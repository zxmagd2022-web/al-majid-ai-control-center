
drop policy "am_messages_send_own_or_director" on public.am_messages;
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
      where c.id = am_messages.conversation_id
        and c.created_by = (select auth.uid())
        and c.status <> 'closed'
    )
  )
);
