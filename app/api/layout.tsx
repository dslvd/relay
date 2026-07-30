import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Developer API',
  description: 'Relay Plus developer API keys - upload, list, and manage files programmatically.',
  alternates: { canonical: '/api' },
};

export default function ApiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
