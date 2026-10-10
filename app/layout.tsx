import './globals.css';
import './revenue-premium.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'DCL Revenue Agent', description: 'Hiring-led revenue intelligence for Digital Commerce Lab' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
