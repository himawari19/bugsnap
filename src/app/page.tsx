"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [signingIn, setSigningIn] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session?.user);
      setLoadingSession(false);
    });
  }, []);

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

  const faqItems = [
    {
      q: "How does the Google Drive integration work?",
      a: "Your captures live in your own Google Drive, so you stay in full control of your data. Mazway handles the heavy lifting behind the scenes and gives you a clean, shareable link in seconds."
    },
    {
      q: "Are the attached DevTools logs secure?",
      a: "Yes. Only clean, diagnostic information is attached to your captures. Sensitive details are automatically excluded so you can share with confidence."
    },
    {
      q: "Is Mazway really free forever?",
      a: "Yes! The core screen recorder and Google Drive storage integration is completely free. Paid plans unlock advanced team controls for growing teams."
    },
    {
      q: "Do my team members need the extension to view links?",
      a: "No. Anyone you share a link with can view the recording, screenshots, and attached context directly in their web browser. No downloads, no sign-ups."
    }
  ];

  return (
    <div className="min-h-screen bg-white text-foreground font-sans">
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
          
          {loadingSession ? (
            <div className="w-16 h-4 bg-subtle animate-pulse rounded" />
          ) : isLoggedIn ? (
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Go to Dashboard →
            </Link>
          ) : (
            <button
              onClick={signInWithGoogle}
              disabled={signingIn}
              className="text-sm font-medium text-muted hover:text-foreground transition-colors disabled:opacity-60"
            >
              {signingIn ? "Redirecting..." : "Sign in"}
            </button>
          )}
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
            Turn screen moments into bug reports your team can act on in seconds —
            with automatic context, zero friction for testers, and one link to share.
          </p>

          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

          <p className="mt-6 text-xs text-muted">
            Free to start. No credit card. No complexity.
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

        {/* FAQ Section */}
        <section className="border-t border-border bg-subtle/30 py-20">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center text-foreground mb-12">
              Frequently Asked Questions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {faqItems.map((faq, i) => (
                <div key={i} className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">{faq.q}</h4>
                  <p className="text-xs text-muted leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-16 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Ready to speed up your QA pipeline?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted">
              Get the Chrome extension to record bugs with complete console & network error logs in one click.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                onClick={() => window.open("https://chrome.google.com/webstore", "_blank")}
                className="inline-flex items-center gap-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Install Chrome Extension
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-8 border-b border-border">
            {/* Brand column */}
            <div className="col-span-2 space-y-4">
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
              <p className="text-xs text-muted max-w-xs leading-relaxed">
                The fastest way to record screen activities, capture network requests, and report website bugs with automatic DevTools logs.
              </p>
            </div>

            {/* Links column 1 */}
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-foreground uppercase tracking-wider">Product</h5>
              <ul className="space-y-2 text-xs text-muted">
                <li><a href="#" className="hover:text-foreground transition-colors">Screen Recorder</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">DevTools Integration</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing Plans</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Security Guard</a></li>
              </ul>
            </div>

            {/* Links column 2 */}
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-foreground uppercase tracking-wider">Resources</h5>
              <ul className="space-y-2 text-xs text-muted">
                <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Chrome Extension</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API Status</a></li>
              </ul>
            </div>

            {/* Links column 3 */}
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-foreground uppercase tracking-wider">Company</h5>
              <ul className="space-y-2 text-xs text-muted">
                <li><a href="#" className="hover:text-foreground transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted">
              &copy; {new Date().getFullYear()} Mazway. All rights reserved.
            </p>
            <p className="text-xs text-muted">
              Built natively on top of Google Drive API & Supabase.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
