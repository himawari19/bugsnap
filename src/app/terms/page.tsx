import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — BugSnap",
  description: "Terms and conditions for using the BugSnap Chrome Extension and Dashboard.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-foreground font-sans">
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

      <main className="mx-auto max-w-4xl px-6 py-12 leading-relaxed">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-xs text-muted mb-8">Last updated: August 8, 2026</p>

        <div className="space-y-8 text-sm text-foreground/90">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By installing the BugSnap Chrome Extension or using the BugSnap web dashboard (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, please do not install or use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Description of the Service</h2>
            <p>
              BugSnap is a screen capture and bug-reporting tool. It allows you to take screenshots and record your screen, annotate them, upload media to your own Google Drive, and share capture links with others. A web dashboard lets you manage, review, and discuss captures with your team.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Your Accounts</h2>
            <p>
              You must sign in with your Google account to use the dashboard. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Acceptable Use</h2>
            <p className="mb-2">You agree not to use the Service to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Capture or share content that violates the law or the rights of others (e.g., copyrighted material, passwords, confidential data you are not authorized to expose).</li>
              <li>Capture passwords, payment card numbers, or other sensitive personal information.</li>
              <li>Upload malicious code, or interfere with the operation of the Service.</li>
              <li>Attempt to access, damage, or disrupt the BugSnap servers, databases, or the accounts of other users.</li>
              <li>Resell or license copies of the captures or metadata for purposes unrelated to the intended bug-reporting workflow.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Your Content & Ownership</h2>
            <p>
              All screenshots, recordings, annotations, descriptions, and comments you create remain your property. You retain full ownership of your content.
            </p>
            <p>
              You grant BugSnap a limited, non-exclusive, revocable license to store and display your metadata and comments solely to provide the Service. Media files reside in your own Google Drive and remain under your control; BugSnap does not claim ownership of them.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Third-Party Services</h2>
            <p>
              The Service relies on third-party services: Google Drive, Google OAuth, Supabase, and Vercel. Your use of those services is subject to their respective terms and privacy policies. BugSnap is not responsible for the availability or behavior of those third-party services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Disclaimer of Warranties</h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or secure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, BugSnap — From Click to Fix and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, or goodwill, arising from your use of or inability to use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">9. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service at any time for a reason, including violation of these Terms or to protect the security and reliability of the platform. You may stop using the Service and uninstall the extension at any time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">10. Changes to the Terms</h2>
            <p>
              We may update these Terms from time to time. We will update the &quot;Last updated&quot; version at the top of this page. Continued use of the Service after the changes are posted constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">11. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the Republic of Indonesia. Any disputes shall be subject to the exclusive jurisdiction of the courts of Indonesia.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">12. Contact</h2>
            <p>
              For questions about these Terms, contact us at <a href="mailto:support@akusaradigital.com" className="text-indigo-600 underline">support@akusaradigital.com</a>.
            </p>
          </section>
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