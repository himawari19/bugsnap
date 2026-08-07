"use client";

import { useState } from "react";

const TIERS = [
  {
    name: "Free",
    tagline: "For individuals getting started.",
    monthly: 0,
    yearly: 0,
    cta: "Install Now",
    href: "/contact",
    popular: false,
    features: [
      "Unlimited screen & tab recordings (HD)",
      "Automated console & network log capture",
      "Bring-your-own Google Drive storage",
      "Public share links",
      "Up to 5 team members",
      "Basic view analytics",
    ],
  },
  {
    name: "Pro",
    tagline: "For teams that ship fast and fix faster.",
    monthly: 5,
    yearly: 3,
    cta: "Start Free Trial",
    href: "/contact",
    popular: true,
    features: [
      "Everything in Free",
      "Unlimited team members",
      "Custom branding (logo & name)",
      "Remove the BugSnap watermark",
      "Slack & Discord alerts",
      "AI-generated bug summaries",
    ],
  },
  {
    name: "Business",
    tagline: "For orgs with stricter security needs.",
    monthly: 10,
    yearly: 10,
    cta: "Contact Sales",
    href: "/contact",
    popular: false,
    features: [
      "Everything in Pro",
      "Custom domain for share links",
      "IP & domain access whitelist",
      "Burn-after-reading links",
      "Priority support & SLA",
    ],
  },
];

export function PricingToggle() {
  const [yearly, setYearly] = useState(true);

  return (
    <>
      <div className="flex items-center justify-center gap-3 mb-12">
        <span className={`text-sm font-medium ${!yearly ? "text-foreground" : "text-muted"}`}>Monthly</span>
        <button
          onClick={() => setYearly((v) => !v)}
          className="relative w-11 h-6 rounded-full bg-indigo-600 transition-colors shrink-0"
          aria-label="Toggle yearly billing"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              yearly ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <span className={`text-sm font-medium ${yearly ? "text-foreground" : "text-muted"}`}>
          Yearly <span className="text-emerald-600 font-semibold">(save up to 40%)</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {TIERS.map((tier) => {
          const price = yearly ? tier.yearly : tier.monthly;
          return (
            <div
              key={tier.name}
              className={`rounded-2xl border bg-white overflow-hidden relative flex flex-col ${
                tier.popular ? "border-indigo-500 shadow-lg md:-translate-y-2" : "border-border shadow-sm"
              }`}
            >
              {tier.popular && (
                <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg">
                  Most Popular
                </div>
              )}

              <div className="p-8 border-b border-border bg-subtle/30">
                <h3 className="text-lg font-bold text-foreground">{tier.name}</h3>
                <p className="text-xs text-muted mt-1.5 min-h-[2rem]">{tier.tagline}</p>
                <div className="my-4">
                  <span className="text-4xl font-extrabold text-foreground">${price}</span>
                  <span className="text-muted text-sm font-medium"> /mo</span>
                  {tier.monthly !== tier.yearly && yearly && (
                    <p className="text-[11px] text-muted mt-1">Billed yearly</p>
                  )}
                </div>
                <a
                  href={tier.href}
                  className={`block w-full text-center font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors shadow-sm ${
                    tier.popular
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "bg-subtle hover:bg-border text-foreground"
                  }`}
                >
                  {tier.cta}
                </a>
              </div>

              <div className="p-8 flex-1">
                <ul className="space-y-3 text-sm text-foreground">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
