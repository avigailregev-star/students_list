-- Removing a pupil must not make earlier recurring lessons disappear. Freeze
-- every occurrence that existed while the pupil was active, then archive the
-- membership row that supplies the historical calendar label.
create or replace function public.retire_student_atomic(
  p_actor_id uuid,
  p_student_id uuid
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
  v_group public.groups%rowtype;
  v_from date;
begin
  select * into v_student
  from public.students
  where id = p_student_id
  for update;

  if not found then
    raise exception 'תלמיד לא נמצא';
  end if;

  select * into v_group
  from public.groups
  where id = v_student.group_id;

  if not found then
    raise exception 'קבוצה לא נמצאה';
  end if;

  if v_group.teacher_id <> p_actor_id and not exists (
    select 1 from public.teachers where id = p_actor_id and role = 'admin'
  ) then
    raise exception 'אין הרשאה להסיר את התלמיד' using errcode = '42501';
  end if;

  v_from := greatest(date '2026-09-01', v_student.created_at::date, v_group.created_at::date);

  insert into public.lessons(group_id, date, start_time, is_holiday, holiday_name)
  select v_group.id, occurrence.day::date, schedule.start_time,
    holiday.name is not null, holiday.name
  from public.group_schedules schedule
  cross join lateral pg_catalog.generate_series(
    v_from,
    least(current_date, date '2027-06-30'),
    interval '1 day'
  ) occurrence(day)
  left join lateral (
    select event.name
    from public.school_events event
    where event.event_type in ('holiday', 'vacation')
      and occurrence.day::date between event.start_date and event.end_date
    order by event.start_date, event.id
    limit 1
  ) holiday on true
  where schedule.group_id = v_group.id
    and extract(dow from occurrence.day)::int = schedule.day_of_week
  on conflict(group_id, date, start_time) do nothing;

  update public.students
  set is_active = false
  where id = p_student_id;

  return v_group.id;
end
$$;

revoke all on function public.retire_student_atomic(uuid, uuid) from public, anon, authenticated;
grant execute on function public.retire_student_atomic(uuid, uuid) to service_role;

-- A collision at the same time is not proof of a duplicate: historical data
-- can legitimately contain overlapping appointments. Only suppress a row when
-- the same pupil already has a concrete lesson in another private group.
create or replace function public.update_group_schedule_atomic(
 p_actor_id uuid,p_group_id uuid,p_teacher_id uuid,p_schedule_id uuid,p_name text,p_lesson_type text,p_day int,p_start text,p_end text
) returns void language plpgsql security invoker set search_path='' as $$
declare
 v_schedule uuid; v_count int; v_start time; v_end time;
 v_old public.group_schedules%rowtype;
begin
 if not exists(select 1 from public.teachers where id=p_actor_id and role='admin') then raise exception 'Administrator required' using errcode='42501'; end if;
 perform 1 from public.teachers where id=p_teacher_id for update;
 if not exists(select 1 from public.groups where id=p_group_id and teacher_id=p_teacher_id) then raise exception 'הקבוצה אינה שייכת למורה'; end if;
 if p_day not between 0 and 6 or p_day is null or nullif(btrim(p_name),'') is null then raise exception 'יום או שם קבוצה אינם תקינים'; end if;
 if p_start is null or p_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' or (p_end is not null and p_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$') then raise exception 'שעות אינן תקינות'; end if;
 v_start:=p_start::time;
 v_end:=coalesce(p_end::time,v_start+make_interval(mins=>case when p_lesson_type='individual_60' then 60 when p_lesson_type in ('orchestra','choir') then 90 else 45 end));
 if v_end<=v_start then raise exception 'שעת הסיום צריכה להיות אחרי שעת ההתחלה'; end if;
 if p_schedule_id is not null then
  select * into v_old from public.group_schedules where id=p_schedule_id and group_id=p_group_id for update;
  if not found then raise exception 'המועד אינו קיים בקבוצה'; end if;
  v_schedule:=v_old.id;
 else
  select count(*) into v_count from public.group_schedules where group_id=p_group_id;
  if v_count>1 then raise exception 'יש לבחור את המועד לעריכה'; end if;
  select * into v_old from public.group_schedules where group_id=p_group_id limit 1 for update;
  v_schedule:=v_old.id;
 end if;
 if exists(select 1 from public.group_schedules s join public.groups g on g.id=s.group_id
  where g.teacher_id=p_teacher_id and s.day_of_week=p_day and s.id is distinct from v_schedule
  and s.start_time::time<v_end and
  coalesce(nullif(s.end_time,'')::time,s.start_time::time+make_interval(mins=>case when g.lesson_type='individual_60' then 60 when g.lesson_type in ('orchestra','choir') then 90 else 45 end))>v_start)
 then raise exception 'השעות חופפות לשיעור קיים'; end if;

 if v_schedule is not null and (
   v_old.day_of_week is distinct from p_day or v_old.start_time::time is distinct from v_start
   or nullif(v_old.end_time,'')::time is distinct from p_end::time
 ) then
  insert into public.lessons(group_id,date,start_time,is_holiday,holiday_name)
  select p_group_id,d::date,v_old.start_time,
    holiday.name is not null,holiday.name
  from pg_catalog.generate_series(date '2026-09-01',least(current_date,date '2027-06-30'),interval '1 day') d
  left join lateral (
    select e.name from public.school_events e
    where e.event_type in ('holiday','vacation') and d::date between e.start_date and e.end_date
    order by e.start_date,e.id limit 1
  ) holiday on true
  where extract(dow from d)::int=v_old.day_of_week
    and not exists (
      select 1
      from public.groups source_group
      join public.students source_student on source_student.group_id=source_group.id
      join public.groups other_group on other_group.teacher_id=source_group.teacher_id
      join public.students other_student on other_student.group_id=other_group.id
      join public.lessons existing on existing.group_id=other_group.id and existing.date=d::date
      where source_group.id=p_group_id
        and source_group.lesson_type in ('individual_45','individual_60','melodies_individual')
        and other_group.id<>p_group_id
        and other_group.lesson_type in ('individual_45','individual_60','melodies_individual')
        and existing.is_makeup=false and existing.is_holiday=false
        and regexp_replace(lower(btrim(source_student.name)), '\s*\(היסטורי [^)]+\)\s*$', '')
            = regexp_replace(lower(btrim(other_student.name)), '\s*\(היסטורי [^)]+\)\s*$', '')
    )
  on conflict(group_id,date,start_time) do nothing;
 end if;

 update public.groups set name=btrim(p_name),lesson_type=p_lesson_type where id=p_group_id;
 if v_schedule is null then
  insert into public.group_schedules(group_id,day_of_week,start_time,end_time) values(p_group_id,p_day,p_start,p_end);
 else
  update public.group_schedules set day_of_week=p_day,start_time=p_start,end_time=p_end where id=v_schedule;
 end if;
end $$;

revoke all on function public.update_group_schedule_atomic(uuid,uuid,uuid,uuid,text,text,int,text,text) from public,anon,authenticated;
grant execute on function public.update_group_schedule_atomic(uuid,uuid,uuid,uuid,text,text,int,text,text) to service_role;

-- Restore any real attendance record that an earlier duplicate-cleanup pass
-- accidentally hid. Attendance is stronger evidence than a time collision.
update public.lessons lesson
set is_holiday = false,
    holiday_name = null
where lesson.holiday_name = 'רשומה כפולה משינוי שיבוץ'
  and exists (select 1 from public.attendance where lesson_id = lesson.id);

-- This pupil's private group was created after the first school week, although
-- the recurring placement already applied on 3 September. Recreate the missing
-- concrete occurrence idempotently.
insert into public.lessons(group_id, date, start_time, is_holiday, holiday_name)
select group_row.id, date '2026-09-03', schedule.start_time, false, null
from public.groups group_row
join public.group_schedules schedule on schedule.group_id = group_row.id
join public.students student on student.group_id = group_row.id
where group_row.id = '322471aa-03d8-4733-bf7a-b1074ca09a5f'::uuid
  and student.name = 'אמיתי קליקה'
  and schedule.day_of_week = 4
on conflict(group_id, date, start_time) do nothing;

-- The withdrawn pupil's membership and private group were hard-deleted, so no
-- row survived to label the old calendar occurrence. The surrounding schedule
-- history shows that Adam moved from 14:45 into the newly vacated 16:15 slot.
-- Recreate only the historical entities and occurrence: no group_schedule is
-- added, so this cannot project any future lessons.
insert into public.groups(id, teacher_id, name, lesson_type, created_at)
select
  'e4fb2a06-1f6a-4a06-a7d0-f5e73d6694cd'::uuid,
  teacher.id,
  'פרטני 45 דקות - לביא בן חיים',
  'individual_45',
  '2026-09-03T12:00:00+00'::timestamptz
from public.teachers teacher
where teacher.id = 'be8d46a4-1298-4c4e-9900-11b9fe7349ed'::uuid
on conflict(id) do nothing;

insert into public.students(id, group_id, name, is_active, created_at)
select
  '08b8f956-4652-473e-b02c-7b6f32463b7d'::uuid,
  historical_group.id,
  'לביא בן חיים',
  false,
  '2026-09-03T12:00:00+00'::timestamptz
from public.groups historical_group
where historical_group.id = 'e4fb2a06-1f6a-4a06-a7d0-f5e73d6694cd'::uuid
on conflict(id) do nothing;

insert into public.lessons(group_id, date, start_time, is_holiday, holiday_name)
select historical_group.id, date '2026-09-03', '16:15', false, null
from public.groups historical_group
join public.students historical_student on historical_student.group_id = historical_group.id
where historical_group.id = 'e4fb2a06-1f6a-4a06-a7d0-f5e73d6694cd'::uuid
  and historical_student.id = '08b8f956-4652-473e-b02c-7b6f32463b7d'::uuid
on conflict(group_id, date, start_time) do nothing;
