import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Analytics } from "@vercel/analytics/next";
import { ClerkProvider } from "@clerk/nextjs";
import { jaJP } from "@clerk/localizations";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "エレファント陸上クラブ",
    template: "%s | エレファント陸上クラブ",
  },
  description:
    "北海道限定の陸上大会エントリー代行クラブ。大会申込の面倒な手続きをすべて代行します。",
  verification: {
    google: "8L403oHgq7VfT-c-5rq7WF6oUV0kVk3EfwXWx-CYoBI",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "エレファント陸上クラブ",
    title: "エレファント陸上クラブ",
    description:
      "北海道限定の陸上大会エントリー代行クラブ。大会申込の面倒な手続きをすべて代行します。",
  },
  twitter: {
    card: "summary_large_image",
    title: "エレファント陸上クラブ",
    description:
      "北海道限定の陸上大会エントリー代行クラブ。大会申込の面倒な手続きをすべて代行します。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={jaJP}>
      <html lang="ja">
        <body className={`${notoSansJP.variable} font-sans antialiased`}>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
