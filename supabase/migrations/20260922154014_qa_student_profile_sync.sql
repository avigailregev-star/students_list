create or replace function public.update_student_profile_atomic(
 p_actor_id uuid,p_student_id uuid,p_name text,p_instrument text,p_parent_phone text
) returns void language plpgsql security invoker set search_path='' as $$
declare v_student public.students%rowtype; v_registration uuid; v_ids uuid[];
begin
 select s.* into v_student from public.students s join public.groups g on g.id=s.group_id
 where s.id=p_student_id and (g.teacher_id=p_actor_id or exists(select 1 from public.teachers where id=p_actor_id and role='admin')) for update of s;
 if not found then raise exception 'תלמיד לא נמצא' using errcode='42501'; end if;
 if nullif(btrim(p_name),'') is null then raise exception 'שם התלמיד נדרש'; end if;
 if v_student.registration_id is not null then
  select id into v_registration from public.registrations where id=v_student.registration_id and group_id=v_student.group_id for update;
  if not found then raise exception 'קישור הרישום אינו תואם לקבוצה. יש לפנות למנהלת'; end if;
 else
  select array_agg(id) into v_ids from public.registrations
  where group_id=v_student.group_id and
   ((v_student.student_id is not null and student_id=v_student.student_id) or
    (v_student.student_id is null and student_name=v_student.name));
  if cardinality(v_ids)>1 then raise exception 'נמצאו כמה רישומים מתאימים. יש לפנות למנהלת לבדיקת השיוך'; end if;
  v_registration:=v_ids[1];
  if v_registration is not null then
   if exists(select 1 from public.students where id<>p_student_id and group_id=v_student.group_id and name=v_student.name and v_student.student_id is null) then
    raise exception 'יש תלמידים בעלי אותו שם. יש לפנות למנהלת לבדיקת השיוך';
   end if;
   perform 1 from public.registrations where id=v_registration for update;
  end if;
 end if;
 if v_registration is not null then
  update public.registrations set student_name=btrim(p_name),parent_phone=coalesce(p_parent_phone,''),
   instruments=case when p_instrument is not distinct from v_student.instrument then instruments
    else array(select distinct i from unnest(array_remove(coalesce(instruments,'{}'::text[]),v_student.instrument)||case when nullif(btrim(p_instrument),'') is null then '{}'::text[] else array[btrim(p_instrument)] end) i) end,
   updated_at=now()
  where id=v_registration;
 end if;
 update public.students set name=btrim(p_name),instrument=nullif(btrim(p_instrument),''),parent_phone=nullif(btrim(p_parent_phone),''),
  registration_id=coalesce(registration_id,v_registration)
 where id=p_student_id;
end $$;
revoke all on function public.update_student_profile_atomic(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.update_student_profile_atomic(uuid,uuid,text,text,text) to service_role;
