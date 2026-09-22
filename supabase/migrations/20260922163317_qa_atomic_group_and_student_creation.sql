-- Keep the registration system's identity checks and triggers active.
alter table public.groups add column if not exists max_students integer;
alter table public.groups add constraint groups_positive_capacity check (max_students is null or max_students>0);

create or replace function public.add_student_atomic(
 p_actor_id uuid,p_group_id uuid,p_name text,p_instrument text default null,p_parent_phone text default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_name text:=regexp_replace(btrim(coalesce(p_name,'')),'[[:space:]]+',' ','g');
 v_phone text:=regexp_replace(coalesce(p_parent_phone,''),'[^0-9]','','g');
 v_identity uuid; v_student uuid; v_registration uuid; v_ids uuid[]; v_count int; v_limit int;
begin
 if not exists(select 1 from public.groups g join public.teachers t on t.id=p_actor_id
  where g.id=p_group_id and (g.teacher_id=p_actor_id or t.role='admin')) then
  raise exception 'אין הרשאה להוסיף תלמיד לקבוצה' using errcode='42501';
 end if;
 if v_name='' then raise exception 'שם תלמיד נדרש'; end if;
 select max_students into v_limit from public.groups where id=p_group_id for update;
 if v_limit is not null and (select count(*) from public.students where group_id=p_group_id and is_active)>=(v_limit) then
  raise exception 'הקבוצה הגיעה למספר התלמידים המרבי';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('student:'||v_name||':'||v_phone,0));
 -- A shared display name alone is never permission to merge identities.
 select count(*),array_agg(distinct student_id) into v_count,v_ids from (
  select student_id from public.registrations
   where regexp_replace(btrim(student_name),'[[:space:]]+',' ','g')=v_name
    and (v_phone='' or regexp_replace(coalesce(parent_phone,''),'[^0-9]','','g')=v_phone)
  union all
  select student_id from public.students
   where regexp_replace(btrim(name),'[[:space:]]+',' ','g')=v_name
    and (v_phone='' or regexp_replace(coalesce(parent_phone,''),'[^0-9]','','g')=v_phone)
 ) candidates;
 if v_count>0 then
  if v_phone='' or cardinality(v_ids)<>1 or v_ids[1] is null then
   raise exception 'קיים רישום דומה שדורש בדיקת שיוך במערכת הרישום. יש לפנות למנהלת';
  end if;
  v_identity:=v_ids[1];
 else
  v_identity:=gen_random_uuid();
 end if;
 if exists(select 1 from public.students where group_id=p_group_id and
   (student_id=v_identity or regexp_replace(btrim(name),'[[:space:]]+',' ','g')=v_name)) then
  raise exception 'התלמיד כבר קיים בקבוצה. יש לבדוק את הרשומה הקיימת';
 end if;
 insert into public.students(group_id,name,instrument,parent_phone,is_active,student_id)
 values(p_group_id,v_name,nullif(btrim(p_instrument),''),nullif(btrim(p_parent_phone),''),true,v_identity)
 returning id into v_student;
 -- The existing database trigger creates/reuses the registration atomically.
 select array_agg(id) into v_ids from public.registrations where group_id=p_group_id and student_id=v_identity;
 if coalesce(cardinality(v_ids),0)<>1 then
  raise exception 'לא ניתן לקשר רישום יחיד לתלמיד. לא נשמרו שינויים';
 end if;
 v_registration:=v_ids[1];
 update public.students set registration_id=v_registration where id=v_student;
 if nullif(btrim(p_instrument),'') is not null then
  update public.registrations set instruments=array[btrim(p_instrument)]
   where id=v_registration and coalesce(cardinality(instruments),0)=0;
 end if;
 return v_student;
end $$;
revoke all on function public.add_student_atomic(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.add_student_atomic(uuid,uuid,text,text,text) to service_role;

create or replace function public.create_group_atomic(
 p_actor_id uuid,p_teacher_id uuid,p_name text,p_lesson_type text,p_schedules jsonb,p_students jsonb,
 p_is_mangan boolean default false,p_school_name text default null,p_grade text default null,p_max_students int default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_group uuid; v_slot jsonb; v_student jsonb; v_day int; v_start time; v_end time;
begin
 if not exists(select 1 from public.teachers where id=p_actor_id and role='admin') then
  raise exception 'נדרשת הרשאת מנהלת' using errcode='42501';
 end if;
 perform 1 from public.teachers where id=p_teacher_id for update;
 if not found then raise exception 'מורה לא נמצאה'; end if;
 if nullif(btrim(p_name),'') is null then raise exception 'שם קבוצה נדרש'; end if;
 if jsonb_typeof(p_schedules) is distinct from 'array' or jsonb_array_length(p_schedules)=0 then raise exception 'יש לבחור לפחות מועד אחד'; end if;
 if jsonb_typeof(p_students) is distinct from 'array' then raise exception 'רשימת תלמידים אינה תקינה'; end if;
 if p_max_students is not null and (p_max_students<=0 or jsonb_array_length(p_students)>p_max_students) then raise exception 'מספר התלמידים המרבי אינו תקין'; end if;
 insert into public.groups(teacher_id,name,lesson_type,is_mangan_school,school_name,grade,max_students)
 values(p_teacher_id,btrim(p_name),p_lesson_type,coalesce(p_is_mangan,false),p_school_name,p_grade,p_max_students) returning id into v_group;
 for v_slot in select value from jsonb_array_elements(p_schedules) loop
  v_day:=(v_slot->>'day_of_week')::int;
  if v_day is null or v_day not between 0 and 6 or coalesce(v_slot->>'start_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$' then raise exception 'יום או שעה אינם תקינים'; end if;
  v_start:=(v_slot->>'start_time')::time;
  v_end:=coalesce(nullif(v_slot->>'end_time','')::time,v_start+make_interval(mins=>case when p_lesson_type='individual_60' then 60 when p_lesson_type in ('orchestra','choir') then 90 else 45 end));
  if v_end<=v_start then raise exception 'שעת הסיום צריכה להיות אחרי ההתחלה'; end if;
  if exists(select 1 from public.group_schedules s join public.groups g on g.id=s.group_id
    where g.teacher_id=p_teacher_id and s.day_of_week=v_day and s.start_time::time<v_end
    and coalesce(nullif(s.end_time,'')::time,s.start_time::time+make_interval(mins=>case when g.lesson_type='individual_60' then 60 when g.lesson_type in ('orchestra','choir') then 90 else 45 end))>v_start)
   then raise exception 'השעות חופפות לשיעור קיים'; end if;
  insert into public.group_schedules(group_id,day_of_week,start_time,end_time)
  values(v_group,v_day,v_start::text,v_end::text);
 end loop;
 for v_student in select value from jsonb_array_elements(p_students) loop
  perform public.add_student_atomic(p_actor_id,v_group,v_student->>'name',v_student->>'instrument',v_student->>'parent_phone');
 end loop;
 return v_group;
end $$;
revoke all on function public.create_group_atomic(uuid,uuid,text,text,jsonb,jsonb,boolean,text,text,int) from public,anon,authenticated;
grant execute on function public.create_group_atomic(uuid,uuid,text,text,jsonb,jsonb,boolean,text,text,int) to service_role;
