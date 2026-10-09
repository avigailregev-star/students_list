-- Freeze the old recurring slot into concrete lesson rows before an admin
-- changes it. Calendar history can then be read from lessons while the new
-- weekly slot is used only going forward.
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

 -- Keep every occurrence of the old slot through today. Existing rows (and
 -- their attendance) win; holidays are marked so reports continue to omit them.
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
