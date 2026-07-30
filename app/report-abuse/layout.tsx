import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Report Abuse',
  description: 'Report illegal or harmful content on Relay.',
  alternates: { canonical: '/report-abuse' },
};

export default function ReportAbuseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
