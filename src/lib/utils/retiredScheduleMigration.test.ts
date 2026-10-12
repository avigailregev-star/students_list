import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

const db = new PGlite()
const admin = '00000000-0000-0000-0000-000000000001'
const teacher = '00000000-0000-0000-0000-000000000002'

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.teachers(id uuid primary key, role text not null);
    create table public.groups(id uuid primary key, teacher_id uuid, name text, lesson_type text not null, created_at timestamptz default '2026-09-01');
    create table public.group_schedules(id uuid primary key, group_id uuid, day_of_week int, start_time text, end_time text);
    create table public.school_events(id uuid primary key default gen_random_uuid(), event_type text, name text, start_date date, end_date date);
    create table public.lessons(id uuid primary key default gen_random_uuid(), group_id uuid, date date, start_time text,
      is_makeup boolean default false, is_holiday boolean default false, holiday_name text,
      unique(group_id,date,start_time));
    create table public.students(id uuid primary key,group_id uuid,name text,is_active boolean default true);
    insert into public.teachers values ('${admin}','admin'),('${teacher}','teacher');
  `)
  await db.exec(await readFile('supabase/migrations/20261012154000_allow_reusing_retired_individual_slots.sql', 'utf8'))
}, 30000)

afterAll(async () => { await db.close() })

describe('retired recurring schedule handling', () => {
  test('allows an active private pupil to reuse a retired private pupil slot', async () => {
    const activeGroup = '00000000-0000-0000-0000-000000000011'
    const activeSchedule = '00000000-0000-0000-0000-000000000012'
    const retiredGroup = '00000000-0000-0000-0000-000000000013'
    await db.exec(`
      insert into public.groups values
        ('${activeGroup}','${teacher}','מיכאל','individual_45','2026-09-01'),
        ('${retiredGroup}','${teacher}','תלמיד לא פעיל','individual_45','2026-09-01');
      insert into public.group_schedules values
        ('${activeSchedule}','${activeGroup}',0,'19:15',null),
        ('00000000-0000-0000-0000-000000000014','${retiredGroup}',4,'15:30',null);
      insert into public.students values
        ('00000000-0000-0000-0000-000000000015','${activeGroup}','מיכאל',true),
        ('00000000-0000-0000-0000-000000000016','${retiredGroup}','תלמיד לא פעיל',false);
      select public.update_group_schedule_atomic(
        '${admin}','${activeGroup}','${teacher}','${activeSchedule}','מיכאל','individual_45',4,'15:30',null
      );
    `)

    const { rows } = await db.query<{ day_of_week: number; start_time: string }>(
      `select day_of_week,start_time from public.group_schedules where id='${activeSchedule}'`
    )
    expect(rows[0]).toMatchObject({ day_of_week: 4, start_time: '15:30' })
  })

  test('still rejects a collision with an active private pupil', async () => {
    const movingGroup = '00000000-0000-0000-0000-000000000021'
    const movingSchedule = '00000000-0000-0000-0000-000000000022'
    const occupiedGroup = '00000000-0000-0000-0000-000000000023'
    await db.exec(`
      insert into public.groups values
        ('${movingGroup}','${teacher}','עובר','individual_45','2026-09-01'),
        ('${occupiedGroup}','${teacher}','פעיל','individual_45','2026-09-01');
      insert into public.group_schedules values
        ('${movingSchedule}','${movingGroup}',1,'10:00',null),
        ('00000000-0000-0000-0000-000000000024','${occupiedGroup}',3,'16:00',null);
      insert into public.students values
        ('00000000-0000-0000-0000-000000000025','${movingGroup}','עובר',true),
        ('00000000-0000-0000-0000-000000000026','${occupiedGroup}','פעיל',true);
    `)

    await expect(db.exec(`select public.update_group_schedule_atomic(
      '${admin}','${movingGroup}','${teacher}','${movingSchedule}','עובר','individual_45',3,'16:15',null
    )`)).rejects.toThrow('השעות חופפות לשיעור קיים')
  })

  test('does not duplicate a historical occurrence whose time includes seconds', async () => {
    const movingGroup = '00000000-0000-0000-0000-000000000031'
    const movingSchedule = '00000000-0000-0000-0000-000000000032'
    await db.exec(`
      insert into public.groups values ('${movingGroup}','${teacher}','שמירת היסטוריה','individual_45','2026-09-01');
      insert into public.group_schedules values ('${movingSchedule}','${movingGroup}',0,'19:15',null);
      insert into public.students values ('00000000-0000-0000-0000-000000000033','${movingGroup}','שמירת היסטוריה',true);
      insert into public.lessons(group_id,date,start_time) values ('${movingGroup}','2026-10-04','19:15:00');
      select public.update_group_schedule_atomic(
        '${admin}','${movingGroup}','${teacher}','${movingSchedule}','שמירת היסטוריה','individual_45',2,'17:00',null
      );
    `)

    const { rows } = await db.query<{ count: string }>(`
      select count(*)::text as count from public.lessons
      where group_id='${movingGroup}' and date='2026-10-04' and start_time::time=time '19:15'
    `)
    expect(rows[0].count).toBe('1')
  })
})
