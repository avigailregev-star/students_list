import Link from 'next/link'

export default function ViewNav({ teacherId }: { teacherId: string }) {
  return (
    <nav className="fixed bottom-0 right-0 left-0 bg-white border-t border-gray-100 flex justify-around px-2 py-3 pb-safe z-50">
      <Link
        href={`/admin/teachers/${teacherId}/view`}
        className="flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-2xl hover:bg-teal-50 transition-colors"
      >
        <span className="text-xs font-bold text-gray-600">דשבורד</span>
      </Link>
      <Link
        href={`/admin/teachers/${teacherId}/view/reports`}
        className="flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-2xl hover:bg-teal-50 transition-colors"
      >
        <span className="text-xs font-bold text-gray-600">דוחות</span>
      </Link>
      <Link
        href={`/admin/teachers/${teacherId}`}
        className="flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-2xl hover:bg-teal-50 transition-colors"
      >
        <span className="text-xs font-bold text-teal-600">חזרה לאדמין</span>
      </Link>
    </nav>
  )
}
