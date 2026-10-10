import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

const db = new PGlite()
const actor = '00000000-0000-0000-0000-000000000001'
const group = '00000000-0000-0000-0000-000000000002'
const schedule = '00000000-0000-0000-0000-000000000003'
const student = '00000000-0000-0000-0000-000000000004'
const lesson = '00000000-0000-0000-0000-000000000005'

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema app_private;
    create table public.teachers(id uuid primary key, role text not null);
    create table public.groups(id uuid primary key, teacher_id uuid, name text, lesson_type text not null, created_at timestamptz default '2026-07-01');
    create table public.group_schedules(id uuid primary key, group_id uuid, day_of_week int, start_time text, end_time text);
    create table public.school_events(id uuid primary key default gen_random_uuid(), event_type text, name text, start_date date, end_date date);
    create table public.lessons(id uuid primary key default gen_random_uuid(), group_id uuid, date date, start_time text,
      is_makeup boolean default false, status text default 'scheduled', is_holiday boolean default false, holiday_name text,
      teacher_absence_reason text, admin_approval_status text, makeup_lesson_id uuid, created_at text default '2026-10-07',
      unique(group_id,date,start_time));
    create table public.students(id uuid primary key,group_id uuid,name text,is_active boolean default true,created_at timestamptz default '2026-07-01');
    create table public.attendance(id uuid default gen_random_uuid(),lesson_id uuid,student_id uuid,status text,brought_instrument boolean,unique(lesson_id,student_id));
  `)
  await db.exec(await readFile('supabase/migrations/20261007121945_payroll_lesson_snapshots.sql', 'utf8'))
  await db.exec(await readFile('supabase/migrations/20261009072208_preserve_past_schedule_occurrences.sql', 'utf8'))
  await db.exec(await readFile('supabase/migrations/20261009113000_prevent_and_hide_schedule_duplicates.sql', 'utf8'))
  await db.exec(await readFile('supabase/migrations/20261010191935_preserve_lessons_when_students_leave.sql', 'utf8'))
  await db.exec(`
    insert into public.teachers values ('be8d46a4-1298-4c4e-9900-11b9fe7349ed','teacher');
    insert into public.groups(id,teacher_id,name,lesson_type,created_at) values
      ('a5e630fc-832c-4ff4-b230-1153fad678c1','be8d46a4-1298-4c4e-9900-11b9fe7349ed','פרטני 45 דקות - איתי-משה מיימרן','individual_45','2026-09-06'),
      ('1f45f9fd-e380-4c8e-8763-c6b4ee4ef608','be8d46a4-1298-4c4e-9900-11b9fe7349ed','נתנאל יחיא','individual_60','2026-09-16');
    insert into public.group_schedules(id,group_id,day_of_week,start_time,end_time) values
      ('fa97bac6-7210-49a9-8a5a-49951e75ac2a','a5e630fc-832c-4ff4-b230-1153fad678c1',1,'17:00','17:45'),
      ('0079d1f6-0607-4036-8c59-ead641e0a834','1f45f9fd-e380-4c8e-8763-c6b4ee4ef608',4,'18:30','19:15');
    insert into public.students(id,group_id,name,is_active,created_at) values
      ('d0fc1a29-96f5-4fbd-a7d1-0983b2565f22','a5e630fc-832c-4ff4-b230-1153fad678c1','איתי-משה מיימרן',true,'2026-09-06'),
      ('493b2f3f-40ab-46c5-a684-02ef4fbc448e','1f45f9fd-e380-4c8e-8763-c6b4ee4ef608','נועה ביטון',true,'2026-09-16');
    insert into public.lessons(id,group_id,date,start_time) values
      ('47ee6d4d-96b9-49fc-9de8-14d25f99e90e','a5e630fc-832c-4ff4-b230-1153fad678c1','2026-09-07','17:00'),
      ('6557970c-06dc-4709-a7f5-10c62bcc93dd','1f45f9fd-e380-4c8e-8763-c6b4ee4ef608','2026-09-17','18:30');
  `)
  await db.exec(await readFile('supabase/migrations/20261010195025_correct_remaining_duplicate_and_noa_duration.sql', 'utf8'))
  await db.exec(`
    insert into public.teachers values ('${actor}','admin');
    insert into public.groups values ('${group}','${actor}','פסנתר','individual_45');
    insert into public.group_schedules values ('${schedule}','${group}',2,'10:00','10:45');
    insert into public.students values ('${student}','${group}','תלמיד קיים');
    insert into public.lessons(id,group_id,date,start_time) values ('${lesson}','${group}','2026-09-01','10:00');
    insert into public.attendance(lesson_id,student_id,status) values ('${lesson}','${student}','present');
  `)
}, 30000)

afterAll(async () => { await db.close() })

describe('schedule history migration', () => {
  test('hides the remaining duplicate and corrects Noa to 45 minutes', async () => {
    const { rows: duplicate } = await db.query<{ is_holiday: boolean; holiday_name: string }>(
      `select is_holiday,holiday_name from public.lessons where id='47ee6d4d-96b9-49fc-9de8-14d25f99e90e'`
    )
    expect(duplicate[0]).toMatchObject({ is_holiday: true, holiday_name: 'רשומה כפולה משינוי שיבוץ' })

    const { rows: noaGroup } = await db.query<{ lesson_type: string }>(
      `select lesson_type from public.groups where id='1f45f9fd-e380-4c8e-8763-c6b4ee4ef608'`
    )
    expect(noaGroup[0].lesson_type).toBe('individual_45')

    const { rows: noaLesson } = await db.query<{ payroll_lesson_type: string }>(
      `select payroll_lesson_type from public.lessons where id='6557970c-06dc-4709-a7f5-10c62bcc93dd'`
    )
    expect(noaLesson[0].payroll_lesson_type).toBe('individual_45')
  })

  test('materializes the old recurring slot before moving it and preserves attendance', async () => {
    await db.exec(`select public.update_group_schedule_atomic(
      '${actor}','${group}','${actor}','${schedule}','פסנתר','individual_45',3,'11:00','11:45'
    )`)

    const { rows: schedules } = await db.query<{ day_of_week: number; start_time: string }>(
      `select day_of_week,start_time from public.group_schedules where id='${schedule}'`
    )
    expect(schedules[0]).toMatchObject({ day_of_week: 3, start_time: '11:00' })

    const { rows: oldLessons } = await db.query<{ date: string; start_time: string }>(
      `select date::text,start_time from public.lessons where group_id='${group}' and date<='2026-10-09' order by date`
    )
    expect(oldLessons).toContainEqual({ date: '2026-09-01', start_time: '10:00' })
    expect(oldLessons).toContainEqual({ date: '2026-09-08', start_time: '10:00' })
    expect(oldLessons.some(row => row.start_time.startsWith('11:00'))).toBe(false)

    const { rows: attendance } = await db.query<{ count: string }>('select count(*)::text as count from public.attendance')
    expect(attendance[0].count).toBe('1')
  })

  test('does not recreate an individual lesson already recorded under another group', async () => {
    const sourceGroup = '00000000-0000-0000-0000-000000000011'
    const sourceSchedule = '00000000-0000-0000-0000-000000000012'
    const oldGroup = '00000000-0000-0000-0000-000000000013'
    await db.exec(`
      insert into public.groups values ('${sourceGroup}','${actor}','פרטני 45 דקות','individual_45');
      insert into public.groups values ('${oldGroup}','${actor}','פרטני 45 דקות - נגן','individual_45');
      insert into public.group_schedules values ('${sourceSchedule}','${sourceGroup}',2,'14:45','15:30');
      insert into public.students values ('00000000-0000-0000-0000-000000000014','${sourceGroup}','נגן');
      insert into public.students values ('00000000-0000-0000-0000-000000000015','${oldGroup}','נגן (היסטורי a123)');
      insert into public.lessons(group_id,date,start_time) values ('${oldGroup}','2026-09-01','14:45');
    `)

    await db.exec(`select public.update_group_schedule_atomic(
      '${actor}','${sourceGroup}','${actor}','${sourceSchedule}','פרטני 45 דקות','individual_45',3,'15:30','16:15'
    )`)

    const { rows } = await db.query<{ count: string }>(`
      select count(*)::text as count from public.lessons
      where group_id='${sourceGroup}' and date='2026-09-01'
    `)
    expect(rows[0].count).toBe('0')
  })

  test('keeps a legitimate historical slot even when another lesson overlaps', async () => {
    const sourceGroup = '00000000-0000-0000-0000-000000000021'
    const sourceSchedule = '00000000-0000-0000-0000-000000000022'
    const occupiedGroup = '00000000-0000-0000-0000-000000000023'
    await db.exec(`
      insert into public.groups values ('${sourceGroup}','${actor}','תלמיד חדש','individual_45');
      insert into public.groups values ('${occupiedGroup}','${actor}','תלמיד אחר','individual_45');
      insert into public.group_schedules values ('${sourceSchedule}','${sourceGroup}',2,'18:30','19:15');
      insert into public.students values ('00000000-0000-0000-0000-000000000024','${sourceGroup}','תלמיד חדש');
      insert into public.students values ('00000000-0000-0000-0000-000000000025','${occupiedGroup}','תלמיד אחר');
      insert into public.lessons(group_id,date,start_time) values ('${occupiedGroup}','2026-09-01','18:30');
    `)

    await db.exec(`select public.update_group_schedule_atomic(
      '${actor}','${sourceGroup}','${actor}','${sourceSchedule}','תלמיד חדש','individual_45',3,'19:15','20:00'
    )`)

    const { rows } = await db.query<{ count: string }>(`
      select count(*)::text as count from public.lessons
      where group_id='${sourceGroup}' and date='2026-09-01'
    `)
    expect(rows[0].count).toBe('1')
  })

  test('freezes recurring history before archiving a pupil', async () => {
    const retiredGroup = '00000000-0000-0000-0000-000000000031'
    const retiredStudent = '00000000-0000-0000-0000-000000000032'
    await db.exec(`
      insert into public.groups(id,teacher_id,name,lesson_type,created_at)
      values ('${retiredGroup}','${actor}','תלמיד שפרש','individual_45','2026-09-01');
      insert into public.group_schedules values
      ('00000000-0000-0000-0000-000000000033','${retiredGroup}',4,'12:00','12:45');
      insert into public.students(id,group_id,name,is_active,created_at)
      values ('${retiredStudent}','${retiredGroup}','תלמיד שפרש',true,'2026-09-01');
      select public.retire_student_atomic('${actor}','${retiredStudent}');
    `)

    const { rows: retired } = await db.query<{ is_active: boolean }>(
      `select is_active from public.students where id='${retiredStudent}'`
    )
    expect(retired[0].is_active).toBe(false)

    const { rows: occurrences } = await db.query<{ count: string }>(`
      select count(*)::text as count from public.lessons
      where group_id='${retiredGroup}' and date='2026-09-03' and start_time='12:00'
    `)
    expect(occurrences[0].count).toBe('1')
  })
})
