'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import PolicyMenu from './PolicyMenu';

// The marketing footer (Pricing/API/Policy) belongs on customer-facing
// pages, not the internal admin console - it was bleeding into the admin
// dashboard's own header/toolbar area, which looks cluttered and unrelated
// to what an operator is doing there.
export default function SiteFooterLinks() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;

  return (
    <>
      <PolicyMenu />
      <Link className="footer-link pricing-link" href="/pricing" prefetch>
        Pricing
      </Link>
      <Link className="footer-link api-link" href="/api" prefetch>
        API
      </Link>
    </>
  );
}
