import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://dashboard.akusaraproject.my.id"),
  title: "BugSnap - From Click to Fix",
  description:
    "From Click to Fix. by akusaradigital.com",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "BugSnap - From Click to Fix",
    description: "From Click to Fix. by akusaradigital.com",
    images: [{ url: "/opengraph-image.png", width: 128, height: 128, alt: "BugSnap" }],
  },
  twitter: {
    card: "summary",
    title: "BugSnap - From Click to Fix",
    description: "From Click to Fix. by akusaradigital.com",
    images: ["/twitter-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
