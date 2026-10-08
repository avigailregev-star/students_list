import { expect, test, vi } from 'vitest'
import { createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as XLSX from 'xlsx'
import { buildMonthWorksheet } from './worksheet'
import { emptyMonth } from './calculate'
import PayrollView from '@/app/reports/payroll/PayrollView'
import ExportButtons from '@/app/reports/ExportButtons'

const state = vi.hoisted(() => ({ books: [] as unknown[] }))
vi.mock('xlsx', async importOriginal => ({ ...await importOriginal<typeof import('xlsx')>(), writeFile: (book: unknown) => state.books.push(book) }))
function click(node: ReactNode, label: string): boolean {
  if (Array.isArray(node)) return node.some(child => click(child, label))
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return false
  if (node.type === 'button' && renderToStaticMarkup(node).includes(label)) { node.props.onClick!(); return true }
  return click(node.props.children, label)
}
function sample() {
  const month = emptyMonth('2026-09')
  month.dayCounts[10].individual_45 = 2
  month.dayCounts[10].ensemble = 2
  month.dayCounts[10].makeup = 1
  month.dayCounts[10].extra_hours = 0.75
  month.dayCounts[11].extra_hours = 1.5
  month.makeupTypes[10] = { individual_45: 1 }; month.makeupDates = [10]
  month.sickDates = [10, 11, 12]; month.sickDays = 3; month.sickUnpaid = 1; month.sickHalf = 2
  for (const day of month.sickDates) month.sickLeaveDetails[day] = [{ startTime: '14:00', lessonType: 'individual_60' }]
  return month
}
test('worksheet has correct daily/monthly totals, clock hours, workdays and sick days', () => {
  const sheet = buildMonthWorksheet(sample(), 'בדיקה')
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 })
  expect(rows.find(row => row[0] === 10)).toEqual([10, "ה' — מחלה", 2, '', '', 2, '', '', "1 (פ45')", '0:45', 5])
  expect(rows.find(row => row[0] === 'סה"כ')).toEqual(['סה"כ', '', 2, '', '', 2, '', '', 1, '2:15', 5])
  expect(rows.some(row => row[0] === 'סך ימי עבודה: 2')).toBe(true)
  expect(rows.some(row => row[0] === 'ימי מחלה: 3')).toBe(true)
  expect(rows[6][9]).toBe('שעות')
})
test('screen/print renders the same totals and counts an extra-hours-only workday', () => {
  const html = renderToStaticMarkup(createElement(PayrollView, { months: [sample()], teacherName: 'בדיקה' }))
  expect(html).toContain('2:15'); expect(html).toContain('סך ימי עבודה: 2')
  expect(html).toContain('ימי מחלה: 3'); expect(html).toContain('סה&quot;כ שיעורים')
})

test('partial sickness highlights only the detail row and full sickness highlights the day', () => {
  const html = renderToStaticMarkup(createElement(PayrollView, { months: [sample()], teacherName: 'בדיקה' }))
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)!
  for (const day of [10, 11]) {
    const index = rows.findIndex(row => new RegExp(`<td[^>]*>${day}</td>`).test(row))
    expect(rows[index]).not.toContain('bg-red-50')
    expect(rows[index]).toContain('מחלה')
    expect(rows[index + 1]).toContain('פירוט מחלה מאושרת:')
    expect(rows[index + 1]).toContain('14:00 — פרטני 60 דק׳')
  }
  expect(rows.find(row => /<td[^>]*>12<\/td>/.test(row))).toContain('bg-red-50')
  expect(html).not.toMatch(/>ח<\/span>/)
})
test('both real export buttons produce identical worksheets and retain values after XLSX serialization', () => {
  state.books = []
  expect(click(ExportButtons({ reportData: [], month: '2026-09', teacherName: 'בדיקה', payrollMonths: [sample()] }), 'דוח שעות')).toBe(true)
  expect(click(PayrollView({ months: [sample()], teacherName: 'בדיקה' }), 'ייצוא')).toBe(true)
  const books = state.books as XLSX.WorkBook[]
  expect(books).toHaveLength(2)
  expect(books[0].Sheets[books[0].SheetNames[0]]).toEqual(books[1].Sheets[books[1].SheetNames[0]])
  const roundtrip = XLSX.read(XLSX.write(books[0], { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(roundtrip.Sheets[roundtrip.SheetNames[0]], { header: 1 })
  expect(rows.find(row => row[0] === 'סה"כ')?.slice(8)).toEqual([1, '2:15', 5])
  const dayIndex = rows.findIndex(row => row[0] === 10)
  expect(rows[dayIndex][1]).toBe("ה' — מחלה")
  expect(rows[dayIndex + 1][2]).toBe('פירוט מחלה מאושרת: 14:00 — פרטני 60 דק׳')
  expect(roundtrip.Sheets[roundtrip.SheetNames[0]]['!merges']).toContainEqual({ s: { r: dayIndex + 1, c: 2 }, e: { r: dayIndex + 1, c: 10 } })
})
test('empty selected month exports zero values rather than values from a different month', () => {
  state.books = []
  click(ExportButtons({ reportData: [], month: '2026-10', teacherName: 'בדיקה', payrollMonths: [sample()] }), 'דוח שעות')
  const book = state.books[0] as XLSX.WorkBook
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(book.Sheets[book.SheetNames[0]], { header: 1 })
  expect(rows.find(row => row[0] === 'סה"כ')?.slice(2).every(v => v === '')).toBe(true)
})

test('unverified historical baseline is disclosed on screen and in Excel without changing totals', () => {
  const month = sample()
  month.unverifiedLessons = 3
  expect(renderToStaticMarkup(createElement(PayrollView, { months: [month], teacherName: 'בדיקה' }))).toContain('טרם אומתו')
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(buildMonthWorksheet(month, 'בדיקה'), { header: 1 })
  expect(rows.some(row => String(row[0]).includes('טרם אומתו: 3'))).toBe(true)
  expect(rows.find(row => row[0] === 'סה"כ')?.slice(8)).toEqual([1, '2:15', 5])
})
