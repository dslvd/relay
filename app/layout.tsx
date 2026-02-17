import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ClickRipple from "./click-ripple";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Relay",
  description: "CDN Uploader built with Next.js 14 and Vercel Edge Functions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${openSans.variable} antialiased`}>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7504951431311068"
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
        {children}
        <ClickRipple />
        <a className="dmca-link" href="/dmca">
          DMCA
        </a>
      </body>
    </html>
  );
}
