import type { Metadata } from "next";
import { Sora, Space_Mono } from 'next/font/google';
import Link from "next/link";
import Script from "next/script";
import "./globals.css";
import ClickRipple from "./click-ripple";
import ThemeProvider from "./components/ThemeProvider";
import ThemeToggle from "./components/ThemeToggle";
import type { Viewport } from "next";

const sora = Sora({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sora',
});

// Used sparingly (via var(--font-space-mono)) for code, IDs, and other
// data-like text — not a site-wide font swap.
const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-space-mono',
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
    <html lang="en" className={`${sora.variable} ${spaceMono.variable}`} style={{ backgroundColor: "#0a0a0a" }}>
      <body className="antialiased" style={{ backgroundColor: "#0a0a0a", margin: 0 }}>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7504951431311068"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <Script src="https://cdn.lordicon.com/lordicon.js" strategy="beforeInteractive" />
        <ThemeProvider>
          <ThemeToggle />
          {children}
        </ThemeProvider>
        <ClickRipple />
        <Link className="footer-link dmca-link" href="/dmca" prefetch>
          DMCA
        </Link>
      </body>
    </html>
  );
}
