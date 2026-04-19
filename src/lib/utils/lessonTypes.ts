import type { LessonType } from '@/types/database'

export const LESSON_TYPE_CONFIG: Record<LessonType, { label: string; color: string; bg: string }> = {
  individual_45:     { label: 'פרטני 45 דק׳',    color: 'text-violet-700', bg: 'bg-violet-500' },
  individual_60:     { label: 'פרטני 60 דק׳',    color: 'text-purple-700', bg: 'bg-purple-500' },
  group:             { label: 'קבוצתי',           color: 'text-teal-700',   bg: 'bg-teal-500'   },
  theory:            { label: 'תיאוריה',          color: 'text-blue-700',   bg: 'bg-blue-500'   },
  orchestra:         { label: 'תזמורת',           color: 'text-amber-700',  bg: 'bg-amber-500'  },
  choir:             { label: 'מקהלה',            color: 'text-pink-700',   bg: 'bg-pink-500'   },
  melodies_individual:{ label: 'מנגינות פרטני',  color: 'text-emerald-700',bg: 'bg-emerald-500'},
  melodies_group:    { label: 'מנגינות קבוצתי',  color: 'text-cyan-700',   bg: 'bg-cyan-500'   },
}

export const LESSON_TYPE_OPTIONS = Object.entries(LESSON_TYPE_CONFIG) as [LessonType, { label: string; color: string; bg: string }][]
