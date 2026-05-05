import Link from 'next/link'
import type { LessonSlot } from '@/types/database'

interface Props {
  slot: LessonSlot
  isNext?: boolean
}

export default function LessonCard({ slot, isNext }: Props) {
  return (
    <Link
      href={`/groups/${slot.groupId}/attendance`}
      className={`bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm active:opacity-80 transition-opacity ${
        isNext ? 'ring-2 ring-teal-400' : ''
      }`}
    >
      {/* Avatar */}
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-base shrink-0 ${
        slot.lessonType === 'group' ? 'bg-teal-500' : 'bg-violet-500'
      }`}>
        {slot.groupName.charAt(0)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">{slot.groupName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400 font-medium">{slot.startTime}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            slot.lessonType === 'group'
              ? 'bg-teal-50 text-teal-600'
              : 'bg-violet-50 text-violet-600'
          }`}>
            {slot.lessonType === 'group' ? 'קבוצה' : 'יחיד'}
          </span>
          {slot.isMangan && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
              מנגן
            </span>
          )}
        </div>
        {slot.isMangan && slot.schoolName && (
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">
            {slot.schoolName}{slot.grade ? ` · כיתה ${slot.grade}` : ''}
          </p>
        )}
      </div>

      {/* Attendance indicator */}
      <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${
        isNext ? 'bg-teal-500' : 'bg-gray-100'
      }`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isNext ? 'white' : '#6b7280'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    </Link>
  )
}
