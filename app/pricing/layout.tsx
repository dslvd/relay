import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Relay Plus Pricing',
  description:
    'Relay Plus is ₱480/month: 8GB per-file uploads, an 80GB personal vault, and no ads. Compare with the free tier and get started.',
  alternates: { canonical: '/pricing' },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
