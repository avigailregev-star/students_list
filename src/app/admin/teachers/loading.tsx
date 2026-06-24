export default function TeachersLoading() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <div className="h-3 w-16 bg-white/30 rounded-full animate-pulse mb-2" />
        <div className="h-6 w-32 bg-white/30 rounded-full animate-pulse" />
      </div>

      <div className="px-4 py-5 flex flex-col gap-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-white rounded-2xl shadow-sm px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-4 w-28 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-3 w-40 bg-gray-100 rounded-full animate-pulse" />
            </div>
            <div className="h-3 w-12 bg-gray-100 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
