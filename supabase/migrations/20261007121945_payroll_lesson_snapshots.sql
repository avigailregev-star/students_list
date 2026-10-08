-- Dimona: preserve existing calculations as an explicitly unverified baseline.
-- Additive migration; no attendance, status, reason or schedule values are changed.
begin;
lock table public.lessons,public.groups,public.group_schedules in share row exclusive mode;
create temporary table payroll_migration_before on commit drop as
 select id,to_jsonb(l) as original_row from public.lessons l;

alter table public.lessons
 add column payroll_lesson_type text,
 add column payroll_units numeric,
 add column payroll_occurrence_key text,
 -- Provenance only: deleting a makeup must not cascade or erase another
 -- lesson's immutable billing snapshot. The trigger validates the source.
 add column payroll_source_lesson_id uuid,
 add column payroll_snapshot_origin text,
 add column payroll_captured_at timestamptz;

-- Existing Dimona numbers are frozen as the user requested, not reconstructed.
-- The origin label is retained in every report until separately reviewed.
do $$
declare l record; v_start time; v_end time; v_units numeric; v_day int; v_day_count int; v_total int;
begin
 for l in select lessons.*,g.lesson_type from public.lessons lessons join public.groups g on g.id=lessons.group_id loop
  v_start:=null; v_end:=null; v_units:=1; v_day:=extract(dow from l.date)::int;
  select count(*) into v_day_count from public.group_schedules where group_id=l.group_id and day_of_week=v_day;
  if l.lesson_type in ('orchestra','choir') then
   -- Same day-first / exact-time / sole-slot fallback as getLessonUnits.
   select count(*) into v_total from public.group_schedules where group_id=l.group_id and (v_day_count=0 or day_of_week=v_day);
   select start_time::time,end_time::time into v_start,v_end from public.group_schedules
    where group_id=l.group_id and (v_day_count=0 or day_of_week=v_day)
      and (left(start_time,5)=left(l.start_time,5) or v_total=1)
    order by id limit 1;
   if v_end>v_start then v_units:=extract(epoch from(v_end-v_start))/2700; end if;
  end if;
  update public.lessons set payroll_lesson_type=l.lesson_type,payroll_units=v_units,
   payroll_occurrence_key=case when l.is_makeup then 'makeup:'||l.id::text
    else 'regular:'||l.date::text||case when v_day_count>1 then ':'||left(l.start_time,5) else '' end end,
   payroll_snapshot_origin='legacy_baseline',payroll_captured_at=transaction_timestamp()
   where id=l.id;
 end loop;
end $$;

create or replace function app_private.capture_lesson_payroll()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
 v_type text; v_units numeric := 1; v_start time; v_end time;
 v_day int; v_slots int; v_matches int; v_source public.lessons%rowtype;
begin
 if tg_op='UPDATE' then
  if new.payroll_lesson_type is distinct from old.payroll_lesson_type
   or new.payroll_units is distinct from old.payroll_units
   or new.payroll_occurrence_key is distinct from old.payroll_occurrence_key
   or new.payroll_source_lesson_id is distinct from old.payroll_source_lesson_id
   or new.payroll_snapshot_origin is distinct from old.payroll_snapshot_origin
   or new.payroll_captured_at is distinct from old.payroll_captured_at
   or new.start_time is distinct from old.start_time
   or new.group_id is distinct from old.group_id
   or new.date is distinct from old.date
   or new.is_makeup is distinct from old.is_makeup then
   raise exception 'פרטי השכר של שיעור שנוצר נשמרים להיסטוריה; יש ליצור שיעור חדש';
  end if;
  return new;
 end if;

 new.payroll_snapshot_origin := 'captured';
 new.payroll_captured_at := clock_timestamp();
 select lesson_type into strict v_type from public.groups where id=new.group_id;
 v_day := extract(dow from new.date)::int;
 select count(*) into v_slots from public.group_schedules where group_id=new.group_id and day_of_week=v_day;
 if new.payroll_source_lesson_id is not null then
  select * into v_source from public.lessons where id=new.payroll_source_lesson_id;
  if not found or v_source.group_id<>new.group_id or not new.is_makeup then
   raise exception 'מקור ההשלמה אינו תקין';
  end if;
  v_type := v_source.payroll_lesson_type;
  v_units := v_source.payroll_units;
  new.payroll_snapshot_origin := v_source.payroll_snapshot_origin;
 elsif v_type in ('orchestra','choir') then
  -- Match day AND time. A moved lesson may use the sole slot on that day;
  -- ambiguous durations stop the write instead of silently guessing one unit.
  select count(*) into v_matches from public.group_schedules
   where group_id=new.group_id and day_of_week=v_day and start_time::time=new.start_time::time;
  if v_matches=1 then
   select start_time::time,end_time::time into v_start,v_end from public.group_schedules
    where group_id=new.group_id and day_of_week=v_day and start_time::time=new.start_time::time;
  elsif v_slots=1 then
   select start_time::time,end_time::time into v_start,v_end from public.group_schedules where group_id=new.group_id and day_of_week=v_day;
  else
   select count(*) into v_matches from public.group_schedules where group_id=new.group_id;
   if v_matches=1 then
    select start_time::time,end_time::time into v_start,v_end from public.group_schedules where group_id=new.group_id;
   end if;
  end if;
  if v_end is null or v_start is null or v_end<=v_start then
   raise exception 'לא ניתן לקבוע את משך השיעור לדוח השכר; יש להגדיר מועד ושעת סיום';
  end if;
  v_units := extract(epoch from (v_end-v_start))/2700;
 end if;
 new.payroll_lesson_type := v_type;
 new.payroll_units := v_units;
 new.payroll_occurrence_key := case when new.is_makeup then 'makeup:'||new.id::text
  else 'regular:'||new.date::text||case when v_slots>1 then ':'||to_char(new.start_time::time,'HH24:MI') else '' end end;
 return new;
end $$;

revoke all on function app_private.capture_lesson_payroll() from public,anon,authenticated;
grant execute on function app_private.capture_lesson_payroll() to service_role;
create trigger capture_lesson_payroll before insert or update on public.lessons
 for each row execute function app_private.capture_lesson_payroll();
alter table public.lessons
 alter column payroll_lesson_type set not null,
 alter column payroll_units set not null,
 alter column payroll_occurrence_key set not null,
 alter column payroll_snapshot_origin set not null,
 alter column payroll_captured_at set not null,
 add constraint lessons_payroll_origin_check check(payroll_snapshot_origin in ('captured','legacy_baseline')),
 add constraint lessons_payroll_type_check check(payroll_lesson_type in ('individual_45','individual_60','group','theory','orchestra','choir','melodies_individual','melodies_group','darcha')),
 add constraint lessons_payroll_units_check check(payroll_units>0 and payroll_units<=32);
create or replace function public.save_attendance_atomic(
 p_teacher_id uuid, p_lesson_id uuid, p_student_id uuid, p_status text, p_brought boolean
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_lesson public.lessons%rowtype;
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
 -- Compare immutable occurrence identities, not today's schedule slot count.
 if not v_lesson.is_makeup then
  delete from public.attendance a using public.lessons l
   where a.lesson_id=l.id and a.student_id=p_student_id and l.id<>p_lesson_id
    and l.group_id=v_lesson.group_id and l.date=v_lesson.date and not l.is_makeup
    and l.payroll_occurrence_key=v_lesson.payroll_occurrence_key;
 end if;
end $$;
revoke all on function public.save_attendance_atomic(uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.save_attendance_atomic(uuid,uuid,uuid,text,boolean) to service_role;


-- Refuse to commit if any pre-existing business field was changed.
do $$ begin
 if exists(select 1 from public.lessons l join payroll_migration_before b using(id)
  where (to_jsonb(l)-array['payroll_lesson_type','payroll_units','payroll_occurrence_key',
   'payroll_source_lesson_id','payroll_snapshot_origin','payroll_captured_at']) is distinct from b.original_row)
 or (select count(*) from public.lessons)<>(select count(*) from payroll_migration_before) then
  raise exception 'Payroll migration changed existing business data; rolling back';
 end if;
end $$;
commit;
