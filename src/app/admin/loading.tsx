export default function AdminLoading() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header skeleton */}
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-8">
        <div className="h-3 w-24 bg-white/30 rounded-full animate-pulse mb-2" />
        <div className="h-7 w-44 bg-white/30 rounded-full animate-pulse mb-1" />
        <div className="h-3 w-32 bg-white/30 rounded-full animate-pulse" />
      </div>

      <div className="px-4 py-5 flex flex-col gap-4">
        {/* Stat card */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col items-center gap-2">
          <div className="h-9 w-16 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-3 w-24 bg-gray-100 rounded-full animate-pulse" />
        </div>

        {/* Action cards */}
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-200 rounded-xl animate-pulse shrink-0" />
            <div className="h-4 w-40 bg-gray-200 rounded-full animate-pulse flex-1" />
            <div className="h-4 w-4 bg-gray-100 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
