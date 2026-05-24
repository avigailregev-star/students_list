create table if not exists bug_reports (
  id               uuid        primary key default gen_random_uuid(),
  teacher_id       uuid        references teachers(id) on delete set null,
  teacher_name     text,
  page_url         text        not null,
  error_message    text        not null,
  error_stack      text,
  user_description text,
  status           text        not null default 'new' check (status in ('new', 'resolved')),
  created_at       timestamptz not null default now()
);

-- Enable RLS
alter table bug_reports enable row level security;

-- Authenticated teachers can insert
create policy "auth_insert" on bug_reports
  for insert to authenticated with check (true);

-- Only admin can read
create policy "admin_select" on bug_reports
  for select using (
    exists (select 1 from teachers where id = auth.uid() and role = 'admin')
  );

-- Only admin can update (mark resolved)
create policy "admin_update" on bug_reports
  for update using (
    exists (select 1 from teachers where id = auth.uid() and role = 'admin')
  );
