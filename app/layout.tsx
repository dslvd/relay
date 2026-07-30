import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono } from 'next/font/google';
import Link from "next/link";
import Script from "next/script";
import "./globals.css";
import ClickRipple from "./components/ClickRipple";
import DisableInspect from "./components/DisableInspect";
import ThemeProvider from "./components/ThemeProvider";
import ThemeToggle from "./components/ThemeToggle";
import PolicyMenu from "./components/PolicyMenu";
import type { Viewport } from "next";

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

// Used sparingly (via var(--font-space-mono)) for code, IDs, and other
// data-like text — not a site-wide font swap.
const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-space-mono',
});

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://relay.xstlo.com";
const SITE_DESCRIPTION =
  "Relay is a fast, no-signup way to share files and code snippets. Drop a file, get a link. Relay Plus adds 8GB uploads and an 80GB personal vault.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Relay — Quick, secure file & code sharing",
    template: "%s | Relay",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Relay",
  keywords: ["Relay", "file sharing", "code sharing", "snippet sharing", "file upload", "anonymous file sharing"],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Relay",
    title: "Relay — Quick, secure file & code sharing",
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Relay — Quick, secure file & code sharing",
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

// Tells Google exactly what Relay is and gives it a stable identity to
// associate with the "Relay" brand query - separate from the generic
// dictionary word, which no amount of on-page markup can win outright.
const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Relay",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "Utility",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "PHP",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${spaceMono.variable}`} style={{ backgroundColor: "#0a0a0a" }}>
      <body className="antialiased" style={{ backgroundColor: "#0a0a0a", margin: 0 }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {/* Hover/click-triggered decorative animations only — safe to load after
            hydration instead of blocking it. */}
        <Script src="https://cdn.lordicon.com/lordicon.js" strategy="lazyOnload" />
        <Script src="https://static.getclicky.com/js" data-id="101509478" strategy="afterInteractive" />
        <ThemeProvider>
          <ThemeToggle />
          {children}
        </ThemeProvider>
        <ClickRipple />
        <DisableInspect />
        <PolicyMenu />
        <Link className="footer-link pricing-link" href="/pricing" prefetch>
          Pricing
        </Link>
        <Link className="footer-link api-link" href="/api" prefetch>
          API
        </Link>
      </body>
    </html>
  );
}
