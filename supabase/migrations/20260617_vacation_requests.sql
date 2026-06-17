-- supabase/migrations/20260617_vacation_requests.sql

create table vacation_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz default now(),
  decided_at timestamptz,
  check (end_date >= start_date)
);

alter table vacation_requests enable row level security;

create policy "vacation_requests_teacher_read_own" on vacation_requests
  for select using (teacher_id = auth.uid());

create policy "vacation_requests_teacher_insert" on vacation_requests
  for insert with check (teacher_id = auth.uid());

create policy "vacation_requests_admin_all" on vacation_requests
  for all using (
    exists (select 1 from teachers where id = auth.uid() and role = 'admin')
  );
