import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us — BugSnap",
  description: "Get in touch with the BugSnap team for support, inquiries, or feedback.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white text-foreground font-sans flex flex-col">
      <header className="border-b border-border bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="BugSnap" className="w-7 h-7 object-contain" />
            <span className="text-base font-bold tracking-tight">BugSnap</span>
          </a>
          <a href="/" className="text-xs text-muted hover:text-foreground">
            ← Back to Home
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12 flex-1 w-full">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Contact Us</h1>
        <p className="text-xs text-muted mb-8">
          Have questions, feedback, or need help with BugSnap? Reach out to our team.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="border border-border rounded-xl p-5 bg-subtle/30 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600">Email Support</h3>
              <p className="text-sm font-semibold">
                <a href="mailto:support@akusaradigital.com" className="hover:underline text-indigo-600">
                  support@akusaradigital.com
                </a>
              </p>
              <p className="text-xs text-muted leading-relaxed">
                For technical issues, account help, security reports, or general inquiries. We aim to reply within 24 hours.
              </p>
            </div>

            <div className="border border-border rounded-xl p-5 bg-subtle/30 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600">Company &amp; Publisher</h3>
              <p className="text-sm font-semibold">Akusara Digital</p>
              <p className="text-xs text-muted leading-relaxed">
                Developer and operator of BugSnap — From Click to Fix.<br />
                Website: <a href="https://akusaradigital.com" target="_blank" rel="noopener noreferrer" className="underline text-indigo-600">akusaradigital.com</a>
              </p>
            </div>

            <div className="border border-border rounded-xl p-5 bg-subtle/30 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600">Open Source &amp; Code</h3>
              <p className="text-sm font-semibold">GitHub Repository</p>
              <p className="text-xs text-muted leading-relaxed">
                Found a bug or have a feature request? Open an issue on our GitHub repo:<br />
                <a href="https://github.com/himawari19/BugSnap" target="_blank" rel="noopener noreferrer" className="underline text-indigo-600">
                  github.com/himawari19/BugSnap
                </a>
              </p>
            </div>
          </div>

          {/* Useful Quick Links */}
          <div className="border border-border rounded-xl p-6 bg-white space-y-4">
            <h3 className="text-base font-bold text-foreground">Useful Resources</h3>
            <ul className="space-y-3 text-xs">
              <li className="flex flex-col gap-0.5">
                <a href="/privacy" className="font-medium text-indigo-600 hover:underline">Privacy Policy</a>
                <span className="text-muted">How we handle your data, Google Drive integration, and Chrome permissions.</span>
              </li>
              <li className="flex flex-col gap-0.5 border-t border-border pt-3">
                <a href="/terms" className="font-medium text-indigo-600 hover:underline">Terms of Service</a>
                <span className="text-muted">The agreement between you and BugSnap regarding acceptable use and service limits.</span>
              </li>
              <li className="flex flex-col gap-0.5 border-t border-border pt-3">
                <a href="https://github.com/himawari19/BugSnap#readme" target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:underline">Documentation &amp; Extension Setup ↗</a>
                <span className="text-muted">Guides on how to install, configure Google Drive OAuth, and use the annotation editor.</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-white py-6">
        <div className="mx-auto max-w-4xl px-6 text-center text-xs text-muted">
          BugSnap — From Click to Fix &middot; by <a href="https://akusaradigital.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">akusaradigital.com</a>
        </div>
      </footer>
    </div>
  );
}