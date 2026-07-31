const mockVideos = [
  {
    id: "1",
    title: "Demo walkthrough — onboarding flow",
    date: "2026-07-28",
    duration: "4:32",
    thumbnail: null,
  },
  {
    id: "2",
    title: "Bug report — login modal flicker",
    date: "2026-07-27",
    duration: "1:15",
    thumbnail: null,
  },
  {
    id: "3",
    title: "Sprint review — Auth module",
    date: "2026-07-25",
    duration: "12:08",
    thumbnail: null,
  },
  {
    id: "4",
    title: "Design feedback — Settings page",
    date: "2026-07-24",
    duration: "3:44",
    thumbnail: null,
  },
  {
    id: "5",
    title: "QA test — Payment checkout",
    date: "2026-07-23",
    duration: "6:21",
    thumbnail: null,
  },
  {
    id: "6",
    title: "Quick tip — Keyboard shortcuts",
    date: "2026-07-22",
    duration: "0:58",
    thumbnail: null,
  },
];

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground">Recordings</h2>
        <p className="text-muted text-sm mt-1">
          Browse and manage your screen recordings.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {mockVideos.map((video) => (
          <div
            key={video.id}
            className="rounded-xl border border-border bg-white overflow-hidden hover:shadow-sm transition-shadow group"
          >
            {/* Thumbnail placeholder */}
            <div className="aspect-video bg-subtle flex items-center justify-center text-muted text-sm">
              {video.thumbnail ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <svg
                    className="w-8 h-8 text-muted/50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-xs">{video.duration}</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-4">
              <h3 className="text-sm font-medium text-foreground truncate">
                {video.title}
              </h3>
              <p className="text-xs text-muted mt-1.5">{video.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
