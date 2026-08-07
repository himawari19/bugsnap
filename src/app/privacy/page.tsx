import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — BugSnap",
  description: "Privacy policy and data handling practices for BugSnap Chrome Extension and Dashboard.",
};

export default function PrivacyPolicyPage() {
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
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-xs text-muted mb-8">Last updated: August 8, 2026</p>

        <div className="space-y-8 text-sm text-foreground/90">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Overview</h2>
            <p>
              BugSnap (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) provides a screen recording, screenshot capture, and bug reporting tool consisting of a Chrome MV3 Extension and a Web Dashboard hosted at <code className="bg-subtle px-1 py-0.5 rounded text-xs">bugsnap.akusaraproject.my.id</code>.
            </p>
            <p>
              We respect your privacy. This policy explains what data we collect, how it is stored, and your rights. We adhere strictly to the <strong>Chrome Web Store User Data Policy</strong>, including Limited Use requirements.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Data We Collect and How We Use It</h2>

            <div className="border border-border rounded-lg p-4 bg-subtle/30 space-y-4">
              <div>
                <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider text-indigo-600 mb-1">A. User Account & Identity</h3>
                <p>
                  <strong>Data:</strong> Your Google Account email address and Google Profile ID.
                </p>
                <p className="text-xs text-muted mt-1">
                  <strong>Purpose:</strong> Authenticating your user session via Google OAuth and linking captures created in the Chrome extension to your Web Dashboard workspace.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider text-indigo-600 mb-1">B. Screen Captures & Video Media</h3>
                <p>
                  <strong>Data:</strong> Screenshots (PNG) and screen recordings (WebM) captured explicitly when you initiate a capture action.
                </p>
                <p className="text-xs text-muted mt-1">
                  <strong>Storage:</strong> Media files are uploaded directly to <strong>your own Google Drive account</strong> using the <code className="bg-subtle px-1 py-0.5 rounded">drive.file</code> scope. BugSnap does NOT store your video or screenshot media files on our own servers.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider text-indigo-600 mb-1">C. Technical Metadata & DevLogs</h3>
                <p>
                  <strong>Data:</strong> Capture title, duration, window dimensions, OS name, browser version, timestamp, and optional developer logs (console errors and failed network request details captured during active recording).
                </p>
                <p className="text-xs text-muted mt-1">
                  <strong>Storage & Purpose:</strong> Stored securely in our cloud database to allow rendering capture details, diagnostic context, and AI bug summaries in your workspace dashboard.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Chrome Extension Permissions & Justification</h2>
            <p>Our Chrome Extension requests the following permissions for specific, limited features:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-muted">
              <li><strong className="text-foreground">desktopCapture &amp; tabCapture:</strong> Required to capture your screen or selected tab when you click record/screenshot.</li>
              <li><strong className="text-foreground">activeTab &amp; scripting:</strong> Required to inject the annotation canvas and capture developer console/network logs for bug reporting on the active tab.</li>
              <li><strong className="text-foreground">storage:</strong> Required to store local extension preferences and temporary auth session tokens locally in your browser.</li>
              <li><strong className="text-foreground">identity:</strong> Required to initiate Google OAuth sign-in for Google Drive storage integration.</li>
              <li><strong className="text-foreground">offscreen:</strong> Required to record audio/video streams safely in background Manifest V3 service workers.</li>
              <li><strong className="text-foreground">&lt;all_urls&gt; (Host Permission):</strong> Required solely to capture console errors and network request metadata on the web page where you explicitly trigger a bug report. We do NOT track browsing history or background web activity.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Data Sharing, Sale, and Transfer</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>We DO NOT sell your data:</strong> BugSnap never sells, rents, or trades your personal data, browser activity, or captures to third parties, advertisers, or data brokers.</li>
              <li><strong>We DO NOT use data for advertising:</strong> No data collected by BugSnap is used for personalized advertising or profiling.</li>
              <li><strong>Service Providers:</strong> We transmit data only to essential infrastructure providers:
                <ul className="list-circle pl-5 mt-1 space-y-1 text-xs text-muted">
                  <li><strong>Google Drive API:</strong> For storing media files in your personal account under your control.</li>
                  <li><strong>Cloud Database:</strong> For secure storage of capture metadata and authentication management.</li>
                  <li><strong>Hosting Provider:</strong> Global edge network for serving the web dashboard application.</li>
                </ul>
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Data Retention & Control</h2>
            <p>
              Your capture media remains in your Google Drive and can be deleted by you at any time directly through Google Drive.
            </p>
            <p>
              Capture metadata stored in BugSnap can be deleted by deleting the capture item from your Web Dashboard. Upon deletion, associated metadata and comments are permanently removed from our database.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Limited Use Disclosure</h2>
            <p>
              BugSnap&apos;s use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Google API Services User Data Policy</a>, including the Limited Use requirements.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Contact Us</h2>
            <p>
              If you have any questions or privacy inquiries regarding BugSnap, please contact us at:
            </p>
            <p className="font-medium text-indigo-600">
              <a href="mailto:support@akusaradigital.com" className="underline">support@akusaradigital.com</a> · <a href="https://akusaradigital.com" target="_blank" rel="noopener noreferrer" className="underline">akusaradigital.com</a>
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
