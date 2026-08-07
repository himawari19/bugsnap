import { Metadata } from "next";
import { StaticShell } from "@/components/StaticShell";

export const metadata: Metadata = {
  title: "Help Center — BugSnap",
  description: "Get help with BugSnap setup, Google Drive permissions, reporting bugs, and team management.",
};

const faqs = [
  {
    q: "How do I connect my Google Drive?",
    a: "When you first capture a bug and attempt to save, a Chrome popup will prompt you to authenticate via Google OAuth. Allow the 'drive.file' permission so BugSnap can write the generated screenshots/video files directly into a new 'BugSnap Captures' folder.",
  },
  {
    q: "Why are my DevTools logs empty?",
    a: "Ensure you triggered the capture on the specific page where the bug occurred. The extension captures console errors and failed network requests only during the recording session or right at the moment you click screenshot.",
  },
  {
    q: "How do I invite team members?",
    a: "Go to your Dashboard, navigate to 'Settings > Members', and enter their email address. They will receive an email invite to join your Workspace. All captures recorded in this Workspace will be visible to them.",
  },
  {
    q: "Are my captures public by default?",
    a: "No. Captures are strictly visible to you and your Workspace members. If you generate a public share link (/c/...), you can secure it with an optional password and an expiration date.",
  },
];

export default function HelpPage() {
  return (
    <StaticShell
      title="Help Center & FAQs"
      subtitle="Find answers to common questions about setting up the Chrome extension, managing permissions, and using the dashboard."
    >
      <div className="mx-auto max-w-5xl px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-10">

        {/* FAQ Left Column */}
        <div className="md:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-foreground">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-border rounded-xl p-5 bg-white shadow-sm space-y-2">
                <h4 className="text-sm font-bold text-indigo-700">{faq.q}</h4>
                <p className="text-xs text-muted leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact/Support Box Right Column */}
        <div className="space-y-6">
          <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl p-6 space-y-4">
            <div className="w-10 h-10 bg-indigo-100 rounded flex items-center justify-center text-xl text-indigo-600">
              💬
            </div>
            <h3 className="text-base font-bold text-foreground">Still need help?</h3>
            <p className="text-xs text-muted">
              Can&apos;t find the answer you&apos;re looking for? Reach out to our technical support team.
            </p>
            <a
              href="mailto:support@akusaradigital.com"
              className="block text-center bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
            >
              Email Support
            </a>
          </div>

          <div className="border border-border bg-subtle/30 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-foreground">Resources</h3>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="https://github.com/himawari19/BugSnap#readme" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  Full Documentation ↗
                </a>
              </li>
              <li>
                <a href="/contact" className="text-indigo-600 hover:underline">Contact Form & Details</a>
              </li>
              <li>
                <a href="/status" className="text-indigo-600 hover:underline">System Status</a>
              </li>
            </ul>
          </div>
        </div>

      </div>
    </StaticShell>
  );
}