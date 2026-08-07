import { Metadata } from "next";
import { StaticShell } from "@/components/StaticShell";

export const metadata: Metadata = {
  title: "Pricing — BugSnap",
  description: "BugSnap pricing. Free forever screen recorder and bug reporting tool.",
};

export default function PricingPage() {
  return (
    <StaticShell
      title="Simple, Transparent, and Free"
      subtitle="BugSnap relies on your own Google Drive storage, so we don't have to charge you for hosting video files. Enjoy pro features without the pro price tag."
    >
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="max-w-lg mx-auto">
          <div className="border border-indigo-200 rounded-2xl shadow-lg bg-white overflow-hidden relative">
            <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg">
              Most Popular
            </div>

            <div className="p-8 text-center border-b border-border bg-subtle/30">
              <h3 className="text-xl font-bold text-foreground">Community Edition</h3>
              <p className="text-sm text-muted mt-2">Everything you need for seamless bug reporting.</p>
              <div className="my-6">
                <span className="text-5xl font-extrabold text-foreground">$0</span>
                <span className="text-muted text-sm font-medium"> / forever</span>
              </div>
              <a
                href="https://github.com/himawari19/BugSnap"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors shadow-sm"
              >
                Install Now (It&apos;s Free)
              </a>
            </div>

            <div className="p-8 bg-white">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">What&apos;s Included:</h4>
              <ul className="space-y-3 text-sm text-foreground">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Unlimited screen &amp; tab recordings (HD)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Automated Console Errors &amp; Network Logs capture</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Bring-Your-Own Storage: direct upload to Google Drive</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Web Dashboard &amp; public share pages (`/c/[id]`)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Workspace management &amp; team comments</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Slack &amp; Discord webhook integrations</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>AI Bug Summaries (if OpenRouter key provided)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-20 max-w-2xl mx-auto text-center space-y-4">
          <h3 className="text-lg font-bold">Enterprise &amp; Self-Hosted</h3>
          <p className="text-sm text-muted">
            BugSnap is fully open-source. Need a dedicated infrastructure, SSO, or strict SLA compliance? You can fork our repository and self-host the Supabase and Vercel dashboard infrastructure internally for your company.
          </p>
          <div className="pt-2">
            <a href="https://github.com/himawari19/BugSnap" className="text-sm font-semibold text-indigo-600 hover:underline">
              View GitHub Repository →
            </a>
          </div>
        </div>

      </div>
    </StaticShell>
  );
}