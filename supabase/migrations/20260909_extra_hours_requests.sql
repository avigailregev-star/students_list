create table if not exists extra_hours_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  work_date date not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  activity_type text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  source text not null default 'teacher' check (source in ('teacher', 'admin')),
  admin_note text,
  decided_by uuid references teachers(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists extra_hours_requests_teacher_date_idx
  on extra_hours_requests (teacher_id, work_date desc);

alter table extra_hours_requests enable row level security;

create policy "extra_hours_teacher_read_own" on extra_hours_requests
  for select using (auth.uid() = teacher_id);

create policy "extra_hours_teacher_insert_own" on extra_hours_requests
  for insert with check (
    auth.uid() = teacher_id and source = 'teacher' and status = 'pending'
  );

create policy "extra_hours_admin_all" on extra_hours_requests
  for all using (
    exists (select 1 from teachers where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from teachers where id = auth.uid() and role = 'admin')
  );
