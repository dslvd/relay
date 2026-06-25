import type { Metadata } from "next";
import { Sora } from 'next/font/google';
import Link from "next/link";
import Script from "next/script";
import "./globals.css";
import ClickRipple from "./click-ripple";
import type { Viewport } from "next";

const sora = Sora({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sora',
});

export const metadata: Metadata = {
  title: "Relay",
  description: "CDN Uploader built with Next.js 14 and Vercel Edge Functions",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sora.variable} style={{ backgroundColor: "#0a0a0a" }}>
      <body className="antialiased" style={{ backgroundColor: "#0a0a0a", margin: 0 }}>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7504951431311068"
          crossOrigin="anonymous"
          // Keep first paint snappy; ads can load after hydration.
          strategy="afterInteractive"
        />
        {children}
        <ClickRipple />
        <Link className="footer-link dmca-link" href="/dmca" prefetch>
          DMCA
        </Link>
      </body>
    </html>
  );
}
