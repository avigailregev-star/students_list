import Link from 'next/link'
import type { LessonSlot } from '@/types/database'
import { LESSON_TYPE_CONFIG } from '@/lib/utils/lessonTypes'

interface Props {
  slot: LessonSlot
  isNext?: boolean
  hideTime?: boolean
  viewOnly?: boolean
  viewOnlyHref?: string
}

export default function LessonCard({ slot, isNext, hideTime, viewOnly, viewOnlyHref }: Props) {
  const isMakeup = slot.isMakeup === true
  const lessonType = LESSON_TYPE_CONFIG[slot.lessonType]
  const isCollective = ['group', 'orchestra', 'choir', 'melodies_group'].includes(slot.lessonType)
  const displayName = !isCollective && slot.studentNames?.length
    ? slot.studentNames.join(', ')
    : slot.groupName

  const dateStr = `${slot.date.getFullYear()}-${String(slot.date.getMonth() + 1).padStart(2, '0')}-${String(slot.date.getDate()).padStart(2, '0')}`
  const href = isMakeup
    ? `/groups/${slot.groupId}/attendance?date=${dateStr}&time=${slot.startTime}`
    : `/groups/${slot.groupId}/attendance?date=${dateStr}`

  const avatarBg = isMakeup
    ? 'bg-purple-500'
    : lessonType.bg

  const ringClass = isNext
    ? (isMakeup ? 'ring-2 ring-purple-400' : 'ring-2 ring-teal-400')
    : ''

  const className = `bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm ${viewOnly ? '' : 'active:opacity-80 transition-opacity'} ${ringClass} ${isMakeup ? 'border border-purple-100' : ''}`

  const content = (
    <>
      {/* Avatar */}
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-base shrink-0 ${avatarBg}`}>
        {displayName.charAt(0)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate" title={displayName}>{displayName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {!hideTime && (
            <span className="text-xs text-gray-400 font-medium" dir="ltr">
              {slot.startTime}{slot.endTime ? `–${slot.endTime}` : ''}
            </span>
          )}
          {isMakeup ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
              השלמה
            </span>
          ) : (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isCollective
                ? 'bg-teal-50 text-teal-600'
                : 'bg-violet-50 text-violet-600'
            }`}>
              {lessonType.label}
            </span>
          )}
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
        isNext ? (isMakeup ? 'bg-purple-500' : 'bg-teal-500') : 'bg-gray-100'
      }`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isNext ? 'white' : '#6b7280'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    </>
  )

  if (viewOnly && viewOnlyHref) {
    return <Link href={viewOnlyHref} className={className}>{content}</Link>
  }

  if (viewOnly) {
    return <div className={className}>{content}</div>
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  )
}
