begin;

-- This occurrence was recreated on 9 October while freezing the current
-- schedule. The original 7 September lesson for the same teacher and time has
-- attendance; this later row has none and is the remaining duplicate shown in
-- the historical calendar. Keep it for audit, but exclude it from calendar and
-- payroll views in the same reversible way as the earlier cleanup.
update public.lessons lesson
set is_holiday = true,
    holiday_name = 'רשומה כפולה משינוי שיבוץ'
where lesson.id = '47ee6d4d-96b9-49fc-9de8-14d25f99e90e'::uuid
  and lesson.group_id = 'a5e630fc-832c-4ff4-b230-1153fad678c1'::uuid
  and lesson.date = date '2026-09-07'
  and lesson.start_time::time = time '17:00'
  and lesson.is_makeup = false
  and not exists (
    select 1 from public.attendance attendance_row
    where attendance_row.lesson_id = lesson.id
  )
  and exists (
    select 1
    from public.students student
    where student.group_id = lesson.group_id
      and student.name = 'איתי-משה מיימרן'
  );

-- These two 10 September occurrences were recreated on 9 October under the
-- pupils' replacement groups. Their original September occurrences already
-- contain the real attendance. They remain stored for audit, but must not be
-- counted or displayed a second time even though attendance was later added to
-- the recreated rows too.
update public.lessons lesson
set is_holiday = true,
    holiday_name = 'רשומה כפולה משינוי שיבוץ'
where lesson.id in (
    'e06b2324-38b5-4b01-91ab-5582b49035bb'::uuid,
    '61ac25c9-e53b-4a63-bf68-ac3f2aa08b12'::uuid
  )
  and lesson.date = date '2026-09-10'
  and lesson.is_makeup = false
  and lesson.created_at::timestamptz >= '2026-10-09T00:00:00+00'::timestamptz
  and exists (
    select 1
    from public.groups target_group
    join public.students target_student on target_student.group_id = target_group.id
    join public.groups original_group on original_group.teacher_id = target_group.teacher_id
    join public.students original_student on original_student.group_id = original_group.id
    join public.lessons original_lesson on original_lesson.group_id = original_group.id
    where target_group.id = lesson.group_id
      and original_group.id <> target_group.id
      and original_lesson.date = lesson.date
      and original_lesson.start_time::time = lesson.start_time::time
      and original_lesson.created_at::timestamptz < lesson.created_at::timestamptz
      and original_lesson.is_makeup = false
      and original_lesson.is_holiday = false
      and regexp_replace(lower(btrim(target_student.name)), '\s*\(היסטורי [^)]+\)\s*$', '')
          = regexp_replace(lower(btrim(original_student.name)), '\s*\(היסטורי [^)]+\)\s*$', '')
      and exists (
        select 1 from public.attendance original_attendance
        where original_attendance.lesson_id = original_lesson.id
      )
  );

-- Noa's active Thursday slot is 18:30-19:15 (45 minutes). Correct both the
-- live group type and already captured lesson snapshots so the calendar and
-- historical payroll report agree with the actual lesson duration.
update public.groups group_row
set lesson_type = 'individual_45',
    name = 'פרטני 45 דקות - נועה ביטון'
where group_row.id = '1f45f9fd-e380-4c8e-8763-c6b4ee4ef608'::uuid
  and group_row.teacher_id = 'be8d46a4-1298-4c4e-9900-11b9fe7349ed'::uuid
  and exists (
    select 1 from public.students student
    where student.group_id = group_row.id
      and student.name = 'נועה ביטון'
      and student.is_active = true
  )
  and exists (
    select 1 from public.group_schedules schedule
    where schedule.group_id = group_row.id
      and schedule.day_of_week = 4
      and schedule.start_time::time = time '18:30'
      and schedule.end_time::time = time '19:15'
  );

-- Payroll snapshots are normally immutable. This tightly scoped correction is
-- the audited exception for data that was captured with the wrong source type.
alter table public.lessons disable trigger capture_lesson_payroll;
update public.lessons lesson
set payroll_lesson_type = 'individual_45'
where lesson.group_id = '1f45f9fd-e380-4c8e-8763-c6b4ee4ef608'::uuid
  and lesson.payroll_lesson_type = 'individual_60'
  and exists (
    select 1 from public.groups group_row
    where group_row.id = lesson.group_id
      and group_row.lesson_type = 'individual_45'
  );
alter table public.lessons enable trigger capture_lesson_payroll;

commit;
