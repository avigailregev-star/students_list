-- Teachers had SELECT and INSERT policies on messages, but no UPDATE policy,
-- so replying to an admin message silently affected 0 rows under RLS
-- (Supabase does not surface an error for RLS-filtered updates).
create policy "messages_teacher_reply_to_admin" on messages
  for update
  using (teacher_id = auth.uid() and from_admin = true)
  with check (teacher_id = auth.uid() and from_admin = true);
