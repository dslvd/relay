import type { Metadata } from 'next';
import HomeSwitcher from '../HomeSwitcher';

export const metadata: Metadata = {
  title: 'Relay — /test',
  description: 'Design experiment.',
  robots: { index: false, follow: false },
};

export default function TestHomepage() {
  return <HomeSwitcher initialStyle="terminal" />;
}
