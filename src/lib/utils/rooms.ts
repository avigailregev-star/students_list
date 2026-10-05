import type { Room } from '@/types/database'

const hebrewCollator = new Intl.Collator('he', {
  numeric: true,
  sensitivity: 'base',
})

function isNumericRoomName(name: string) {
  return /^\d+$/.test(name.trim())
}

export function compareRoomNames(a: string, b: string) {
  const aName = a.trim()
  const bName = b.trim()
  const aIsNumeric = isNumericRoomName(aName)
  const bIsNumeric = isNumericRoomName(bName)

  if (aIsNumeric && bIsNumeric) {
    const numberDifference = Number(aName) - Number(bName)
    if (numberDifference !== 0) return numberDifference
  }

  if (aIsNumeric !== bIsNumeric) return aIsNumeric ? -1 : 1

  return hebrewCollator.compare(aName, bName)
}

export function sortRooms(rooms: Room[]) {
  return [...rooms].sort((a, b) => compareRoomNames(a.name, b.name))
}
