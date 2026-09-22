import { expect, test } from 'vitest'
import { reconcileCalendarRecipients } from './calendarRecipients'

test('changing event teachers removes old recipients and adds new ones only once', () => {
  const old = { teacher_id: 'old', google_event_id: 'event1' }
  const kept = { teacher_id: 'kept', google_event_id: 'event2' }
  expect(reconcileCalendarRecipients(['kept', 'new', 'new'], [old, kept])).toEqual({ remove: [old], update: [kept], add: ['new'] })
})
test('unassigning everybody removes every existing calendar recipient', () => {
  const old = { teacher_id: 'old', google_event_id: 'event1' }
  expect(reconcileCalendarRecipients([], [old])).toEqual({ remove: [old], update: [], add: [] })
})
