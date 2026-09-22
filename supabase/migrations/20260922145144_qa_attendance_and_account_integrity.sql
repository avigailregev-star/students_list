create or replace function public.save_attendance_atomic(
 p_teacher_id uuid, p_lesson_id uuid, p_student_id uuid, p_status text, p_brought boolean
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_lesson public.lessons%rowtype; v_schedule_count int;
begin
 select l.* into v_lesson from public.lessons l join public.groups g on g.id=l.group_id
 where l.id=p_lesson_id and g.teacher_id=p_teacher_id;
 if not found or not exists(select 1 from public.students s where s.id=p_student_id and s.group_id=v_lesson.group_id) then
  raise exception 'Forbidden' using errcode='42501';
 end if;
 if p_status is not null and p_status not in ('present','absent','late','excused') then
  raise exception 'Invalid status' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_lesson.group_id::text || v_lesson.date::text || p_student_id::text,0));
 if p_status is null then
  delete from public.attendance where lesson_id=p_lesson_id and student_id=p_student_id;
 else
  insert into public.attendance(lesson_id,student_id,status,brought_instrument)
  values(p_lesson_id,p_student_id,p_status,p_brought)
  on conflict(lesson_id,student_id) do update set status=excluded.status,brought_instrument=excluded.brought_instrument;
 end if;
 -- Legacy duplicate rows from changing the hour are cleaned only when there
 -- is at most one regular schedule on that weekday. Makeups are never merged.
 if not v_lesson.is_makeup then
  select count(*) into v_schedule_count from public.group_schedules
  where group_id=v_lesson.group_id and day_of_week=extract(dow from v_lesson.date)::int;
  if v_schedule_count <= 1 then
   delete from public.attendance a using public.lessons l
   where a.lesson_id=l.id and a.student_id=p_student_id and l.id<>p_lesson_id
   and l.group_id=v_lesson.group_id and l.date=v_lesson.date and not l.is_makeup;
  end if;
 end if;
end $$;
revoke all on function public.save_attendance_atomic(uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.save_attendance_atomic(uuid,uuid,uuid,text,boolean) to service_role;

create or replace function public.merge_teacher_records(
 p_actor_id uuid,p_source_id uuid,p_target_id uuid,p_name text default null,p_email text default null,p_pending_only boolean default true
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_source public.teachers%rowtype;
begin
 if not exists(select 1 from public.teachers where id=p_actor_id and role='admin') then
  raise exception 'Administrator required' using errcode='42501';
 end if;
 perform 1 from public.teachers where id in(p_source_id,p_target_id) order by id for update;
 select * into v_source from public.teachers where id=p_source_id;
 if not found or v_source.role <> 'teacher' or (p_pending_only and not v_source.is_pending) then
  raise exception 'Source teacher is not eligible';
 end if;
 if not exists(select 1 from auth.users where id=p_target_id) then raise exception 'Target account missing'; end if;
 if exists(select 1 from public.teachers where id=p_target_id and role='admin') then raise exception 'Cannot merge into administrator'; end if;
 if p_source_id=p_target_id then
  update public.teachers set is_pending=false,email=coalesce(p_email,email) where id=p_target_id;
  return;
 end if;
 insert into public.teachers(id,name,email,phone,role,hourly_rate,instrument_type,available_days,available_hours,max_students,weekly_hours_quota,courses,is_pending)
 values(p_target_id,coalesce(nullif(btrim(p_name),''),v_source.name),coalesce(p_email,v_source.email),v_source.phone,'teacher',
 v_source.hourly_rate,v_source.instrument_type,v_source.available_days,v_source.available_hours,v_source.max_students,v_source.weekly_hours_quota,v_source.courses,false)
 on conflict(id) do nothing;
 update public.groups set teacher_id=p_target_id where teacher_id=p_source_id;
 update public.teacher_availability_ranges set teacher_id=p_target_id where teacher_id=p_source_id;
 update public.messages set teacher_id=p_target_id where teacher_id=p_source_id;
 update public.vacation_requests set teacher_id=p_target_id where teacher_id=p_source_id;
 update public.teacher_room_assignments set teacher_id=p_target_id where teacher_id=p_source_id;
 insert into public.school_event_assignments(event_id,teacher_id)
 select event_id,p_target_id from public.school_event_assignments where teacher_id=p_source_id on conflict do nothing;
 delete from public.school_event_assignments where teacher_id=p_source_id;
 update public.extra_hours_requests set teacher_id=p_target_id where teacher_id=p_source_id;
 update public.extra_hours_requests set decided_by=p_target_id where decided_by=p_source_id;
 update public.school_events set created_by=p_target_id where created_by=p_source_id;
 update public.bug_reports set teacher_id=p_target_id where teacher_id=p_source_id;
 delete from public.teachers where id=p_source_id;
end $$;
revoke all on function public.merge_teacher_records(uuid,uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.merge_teacher_records(uuid,uuid,uuid,text,text,boolean) to service_role;
