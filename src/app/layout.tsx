import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "BouwFlow", template: "%s · BouwFlow" },
  description: "BouwFlow — projecten in vertrouwen. Platform voor bouw- en installatiebedrijven.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a2240",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" className={inter.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
