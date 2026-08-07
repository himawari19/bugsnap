import { Metadata } from "next";
import { StaticShell } from "@/components/StaticShell";
import { PricingToggle } from "./PricingToggle";

export const metadata: Metadata = {
  title: "Pricing — BugSnap",
  description: "BugSnap pricing. Free forever screen recorder and bug reporting tool, with Pro and Business plans for growing teams.",
};

export default function PricingPage() {
  return (
    <StaticShell
      title="Simple, Transparent Pricing"
      subtitle="Your recordings live in your own Google Drive, so we never charge you for storage. Pick the plan that fits your team."
    >
      <div className="mx-auto max-w-6xl px-6 py-12">
        <PricingToggle />

        <div className="mt-16 max-w-2xl mx-auto text-center space-y-4">
          <h3 className="text-lg font-bold">Need something more custom?</h3>
          <p className="text-sm text-muted">
            Dedicated infrastructure, SSO, or strict compliance requirements? We provide custom enterprise deployments tailored to your company&apos;s security needs.
          </p>
          <div className="pt-2">
            <a href="/contact" className="text-sm font-semibold text-indigo-600 hover:underline">
              Contact Sales →
            </a>
          </div>
        </div>
      </div>
    </StaticShell>
  );
}
