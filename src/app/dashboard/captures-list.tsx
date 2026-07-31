"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type CaptureFilter = "all" | "video" | "screenshot";

interface Capture {
  id: string;
  title: string;
  type: string;
  drive_url: string;
  created_at: string;
  window_size?: string;
}

export default function CapturesList({ filter = "all" }: { filter?: CaptureFilter }) {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchCaptures() {
      const { data, error } = await supabase
        .from("captures")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Error fetching captures:", error);
      } else if (!cancelled) {
        setCaptures(data || []);
      }
      if (!cancelled) setLoading(false);
    }
    fetchCaptures();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCaptures = captures.filter((item) => {
    if (filter === "video") return item.type === "video";
    if (filter === "screenshot") return item.type === "screenshot";
    return true;
  });

  const videoCount = captures.filter((c) => c.type === "video").length;
  const screenshotCount = captures.filter((c) => c.type === "screenshot").length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {filter === "video"
              ? "Screen Recordings"
              : filter === "screenshot"
              ? "Screenshots"
              : "Recordings & Captures"}
          </h1>
          <p className="text-sm text-muted mt-1">
            Browse and manage your screen recordings and annotated screenshots.
          </p>
        </div>

        {/* Filters */}
        <div className="inline-flex rounded-lg border border-border bg-subtle p-1 self-start sm:self-auto">
          <a
            href="/dashboard"
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === "all" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            All ({captures.length})
          </a>
          <a
            href="/dashboard/recordings"
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === "video" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            Videos ({videoCount})
          </a>
          <a
            href="/dashboard/screenshots"
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === "screenshot" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            Screenshots ({screenshotCount})
          </a>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-20 text-center text-sm text-muted">Loading your captures...</div>
      ) : filteredCaptures.length === 0 ? (
        <div className="py-20 text-center rounded-xl border border-dashed border-border bg-subtle/50">
          <svg className="w-12 h-12 mx-auto text-muted/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h3 className="text-base font-semibold text-foreground">No captures found</h3>
          <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
            Use the mazwayScreen browser extension to record or snap your screen. When you click &quot;Create Link&quot;, it will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCaptures.map((item) => (
            <a
              key={item.id}
              href={item.drive_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-border bg-white overflow-hidden hover:shadow-sm transition-shadow group flex flex-col"
            >
              {/* Thumbnail placeholder / Type icon */}
              <div className="aspect-video bg-subtle flex items-center justify-center text-muted text-sm relative group-hover:bg-subtle/80 transition-colors">
                <div className="flex flex-col items-center gap-1.5">
                  {item.type === "video" ? (
                    <svg className="w-9 h-9 text-indigo-600/80 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-indigo-600/80 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  <span className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded bg-white/80 border border-border/50 text-foreground">
                    {item.type}
                  </span>
                </div>
              </div>

              {/* Meta */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <h3 className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-indigo-600 transition-colors">
                  {item.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-muted mt-3">
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  <span>{item.window_size || "Screen"}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
