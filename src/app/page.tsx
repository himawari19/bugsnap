"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useT } from "@/components/I18nProvider";

export default function Home() {
  const { t } = useT();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const loggedIn = !!data.session?.user;
      setIsLoggedIn(loggedIn);
      setLoadingSession(false);
      // Auto-open the dashboard once a session exists so returning users
      // (extension popup, bookmark, manual nav) land straight in â€” not on
      // the marketing landing which looks like a "log in again" wall.
      if (loggedIn) router.replace("/dashboard");
    });
  }, [router]);

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
      setError(t("landing.authFailed"));
    } finally {
      setSigningIn(false);
    }
  }

  const faqItems = [
    { q: "landing.faq1q", a: "landing.faq1a" },
    { q: "landing.faq2q", a: "landing.faq2a" },
    { q: "landing.faq3q", a: "landing.faq3a" },
    { q: "landing.faq4q", a: "landing.faq4a" },
  ];

  return (
    <div className="min-h-screen bg-white text-foreground font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-10 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="BugSnap" className="w-8 h-8 object-contain" />
            <span className="text-lg font-bold tracking-tight">BugSnap</span>
          </a>
          
          {loadingSession ? (
            <div className="w-16 h-4 bg-subtle animate-pulse rounded" />
          ) : isLoggedIn ? (
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              {t("landing.goToDashboard")}
            </Link>
          ) : (
            <button
              onClick={signInWithGoogle}
              disabled={signingIn}
              className="text-sm font-medium text-muted hover:text-foreground transition-colors disabled:opacity-60"
            >
              {signingIn ? t("landing.redirecting") : t("landing.signIn")}
            </button>
          )}
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
          <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle px-3 py-1 text-xs font-medium text-muted mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {t("landing.freeForever")}
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
            {t("landing.tagline")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg text-muted">
            {t("landing.heroSub")}
          </p>

          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

          <p className="mt-6 text-xs text-muted">
            {t("landing.noCard")}
          </p>
        </section>

        {/* Product Screenshots */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-20 space-y-24">

            {/* 1. Capture */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{t("landing.f1Title")}</h3>
                <p className="mt-3 text-sm text-muted leading-relaxed max-w-md">
                  {t("landing.f1Body")}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-subtle/50">
                  <span className="text-xs font-medium text-muted">{t("landing.editorLabel")}</span>
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
                    <span className="text-indigo-600 font-semibold border-b-2 border-indigo-600 pb-0.5">{t("dt.info")}</span>
                    <span>{t("dt.console")} <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-400" /></span>
                    <span>{t("dt.network")} <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-400" /></span>
                    <span>{t("dt.actions")}</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex text-xs"><span className="w-24 text-muted">{t("dt.timestamp")}</span><span className="text-foreground font-medium">July 31, 2026 at 3:15 PM</span></div>
                    <div className="flex text-xs"><span className="w-24 text-muted">{t("dt.os")}</span><span className="text-foreground font-medium">Windows</span></div>
                    <div className="flex text-xs"><span className="w-24 text-muted">{t("dt.browser")}</span><span className="text-foreground font-medium">Chrome 140</span></div>
                    <div className="flex text-xs"><span className="w-24 text-muted">{t("dt.windowSize")}</span><span className="text-foreground font-medium">1920x1080</span></div>
                    <div className="mt-3 rounded-md bg-red-50 border border-red-100 px-3 py-2 font-mono text-[11px] text-red-700">
                      POST /api/v1/auth 500 Â· Failed to fetch
                    </div>
                    <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2 font-mono text-[11px] text-amber-700">
                      [Vue warn] Property &quot;user&quot; was used before being defined
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{t("landing.f2Title")}</h3>
                <p className="mt-3 text-sm text-muted leading-relaxed max-w-md">
                  {t("landing.f2Body")}
                </p>
              </div>
            </div>

            {/* 3. Share & Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{t("landing.f3Title")}</h3>
                <p className="mt-3 text-sm text-muted leading-relaxed max-w-md">
                  {t("landing.f3Body")}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-subtle/50">
                  <span className="text-xs font-medium text-muted">{t("landing.recordings")}</span>
                  <div className="flex gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-white text-muted">{t("landing.all")}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-600 font-medium">{t("landing.videos")}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-white text-muted">{t("landing.screenshots")}</span>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[t("landing.mock1"), t("landing.mock2"), t("landing.mock3")].map((m) => (
                    <div key={m} className="rounded-lg border border-border overflow-hidden">
                      <div className="aspect-video bg-subtle/70 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-6 h-6 text-indigo-500/60" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                      <div className="px-2.5 py-2">
                        <div className="text-[10px] font-medium text-foreground truncate">{m}</div>
                        <div className="text-[9px] text-muted mt-0.5">Jul 31 Â· 1920x1080</div>
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
              {t("landing.faq")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {faqItems.map((faq, i) => (
                <div key={i} className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">{t(faq.q)}</h4>
                  <p className="text-xs text-muted leading-relaxed">{t(faq.a)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-16 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {t("landing.cta2")}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted">
              {t("landing.ctaHint")}
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                onClick={() => window.open("https://github.com/himawari19/BugSnap", "_blank")}
                className="inline-flex items-center gap-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t("landing.cta")}
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
                <img src="/icon.svg" alt="" aria-hidden="true" className="w-6 h-6 object-contain" />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">BugSnap</span>
                  <span className="text-[11px] text-muted">From Click to Fix. by <a href="https://akusaradigital.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">akusaradigital.com</a></span>
                </div>
              </div>
              <p className="text-xs text-muted max-w-xs leading-relaxed">
                {t("landing.footDesc")}
              </p>
            </div>

            {/* Links column 1 */}
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-foreground uppercase tracking-wider">{t("landing.product")}</h5>
              <ul className="space-y-2 text-xs text-muted">
                <li><a href="/features" className="hover:text-foreground transition-colors">{t("landing.screenRecorder")}</a></li>
                <li><a href="/features#devtools" className="hover:text-foreground transition-colors">{t("landing.devTools")}</a></li>
                <li><a href="/pricing" className="hover:text-foreground transition-colors">{t("landing.pricing")}</a></li>
                <li><a href="/security" className="hover:text-foreground transition-colors">{t("landing.security")}</a></li>
              </ul>
            </div>

            {/* Links column 2 */}
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-foreground uppercase tracking-wider">{t("landing.resources")}</h5>
              <ul className="space-y-2 text-xs text-muted">
                <li><a href="https://github.com/himawari19/BugSnap#readme" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">{t("landing.docs")}</a></li>
                <li><a href="https://github.com/himawari19/BugSnap/tree/main/bugsnap-extension" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">{t("landing.chromeExt")}</a></li>
                <li><a href="/help" className="hover:text-foreground transition-colors">{t("landing.help")}</a></li>
                <li><a href="/status" className="hover:text-foreground transition-colors">{t("landing.apiStatus")}</a></li>
              </ul>
            </div>

            {/* Links column 3 */}
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-foreground uppercase tracking-wider">{t("landing.company")}</h5>
              <ul className="space-y-2 text-xs text-muted">
                <li><a href="https://akusaradigital.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">{t("landing.about")}</a></li>
                <li><a href="/privacy" className="hover:text-foreground transition-colors">{t("landing.privacy")}</a></li>
                <li><a href="/terms" className="hover:text-foreground transition-colors">{t("landing.terms")}</a></li>
                <li><a href="/contact" className="hover:text-foreground transition-colors">{t("landing.contact")}</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted">
              {t("landing.copyright", { year: new Date().getFullYear() })}
            </p>
            <p className="text-xs text-muted">
              {t("landing.builtOn")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}


