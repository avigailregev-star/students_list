-- Restrict public access without modifying existing business records.
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated, service_role;

-- A narrowly scoped, non-API lookup prevents recursive teachers RLS.
create or replace function app_private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.teachers where id = auth.uid() and role = 'admin'
  );
$$;
revoke all on function app_private.is_admin() from public, anon;
grant execute on function app_private.is_admin() to authenticated, service_role;

revoke all on public.teachers, public.school_events, public.school_event_assignments from anon;
drop policy if exists allow_all_authenticated on public.teachers;
drop policy if exists public_can_read_teachers on public.teachers;
drop policy if exists teachers_read_self on public.teachers;
create policy teachers_read_self on public.teachers for select to authenticated using (id = (select auth.uid()));
create policy teachers_admin_all on public.teachers for all to authenticated
 using ((select app_private.is_admin())) with check ((select app_private.is_admin()));

drop policy if exists admin_all on public.school_events;
create policy events_admin_all on public.school_events for all to authenticated
 using ((select app_private.is_admin())) with check ((select app_private.is_admin()));
create policy events_teacher_read on public.school_events for select to authenticated
 using (event_type in ('holiday','vacation') or exists (
   select 1 from public.school_event_assignments a where a.event_id = school_events.id and a.teacher_id = (select auth.uid())
 ));
drop policy if exists admin_all on public.school_event_assignments;

drop policy if exists vacation_requests_teacher_insert on public.vacation_requests;
create policy vacation_requests_teacher_insert on public.vacation_requests for insert to authenticated
 with check (teacher_id = (select auth.uid()) and status = 'pending' and admin_note is null and decided_at is null);

drop policy if exists messages_teacher_insert on public.messages;
create policy messages_teacher_insert on public.messages for insert to authenticated
 with check (teacher_id = (select auth.uid()) and from_admin = false and status = 'pending' and reply is null and replied_at is null);

create or replace function app_private.protect_message_content()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if current_user = 'authenticated' and not app_private.is_admin() then
    if (to_jsonb(new) - array['reply','status','replied_at']) is distinct from
       (to_jsonb(old) - array['reply','status','replied_at']) then
      raise exception 'Only the reply may be changed' using errcode = '42501';
    end if;
    if new.status <> 'replied' or nullif(btrim(new.reply),'') is null then
      raise exception 'A reply is required' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.protect_message_content() from public, anon;
grant execute on function app_private.protect_message_content() to authenticated, service_role;
create trigger protect_message_content before update on public.messages
 for each row execute function app_private.protect_message_content();

-- Teachers may request extra hours, but may not forge decision attribution.
drop policy if exists extra_hours_teacher_insert_own on public.extra_hours_requests;
create policy extra_hours_teacher_insert_own on public.extra_hours_requests for insert to authenticated
 with check (teacher_id = (select auth.uid()) and source = 'teacher' and status = 'pending'
   and decided_by is null and decided_at is null and admin_note is null);
