import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://mazway-dashboard.vercel.app"),
  title: "Mazway — Bug reporting made instant",
  description:
    "Capture your screen, attach DevTools context, and share a link your team can open in one click.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Mazway — Bug reporting made instant",
    description: "Capture bugs with screenshots, recordings, and automatic DevTools context.",
    images: [{ url: "/opengraph-image.png", width: 128, height: 128, alt: "Mazway" }],
  },
  twitter: {
    card: "summary",
    title: "Mazway — Bug reporting made instant",
    description: "Capture bugs with screenshots, recordings, and automatic DevTools context.",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
