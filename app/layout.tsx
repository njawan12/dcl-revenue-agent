import './globals.css';
import './revenue-premium.css';
import './offer-profile.css';
import './premium-reset.css';
import './journey.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Revenue Agent', description: 'Turn fresh hiring signals into qualified sales opportunities.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
