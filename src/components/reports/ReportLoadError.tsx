'use client'

export default function ReportLoadError({ reset }: { reset: () => void }) {
  return <div dir="rtl" className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-6 text-center">
    <h2 className="text-xl font-bold text-gray-900">לא ניתן להפיק דוח מלא כרגע</h2>
    <p className="max-w-md text-gray-600">ייתכן שיש נתונים חסרים או סותרים, או תקלה בטעינה. נסי לטעון שוב. אם התקלה נמשכת, יש לבדוק את נתוני השיעורים עם המנהלת לפני הפקת הדוח.</p>
    <button onClick={reset} className="rounded-xl bg-teal-600 px-5 py-2 text-white">טעינה מחדש</button>
  </div>
}
