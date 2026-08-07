import { Metadata } from "next";
import { StaticShell } from "@/components/StaticShell";

export const metadata: Metadata = {
  title: "Features — BugSnap",
  description: "Explore BugSnap features: Screen Recorder, DevTools log capture, instant sharing, and AI bug summaries.",
};

export default function FeaturesPage() {
  return (
    <StaticShell
      title="Powerful Features for Developers & QA Teams"
      subtitle="BugSnap turns messy bug reports into actionable, context-rich tickets with screen recordings, network logs, and zero manual setup."
    >
      <div className="mx-auto max-w-5xl px-6 py-12 space-y-16">

        {/* Feature 1: Instant Capture */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">01. Screen & Tab Recording</span>
            <h2 className="text-2xl font-bold tracking-tight">Capture Screenshots &amp; Screen Recordings with Audio</h2>
            <p className="text-sm text-muted leading-relaxed">
              Record your screen, a specific window, or a Chrome tab in crisp HD. Add voice narration or webcam overlay to explain complex reproduction steps.
            </p>
            <ul className="space-y-1.5 text-xs text-muted pt-2">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                One-click shortcut: <kbd className="bg-subtle px-1.5 py-0.5 rounded font-mono">Ctrl + Shift + S</kbd> for screenshot
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Hotkey: <kbd className="bg-subtle px-1.5 py-0.5 rounded font-mono">Ctrl + Shift + F</kbd> for screen recording
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Canvas editor to annotate, crop, highlight, or blur sensitive data
              </li>
            </ul>
          </div>
          <div className="border border-border rounded-xl bg-subtle/50 p-6 flex flex-col items-center justify-center min-h-[220px]">
            <div className="w-full bg-white rounded-lg border border-border p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs font-bold">Screen Recorder</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-mono">● REC 00:42</span>
              </div>
              <div className="aspect-video bg-indigo-50 border border-indigo-100 rounded flex items-center justify-center text-indigo-500 text-xs">
                🎥 1080p WebM Stream + Microphone Audio
              </div>
            </div>
          </div>
        </div>

        {/* Feature 2: DevTools Capture */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="order-2 md:order-1 border border-border rounded-xl bg-subtle/50 p-6">
            <div className="w-full bg-white rounded-lg border border-border p-4 shadow-sm font-mono text-[11px] space-y-2">
              <div className="text-muted text-[10px] uppercase font-sans border-b border-border pb-1">Automated DevLogs Captured</div>
              <div className="text-red-600 bg-red-50 p-2 rounded">
                ✖ POST /api/v1/auth 500 Internal Server Error (142ms)
              </div>
              <div className="text-amber-700 bg-amber-50 p-2 rounded">
                ⚠ [Console Warn] Unhandled promise rejection: AuthTokenExpired
              </div>
              <div className="text-foreground text-[10px] font-sans text-muted">
                + OS: Windows 11 &middot; Browser: Chrome 140 &middot; Window: 1920x1080
              </div>
            </div>
          </div>
          <div className="order-1 md:order-2 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">02. Automated DevTools</span>
            <h2 className="text-2xl font-bold tracking-tight">Zero-Config Console &amp; Network Error Logs</h2>
            <p className="text-sm text-muted leading-relaxed">
              No need to explain &quot;how to open DevTools&quot; to non-technical team members. BugSnap automatically captures failed HTTP requests, console errors, user actions, and environment metadata directly with every recording.
            </p>
          </div>
        </div>

        {/* Feature 3: Drive Storage & Web Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">03. Ownership &amp; Privacy</span>
            <h2 className="text-2xl font-bold tracking-tight">Stored in Your Own Google Drive</h2>
            <p className="text-sm text-muted leading-relaxed">
              Unlike other platforms that store your files on their servers, BugSnap uploads video &amp; image files directly to <strong>your personal Google Drive account</strong>. You retain 100% control over your files, privacy, and storage limits.
            </p>
          </div>
          <div className="border border-border rounded-xl bg-subtle/50 p-6">
            <div className="bg-white rounded-lg border border-border p-4 shadow-sm space-y-3 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center font-bold text-xl">
                🔒
              </div>
              <h4 className="text-sm font-semibold">Your Storage, Your Data</h4>
              <p className="text-xs text-muted">
                Files uploaded to <code>Google Drive / BugSnap Captures</code> folder. Delete anytime directly from Drive.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="border border-indigo-100 bg-indigo-50/50 rounded-xl p-8 text-center space-y-4">
          <h3 className="text-xl font-bold text-foreground">Ready to streamline your bug reports?</h3>
          <p className="text-sm text-muted max-w-md mx-auto">
            Install the BugSnap extension now and start capturing screen, audio, and dev logs in seconds.
          </p>
          <a
            href="https://chrome.google.com/webstore"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors shadow-sm"
          >
            Get Extension Free →
          </a>
        </div>

      </div>
    </StaticShell>
  );
}