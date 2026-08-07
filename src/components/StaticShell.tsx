import { ReactNode } from "react";

export function StaticShell({
  title,
  subtitle,
  lastUpdated,
  children,
}: {
  title: string;
  subtitle?: string;
  lastUpdated?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-foreground font-sans flex flex-col">
      <header className="border-b border-border bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="BugSnap" className="w-7 h-7 object-contain" />
            <span className="text-base font-bold tracking-tight">BugSnap</span>
          </a>
          <a href="/dashboard" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
            Open Dashboard →
          </a>
        </div>
      </header>

      <main className="flex-1">
        {typeof title !== "undefined" && (
          <section className="border-b border-border bg-subtle/30">
            <div className="mx-auto max-w-5xl px-6 py-10">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{title}</h1>
              {subtitle && <p className="mt-3 text-sm text-muted max-w-2xl leading-relaxed">{subtitle}</p>}
              {lastUpdated && <p className="mt-3 text-xs text-muted">Last updated: {lastUpdated}</p>}
            </div>
          </section>
        )}
        {children}
      </main>

      <footer className="border-t border-border bg-white py-6">
        <div className="mx-auto max-w-5xl px-6 text-center text-xs text-muted">
          BugSnap — From Click to Fix · by{" "}
          <a href="https://akusaradigital.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
            akusaradigital.com
          </a>
          {" · "}
          <a href="/privacy" className="hover:text-foreground">Privacy</a>{" · "}
          <a href="/terms" className="hover:text-foreground">Terms</a>{" · "}
          <a href="/contact" className="hover:text-foreground">Contact</a>
        </div>
      </footer>
    </div>
  );
}