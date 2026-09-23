'use client'

import Link from 'next/link'

export default function MyRoomClient({ roomName }: { roomName: string | null }) {
  return (
    <div className="px-4 py-5 flex flex-col gap-4" dir="rtl">
      {roomName ? (
        <div className="bg-emerald-500 text-white rounded-2xl px-5 py-5 shadow-sm shadow-emerald-200">
          <p className="text-xs font-semibold opacity-80 mb-1">החדר שלך היום</p>
          <p className="text-3xl font-bold">{roomName}</p>
        </div>
      ) : (
        <div className="bg-gray-100 rounded-2xl px-5 py-5">
          <p className="text-sm text-gray-400 font-semibold">לא שובצת לחדר היום</p>
        </div>
      )}

      <Link href="/rooms" className="text-xs text-teal-500 font-semibold">
        ← ראי את הלוח השבועי
      </Link>
    </div>
  )
}
