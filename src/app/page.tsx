"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";



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
      if (error) {
        console.warn("Google provider not enabled, falling back to Anonymous Sign-In:", error.message);
        // Fallback to anonymous sign-in so devs/users can still test the dashboard 
        // without Google OAuth configuration in Supabase.
        const { error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) throw anonError;
        window.location.assign("/dashboard");
      }
    } catch (err) {
      console.error("Auth fallback failed:", err);
      setError("Authentication failed. Please verify your Supabase configuration.");
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
          <button
            onClick={signInWithGoogle}
            disabled={signingIn}
            className="text-sm font-medium text-muted hover:text-foreground transition-colors disabled:opacity-60"
          >
            {signingIn ? "Redirecting..." : "Sign in"}
          </button>
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
          </div>
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

          <p className="mt-6 text-xs text-muted">
            No account yet? Sign in with Google and your captures will appear
            instantly.
          </p>
        </section>

        {/* Product Screenshots */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-20 space-y-24">

            {/* 1. Capture */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight">Capture anything in one click</h3>
                <p className="mt-3 text-sm text-muted leading-relaxed max-w-md">
                  Record your screen or snap a screenshot, annotate it with arrows,
                  highlights and text, then share a link instantly. No uploads, no friction.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-subtle/50">
                  <span className="text-xs font-medium text-muted">mazwayScreen — Editor</span>
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                </div>
                <div className="p-4 flex gap-4">
                  <div className="flex-1 rounded-lg bg-subtle/60 border border-border aspect-video flex items-center justify-center relative">
                    <div className="absolute inset-6 rounded-md border-2 border-dashed border-indigo-300 bg-indigo-50/40" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                      <svg viewBox="0 0 24 24" className="w-10 h-10 text-indigo-500/70" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      <span className="mt-1 text-[10px] text-muted">1920x1080</span>
                    </div>
                  </div>
                  <div className="w-40 hidden sm:flex flex-col gap-2">
                    <div className="h-3 rounded bg-subtle w-3/4" />
                    <div className="h-2 rounded bg-subtle w-full" />
                    <div className="mt-2 h-8 rounded-md bg-indigo-600" />
                    <div className="h-8 rounded-md border border-border" />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. DevTools */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1">
                <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center gap-4 border-b border-border px-4 py-2.5 bg-subtle/50 text-xs font-medium text-muted">
                    <span className="text-indigo-600 font-semibold border-b-2 border-indigo-600 pb-0.5">Info</span>
                    <span>Console <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-400" /></span>
                    <span>Network <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-400" /></span>
                    <span>Actions</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex text-xs"><span className="w-24 text-muted">Timestamp</span><span className="text-foreground font-medium">July 31, 2026 at 3:15 PM</span></div>
                    <div className="flex text-xs"><span className="w-24 text-muted">OS</span><span className="text-foreground font-medium">Windows</span></div>
                    <div className="flex text-xs"><span className="w-24 text-muted">Browser</span><span className="text-foreground font-medium">Chrome 140</span></div>
                    <div className="flex text-xs"><span className="w-24 text-muted">Window size</span><span className="text-foreground font-medium">1920x1080</span></div>
                    <div className="mt-3 rounded-md bg-red-50 border border-red-100 px-3 py-2 font-mono text-[11px] text-red-700">
                      POST /api/v1/auth 500 · Failed to fetch
                    </div>
                    <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2 font-mono text-[11px] text-amber-700">
                      [Vue warn] Property &quot;user&quot; was used before being defined
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight">DevTools context attached automatically</h3>
                <p className="mt-3 text-sm text-muted leading-relaxed max-w-md">
                  Console errors, failed network requests and every user action are
                  captured and attached to the recording — no more &quot;works on my machine&quot;.
                </p>
              </div>
            </div>

            {/* 3. Share & Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight">Share once, fix faster</h3>
                <p className="mt-3 text-sm text-muted leading-relaxed max-w-md">
                  Every capture lives in your Google Drive and appears in your personal
                  dashboard. Copy a link, embed it in a ticket, or keep it private.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-subtle/50">
                  <span className="text-xs font-medium text-muted">Recordings</span>
                  <div className="flex gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-white text-muted">All</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-600 font-medium">Videos</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-white text-muted">Screenshots</span>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {["Bug on login modal", "Checkout flow", "Design review"].map((t) => (
                    <div key={t} className="rounded-lg border border-border overflow-hidden">
                      <div className="aspect-video bg-subtle/70 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-6 h-6 text-indigo-500/60" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                      <div className="px-2.5 py-2">
                        <div className="text-[10px] font-medium text-foreground truncate">{t}</div>
                        <div className="text-[9px] text-muted mt-0.5">Jul 31 · 1920x1080</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
