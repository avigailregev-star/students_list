export default function MessagesLoading() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <div className="h-3 w-16 bg-white/30 rounded-full animate-pulse mb-2" />
        <div className="h-6 w-36 bg-white/30 rounded-full animate-pulse" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2 px-4 pt-5">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-9 w-28 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>

      <div className="px-4 py-5 flex flex-col gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-3 w-16 bg-gray-100 rounded-full animate-pulse" />
            </div>
            <div className="h-3 w-full bg-gray-100 rounded-full animate-pulse" />
            <div className="h-3 w-3/4 bg-gray-100 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
