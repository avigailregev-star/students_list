import type { SchoolEvent, SchoolEventType } from '@/types/database'

export const EVENT_COLORS: Record<SchoolEventType, { bg: string; text: string; border: string; label: string }> = {
  holiday:      { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-400',   label: 'חג'         },
  vacation:     { bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-blue-400',    label: 'חופשה'      },
  concert:      { bg: 'bg-pink-100',    text: 'text-pink-800',    border: 'border-pink-400',    label: 'קונצרט'     },
  makeup_day:   { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-400', label: 'השלמה'      },
  school_start: { bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-teal-400',    label: 'פתיחת שנה' },
  school_end:   { bg: 'bg-violet-100',  text: 'text-violet-800',  border: 'border-violet-400',  label: 'סיום שנה'  },
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function getActiveEvents(events: SchoolEvent[], date: Date): SchoolEvent[] {
  const ds = toDateStr(date)
  return events.filter(ev => ev.start_date <= ds && ds <= ev.end_date)
}
