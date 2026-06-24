export default function DashboardLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 rounded-b-[36px] shadow-lg shadow-teal-200">
        <div className="px-5 pt-8 pb-5 flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-20 bg-white/30 rounded-full animate-pulse" />
            <div className="h-7 w-40 bg-white/30 rounded-full animate-pulse" />
            <div className="h-3 w-28 bg-white/30 rounded-full animate-pulse" />
          </div>
          <div className="w-14 h-14 rounded-[22%] bg-white/20 animate-pulse shrink-0" />
        </div>
        {/* Tab switcher skeleton */}
        <div className="flex mx-5 mb-5 bg-white/20 rounded-2xl p-1 gap-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-1 h-9 rounded-xl bg-white/20 animate-pulse" />
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 px-4 py-5 pb-28 flex flex-col gap-4">
        {/* Date header */}
        <div className="h-5 w-36 bg-gray-200 rounded-full animate-pulse mx-auto" />

        {/* Lesson cards */}
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-4 w-16 bg-gray-200 rounded-full animate-pulse" />
            </div>
            <div className="h-3 w-32 bg-gray-100 rounded-full animate-pulse" />
            <div className="flex gap-2 mt-1">
              {[1, 2, 3].map(j => (
                <div key={j} className="h-6 w-14 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
