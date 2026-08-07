import { Metadata } from "next";
import { StaticShell } from "@/components/StaticShell";

export const metadata: Metadata = {
  title: "Security — BugSnap",
  description: "BugSnap security practices: your files stay in your Google Drive, encryption in transit, and no data ever sold.",
};

const highlights = [
  {
    icon: "📁",
    title: "BYO Storage — Files in YOUR Drive",
    desc: "Recordings and screenshots never touch our servers. They go straight to your personal Google Drive, under your ownership and retention controls.",
  },
  {
    icon: "🧬",
    title: "Encryption in Transit",
    desc: "All traffic is served over HTTPS / TLS 1.3. Authentication sessions use short-lived encrypted tokens with forced token rotation.",
  },
  {
    icon: "🚫",
    title: "No Data Selling",
    desc: "We do not sell, rent, or share your personal data, captures, or metadata with any advertisers, data brokers, or third parties. Ever.",
  },
  {
    icon: "🛡️",
    title: "Principle of Least Privilege",
    desc: "The extension requests only the minimal Chrome permissions needed to capture media and upload to Google Drive, justified and vetted for the Chrome Web Store.",
  },
  {
    icon: "⚙️",
    title: "Minimal Metadata Storage",
    desc: "Only capture title, duration, OS, browser, and dev-log summaries are stored in our secure cloud database — needed to render your workspace dashboard.",
  },
  {
    icon: "🧾",
    title: "Enterprise-Grade Compliance",
    desc: "Our infrastructure is regularly audited and adheres to strict security standards to ensure your data remains protected.",
  },
];

export default function SecurityPage() {
  return (
    <StaticShell
      title="Security Built on Trust & Transparency"
      subtitle="We designed BugSnap with privacy-first architecture: your media is stored in your own Google Drive, and our platform keeps only minimal metadata."
    >
      <div className="mx-auto max-w-5xl px-6 py-12 space-y-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {highlights.map((h) => (
            <div key={h.title} className="border border-border rounded-xl p-5 bg-subtle/30 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-white border border-border flex items-center justify-center text-lg">
                {h.icon}
              </div>
              <h3 className="font-semibold text-sm text-foreground">{h.title}</h3>
              <p className="text-xs text-muted leading-relaxed">{h.desc}</p>
            </div>
          ))}
        </div>

        <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-6 flex items-start gap-4">
          <span className="text-2xl">🔐</span>
          <div className="space-y-1">
            <h3 className="font-semibold text-sm text-foreground">What we store vs. what we never store</h3>
            <p className="text-xs text-muted leading-relaxed max-w-3xl">
              We only store: metadata needed to render the dashboard and tracking (title, type, duration, OS, browser, timestamps), plus comments/captures you explicitly delete from the dashboard. We never store your Google passwords, Drive file contents, or browsing history.\n              You can delete any capture or its metadata at any time.
            </p>
          </div>
        </div>

        <div className="text-center pt-4">
          <a href="/privacy" className="text-sm font-semibold text-indigo-600 hover:underline">
            Read the full Privacy Policy →
          </a>
        </div>
      </div>
    </StaticShell>
  );
}