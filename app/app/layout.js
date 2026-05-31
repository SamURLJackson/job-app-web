import './globals.css';
import { Providers } from './providers';
import { DM_Serif_Display, DM_Mono } from 'next/font/google';
import localFont from 'next/font/local';

const dmSerif = DM_Serif_Display({
  weight: ['400'],
  subsets: ['latin'],
  variable: '--font-display',
});

const dmMono = DM_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-mono',
});

// Using Instrument Sans as the body font for its refined editorial feel
import { Instrument_Sans } from 'next/font/google';
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-body',
});

export const metadata = {
  title: 'Job Agent',
  description: 'Automated job sourcing, scoring, and application pipeline',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${dmSerif.variable} ${instrumentSans.variable} ${dmMono.variable}`}>
      <body className="bg-cream text-ink font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
