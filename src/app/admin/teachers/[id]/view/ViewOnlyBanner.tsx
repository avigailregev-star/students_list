import Link from 'next/link'

export default function ViewOnlyBanner({ teacherId }: { teacherId: string }) {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs font-bold text-amber-700">
      <span>מצב צפייה — קריאה בלבד</span>
      <Link href={`/admin/teachers/${teacherId}`} className="underline hover:text-amber-900">
        חזרה לאדמין
      </Link>
    </div>
  )
}
