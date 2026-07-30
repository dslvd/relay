import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Docs',
  description: 'Documentation for using Relay: uploading files, sharing code snippets, and the developer API.',
  alternates: { canonical: '/docs' },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
