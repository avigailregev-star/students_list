import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { calculatePayroll, type PayrollLesson } from './calculate'

// Real, isolated PostgreSQL engine; no environment files or remote connections.
const db = new PGlite()
const g45 = '00000000-0000-0000-0000-000000000045'
const gOrchestra = '00000000-0000-0000-0000-000000000090'
const original = '00000000-0000-0000-0000-000000000001'
const orchestra = '00000000-0000-0000-0000-000000000002'
const makeup = '00000000-0000-0000-0000-000000000003'

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema app_private;
    create table public.groups(id uuid primary key, lesson_type text not null, teacher_id uuid);
    create table public.group_schedules(id uuid primary key default gen_random_uuid(), group_id uuid, day_of_week int, start_time text, end_time text);
    create table public.lessons(id uuid primary key default gen_random_uuid(), group_id uuid, date date, start_time text,
      is_makeup boolean default false, status text default 'scheduled', is_holiday boolean default false,
      teacher_absence_reason text, admin_approval_status text, makeup_lesson_id uuid, created_at text default '2026-10-07',
      unique(group_id,date,start_time));
    create table public.students(id uuid primary key,group_id uuid);
    create table public.attendance(id uuid default gen_random_uuid(),lesson_id uuid,student_id uuid,status text,brought_instrument boolean,unique(lesson_id,student_id));
  `)
  // Exercise the migration on existing history, as in Dimona.
  await db.exec(`
    insert into public.groups(id,lesson_type) values ('00000000-0000-0000-0000-000000000099','orchestra');
    insert into public.group_schedules(group_id,day_of_week,start_time,end_time)
      values ('00000000-0000-0000-0000-000000000099',2,'10:00','11:30');
    insert into public.lessons(id,group_id,date,start_time,status)
      values ('00000000-0000-0000-0000-000000000098','00000000-0000-0000-0000-000000000099','2026-08-04','10:00','completed');
  `)
  await db.exec(await readFile('supabase/migrations/20261007121945_payroll_lesson_snapshots.sql', 'utf8'))
  await db.exec(`
    insert into public.groups(id,lesson_type) values ('${g45}','individual_45'), ('${gOrchestra}','orchestra');
    insert into public.group_schedules(group_id,day_of_week,start_time,end_time) values
      ('${g45}',2,'16:00','16:45'), ('${gOrchestra}',2,'16:00','17:30');
    insert into public.lessons(id,group_id,date,start_time) values
      ('${original}','${g45}','2026-09-01','16:00'), ('${orchestra}','${gOrchestra}','2026-09-01','16:00');
    update public.groups set lesson_type='individual_60' where id='${g45}';
    update public.group_schedules set end_time='16:45', day_of_week=3 where group_id='${gOrchestra}';
    insert into public.lessons(id,group_id,date,start_time,is_makeup,payroll_source_lesson_id)
      values ('${makeup}','${gOrchestra}','2026-10-01','10:00',true,'${orchestra}');
  `)
}, 30000)
afterAll(async () => { await db.close() })

describe('Dimona existing-history compatibility', () => {
  it('preserves existing values, marks them unverified and freezes them against future changes', async () => {
    await db.exec("update public.group_schedules set end_time='10:45' where group_id='00000000-0000-0000-0000-000000000099'")
    const { rows } = await db.query<{ payroll_units: string; payroll_snapshot_origin: string; status: string }>("select payroll_units,payroll_snapshot_origin,status from public.lessons where id='00000000-0000-0000-0000-000000000098'")
    expect(Number(rows[0].payroll_units)).toBe(2)
    expect(rows[0].payroll_snapshot_origin).toBe('legacy_baseline')
    expect(rows[0].status).toBe('completed')
  })
  it('a new makeup of a legacy original inherits frozen units and the review marker', async () => {
    const { rows } = await db.query<{ payroll_units: string; payroll_snapshot_origin: string }>(`insert into public.lessons(group_id,date,start_time,is_makeup,payroll_source_lesson_id)
      values ('00000000-0000-0000-0000-000000000099','2026-10-06','19:00',true,'00000000-0000-0000-0000-000000000098') returning payroll_units,payroll_snapshot_origin`)
    expect(Number(rows[0].payroll_units)).toBe(2)
    expect(rows[0].payroll_snapshot_origin).toBe('legacy_baseline')
  })
  it('frozen identities protect two historical slots after the schedule is reduced to one', async () => {
    const g = '00000000-0000-0000-0000-000000000070', teacher = '00000000-0000-0000-0000-000000000071', student = '00000000-0000-0000-0000-000000000072'
    const a = '00000000-0000-0000-0000-000000000073', b = '00000000-0000-0000-0000-000000000074'
    await db.exec(`insert into public.groups values ('${g}','individual_45','${teacher}');
      insert into public.students values ('${student}','${g}');
      insert into public.group_schedules(group_id,day_of_week,start_time,end_time) values ('${g}',2,'10:00','10:45'),('${g}',2,'11:00','11:45');
      insert into public.lessons(id,group_id,date,start_time) values ('${a}','${g}','2026-09-01','10:00'),('${b}','${g}','2026-09-01','11:00');
      insert into public.attendance(lesson_id,student_id,status) values ('${a}','${student}','present'),('${b}','${student}','present');
      delete from public.group_schedules where group_id='${g}' and start_time='11:00';
      select public.save_attendance_atomic('${teacher}','${a}','${student}','late',false);`)
    const { rows } = await db.query<{ lesson_id: string }>(`select lesson_id from public.attendance where student_id='${student}'`)
    expect(rows.map(row => row.lesson_id).sort()).toEqual([a,b])
  })
  it('snapshot metadata cannot be forged to mark old data verified', async () => {
    await expect(db.exec("update public.lessons set payroll_snapshot_origin='captured' where id='00000000-0000-0000-0000-000000000098'")).rejects.toThrow()
  })
})

describe('אמינות דוח שעות — היסטוריה במסד PostgreSQL מקומי', () => {
  it('שינוי 45 ל-60 ושינוי משך תזמורת אינם משנים את דוח העבר', async () => {
    // PostgREST returns JSON dates/numbers; use PostgreSQL's JSON conversion too.
    const { rows } = await db.query<{ lesson: PayrollLesson }>('select to_jsonb(l) as lesson from public.lessons l order by id')
    const months = calculatePayroll({ groups: [
      { id: g45, lesson_type: 'individual_60', group_schedules: [] },
      { id: gOrchestra, lesson_type: 'orchestra', group_schedules: [{ day_of_week: 3, start_time: '16:00', end_time: '16:45' }] },
    ], lessons: rows.map(row => row.lesson), attendanceIds: new Set([original, orchestra, makeup]), extraHours: [], today: '2026-10-31' })
    expect(months[1].dayCounts[1].individual_45).toBe(1)
    expect(months[1].dayCounts[1].individual_60).toBe(0)
    expect(months[1].dayCounts[1].ensemble).toBe(2)
    expect(months[0].dayCounts[1].makeup).toBe(2)
  })
  it('אי אפשר לערוך יחידות או סוג שכר שנשמרו', async () => {
    await expect(db.exec(`update public.lessons set payroll_units=9 where id='${original}'`)).rejects.toThrow('היסטוריה')
    await expect(db.exec(`update public.lessons set payroll_lesson_type='individual_60' where id='${original}'`)).rejects.toThrow('היסטוריה')
  })
  it('ביטול ושחזור משנים סטטוס בלי למחוק יחידות היסטוריות', async () => {
    await db.exec(`update public.lessons set status='teacher_canceled' where id='${orchestra}'`)
    await db.exec(`update public.lessons set status='scheduled' where id='${orchestra}'`)
    const { rows } = await db.query<{ payroll_units: number }>(`select payroll_units from public.lessons where id='${orchestra}'`)
    expect(Number(rows[0].payroll_units)).toBe(2)
  })
  it('השלמה אינה יכולה להעתיק סוג שכר מקבוצה אחרת', async () => {
    await expect(db.exec(`insert into public.lessons(group_id,date,start_time,is_makeup,payroll_source_lesson_id)
      values ('${g45}','2026-10-02','11:00',true,'${orchestra}')`)).rejects.toThrow('מקור ההשלמה')
  })
  it('שיעורים חדשים משתמשים בסוג המעודכן', async () => {
    const { rows } = await db.query<{ payroll_lesson_type: string }>(`insert into public.lessons(group_id,date,start_time)
      values ('${g45}','2026-10-06','16:00') returning payroll_lesson_type`)
    expect(rows[0].payroll_lesson_type).toBe('individual_60')
  })
  it('נתוני שכר מזויפים בהוספה מוחלפים בנתוני המערכת', async () => {
    const { rows } = await db.query<{ payroll_units: number }>(`insert into public.lessons(group_id,date,start_time,payroll_units)
      values ('${g45}','2026-10-13','16:00',99) returning payroll_units`)
    expect(Number(rows[0].payroll_units)).toBe(1)
  })
  it('שמירת פרטי השכר פועלת גם בכתיבה מורשית של מורה ללא הרשאות לפונקציה הפרטית', async () => {
    await db.exec('grant usage on schema public to authenticated; grant select on public.groups,public.group_schedules,public.lessons to authenticated; grant insert on public.lessons to authenticated;')
    try {
      await db.exec('set role authenticated')
      const { rows } = await db.query<{ payroll_units: string }>(`insert into public.lessons(group_id,date,start_time)
        values ('${g45}','2026-10-20','16:00') returning payroll_units`)
      expect(Number(rows[0].payroll_units)).toBe(1)
    } finally { await db.exec('reset role') }
  })
})
