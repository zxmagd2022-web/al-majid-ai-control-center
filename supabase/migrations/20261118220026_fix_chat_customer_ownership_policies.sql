
drop policy "am_conversations_read_own_or_director" on public.am_conversations;
create policy "am_conversations_read_own_or_director"
on public.am_conversations for select to authenticated
using (
  (select public.is_active_director())
  or created_by = (select auth.uid())
);

drop policy "am_messages_read_own_or_director" on public.am_messages;
create policy "am_messages_read_own_or_director"
on public.am_messages for select to authenticated
using (
  (select public.is_active_director())
  or exists (
    select 1 from public.am_conversations c
    where c.id = am_messages.conversation_id
      and c.created_by = (select auth.uid())
  )
);

drop policy "am_attachments_read_own_or_director" on public.am_message_attachments;
create policy "am_attachments_read_own_or_director"
on public.am_message_attachments for select to authenticated
using (
  (select public.is_active_director())
  or exists (
    select 1 from public.am_conversations c
    where c.id = am_message_attachments.conversation_id
      and c.created_by = (select auth.uid())
  )
);

drop policy "am_attachments_add_own_or_director" on public.am_message_attachments;
create policy "am_attachments_add_own_or_director"
on public.am_message_attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1
    from public.am_conversations c
    join public.am_messages m
      on m.id = am_message_attachments.message_id
     and m.conversation_id = c.id
    where c.id = am_message_attachments.conversation_id
      and (
        (
          c.created_by = (select auth.uid())
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

drop policy "am_chat_media_read_own_or_director" on storage.objects;
create policy "am_chat_media_read_own_or_director"
on storage.objects for select to authenticated
using (
  bucket_id = 'am-client-chat-media'
  and (
    (select public.is_active_director())
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and exists (
        select 1 from public.am_conversations c
        where c.id::text = (storage.foldername(name))[2]
          and c.created_by = (select auth.uid())
      )
    )
  )
);

drop policy "am_chat_media_upload_own_or_director" on storage.objects;
create policy "am_chat_media_upload_own_or_director"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'am-client-chat-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.am_conversations c
    where c.id::text = (storage.foldername(name))[2]
      and (
        (select public.is_active_director())
        or c.created_by = (select auth.uid())
      )
  )
);
