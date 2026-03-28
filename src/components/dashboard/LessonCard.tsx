import Link from 'next/link'
import type { LessonSlot } from '@/types/database'

interface Props {
  slot: LessonSlot
  isNext?: boolean
}

export default function LessonCard({ slot, isNext }: Props) {
  const timeStr = slot.startTime

  return (
    <div className={`bg-white rounded-xl p-3 border flex items-center gap-3 transition-all ${
      isNext ? 'border-indigo-400 shadow-sm shadow-indigo-100' : 'border-gray-100'
    }`}>
      {/* Time column */}
      <div className="text-center min-w-[44px]">
        <span className="text-sm font-bold text-indigo-600">{timeStr}</span>
      </div>

      {/* Divider */}
      <div className="w-px h-9 bg-gray-100" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{slot.groupName}</p>
        <div className="flex flex-wrap gap-1 mt-0.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            slot.lessonType === 'group'
              ? 'bg-violet-100 text-violet-700'
              : 'bg-pink-100 text-pink-700'
          }`}>
            {slot.lessonType === 'group' ? 'קבוצה' : 'יחיד'}
          </span>
          {slot.isMangan && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              מנגן
            </span>
          )}
        </div>
        {slot.isMangan && slot.schoolName && (
          <p className="text-[10px] text-amber-600 mt-0.5 truncate">
            🏫 {slot.schoolName}{slot.grade ? ` — כיתה ${slot.grade}` : ''}
          </p>
        )}
      </div>

      {/* Attendance button */}
      <Link
        href={`/groups/${slot.groupId}/attendance`}
        className="shrink-0 bg-indigo-600 text-white text-[11px] font-bold px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
      >
        ✓ נוכחות
      </Link>
    </div>
  )
}
