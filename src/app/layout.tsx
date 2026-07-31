import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mazway — Bug reporting made instant",
  description:
    "Capture your screen, attach DevTools context, and share a link your team can open in one click.",
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
