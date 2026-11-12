import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "BouwFlow", template: "%s · BouwFlow" },
  description: "BouwFlow — Projecten in vertrouwen. Het platform voor bouw- en installatiebedrijven in Suriname.",
  applicationName: "BouwFlow",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: { title: "BouwFlow", description: "Projecten in vertrouwen.", siteName: "BouwFlow", locale: "nl_SR", type: "website" },
  appleWebApp: { title: "BouwFlow", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#102d50",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" className={inter.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
