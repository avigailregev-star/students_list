-- Messages table for teacher-secretary communication
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  content text not null,
  reply text,
  status text not null default 'pending' check (status in ('pending', 'replied')),
  created_at timestamptz default now(),
  replied_at timestamptz
);

alter table messages enable row level security;

create policy "messages_teacher_read_own" on messages
  for select using (teacher_id = auth.uid());

create policy "messages_teacher_insert" on messages
  for insert with check (teacher_id = auth.uid());

create policy "messages_admin_all" on messages
  for all using (
    exists (select 1 from teachers where id = auth.uid() and role = 'admin')
  );
