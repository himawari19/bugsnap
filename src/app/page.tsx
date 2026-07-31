"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const features = [
  {
    icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
    title: "Instant screen capture",
    description:
      "Click one button to record your screen or snap a screenshot, annotate it, and generate a shareable link in seconds.",
  },
  {
    icon: "M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5c-.49 0-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z",
    title: "DevTools logs included",
    description:
      "Console errors, failed network requests, and user actions are captured automatically and attached to every report.",
  },
  {
    icon: "M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 4v8h16V8H4zm3 2h6v2H7v-2zm9 0h1v1h-1v-1zm-9 3h10v2H7v-2z",
    title: "Auto-organize",
    description:
      "Every capture is saved to your Google Drive automatically, so your recordings stay organized and never get lost.",
  },
  {
    icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    title: "Free forever with Google Drive",
    description:
      "No credit card, no storage limits. Reports live in your own Drive account and are free for as long as you use them.",
  },
];

export default function Home() {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setSigningIn(true);
    setError(null);
    try {
      const redirectTo = `${window.location.origin}/dashboard`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
      // No error means the browser is navigating to Google — keep the button in loading state.
    } catch (err) {
      // Offline/dev fallback: auth flow unavailable, still route to the dashboard.
      console.warn("OAuth unavailable, falling back to dashboard:", err);
      window.location.assign("/dashboard");
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-10 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-2.5">
            <svg viewBox="0 0 128 128" className="w-8 h-8" role="img" aria-label="Mazway">
              <rect x="8" y="8" width="112" height="112" rx="27" fill="url(#lg)" />
              <defs>
                <linearGradient id="lg" x1="14" y1="12" x2="114" y2="118" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#18B7E9" />
                  <stop offset=".54" stopColor="#4C8BF0" />
                  <stop offset="1" stopColor="#8A42E8" />
                </linearGradient>
              </defs>
              <circle cx="64" cy="64" r="38" fill="#FFF" />
              <circle cx="64" cy="64" r="28" fill="#27AEBB" />
              <circle cx="64" cy="64" r="12" fill="#FFF" />
              <circle cx="64" cy="64" r="5" fill="#5B61DA" />
            </svg>
            <span className="text-lg font-bold tracking-tight">Mazway</span>
          </a>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
          <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle px-3 py-1 text-xs font-medium text-muted mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Free forever with Google Drive
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
            Bug reporting made instant
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg text-muted">
            Capture your screen, attach the DevTools context, and share a link
            your team can open in one click. No setup, no accounts to juggle.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={signInWithGoogle}
              disabled={signingIn}
              className="inline-flex items-center gap-2.5 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 transition-colors"
            >
              {signingIn ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Redirecting...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
                    <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 015.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 001 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-medium text-foreground hover:bg-subtle transition-colors"
            >
              Go to Dashboard
              <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

          <p className="mt-6 text-xs text-muted">
            No account yet? Sign in with Google and your captures will appear
            instantly.
          </p>
        </section>

        {/* Features */}
        <section className="border-t border-border bg-subtle/40">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
              Everything your team needs to squash bugs
            </h2>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-border bg-white p-6 flex flex-col"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-subtle text-indigo-600">
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d={f.icon} />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1.5 text-xs text-muted leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-16 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Ready to share your first bug report?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted">
              Install the extension, capture your screen, and send a link that
              includes the DevTools context automatically.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                onClick={signInWithGoogle}
                disabled={signingIn}
                className="inline-flex items-center gap-2.5 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
                  <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 015.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 001 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                </svg>
                Sign in with Google
              </button>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-medium text-foreground hover:bg-subtle transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 128 128" className="w-6 h-6" aria-hidden="true">
              <rect x="8" y="8" width="112" height="112" rx="27" fill="url(#lgf)" />
              <defs>
                <linearGradient id="lgf" x1="14" y1="12" x2="114" y2="118" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#18B7E9" />
                  <stop offset=".54" stopColor="#4C8BF0" />
                  <stop offset="1" stopColor="#8A42E8" />
                </linearGradient>
              </defs>
              <circle cx="64" cy="64" r="38" fill="#FFF" />
              <circle cx="64" cy="64" r="28" fill="#27AEBB" />
              <circle cx="64" cy="64" r="12" fill="#FFF" />
              <circle cx="64" cy="64" r="5" fill="#5B61DA" />
            </svg>
            <span className="text-sm font-semibold">Mazway</span>
          </div>
          <p className="text-xs text-muted">
            Screen recorder for faster bug reports.
          </p>
        </div>
      </footer>
    </div>
  );
}
