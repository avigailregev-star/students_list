import { expect, test } from 'vitest'
import { compareRoomNames } from './rooms'

test('numeric room names are sorted numerically before named rooms', () => {
  const names = ['אולם רסיטלים', '10', '2', '1', 'היכל הילד']

  expect(names.sort(compareRoomNames)).toEqual([
    '1',
    '2',
    '10',
    'אולם רסיטלים',
    'היכל הילד',
  ])
})

test('Hebrew room names are sorted alphabetically', () => {
  const names = ['תכל הילד', 'אולם', 'חדר מורים', 'בית ספר']

  expect(names.sort(compareRoomNames)).toEqual([
    'אולם',
    'בית ספר',
    'חדר מורים',
    'תכל הילד',
  ])
})
