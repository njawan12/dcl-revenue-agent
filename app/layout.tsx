import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'DCL Revenue Agent', description: 'Revenue intelligence for Digital Commerce Lab' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
