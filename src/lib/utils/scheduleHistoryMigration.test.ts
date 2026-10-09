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
    create table public.groups(id uuid primary key, teacher_id uuid, name text, lesson_type text not null);
    create table public.group_schedules(id uuid primary key, group_id uuid, day_of_week int, start_time text, end_time text);
    create table public.school_events(id uuid primary key default gen_random_uuid(), event_type text, name text, start_date date, end_date date);
    create table public.lessons(id uuid primary key default gen_random_uuid(), group_id uuid, date date, start_time text,
      is_makeup boolean default false, status text default 'scheduled', is_holiday boolean default false, holiday_name text,
      teacher_absence_reason text, admin_approval_status text, makeup_lesson_id uuid, created_at text default '2026-10-07',
      unique(group_id,date,start_time));
    create table public.students(id uuid primary key,group_id uuid,name text);
    create table public.attendance(id uuid default gen_random_uuid(),lesson_id uuid,student_id uuid,status text,brought_instrument boolean,unique(lesson_id,student_id));
  `)
  await db.exec(await readFile('supabase/migrations/20261007121945_payroll_lesson_snapshots.sql', 'utf8'))
  await db.exec(await readFile('supabase/migrations/20261009072208_preserve_past_schedule_occurrences.sql', 'utf8'))
  await db.exec(await readFile('supabase/migrations/20261009113000_prevent_and_hide_schedule_duplicates.sql', 'utf8'))
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
})
