'use client'

import { DAYS_HE } from '@/lib/utils/hebrew'

interface Props {
  index: 1 | 2
  required?: boolean
  label: string
}

export default function SchedulePicker({ index, required, label }: Props) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <div className="flex gap-2">
        <select
          name={`day_${index}`}
          required={required}
          defaultValue=""
          className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 bg-white"
        >
          <option value="" disabled>יום</option>
          {DAYS_HE.slice(0, 5).map((day, i) => (
            <option key={i} value={i}>{day}</option>
          ))}
        </select>
        <input
          type="time"
          name={`time_${index}`}
          required={required}
          className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
        />
      </div>
    </div>
  )
}
