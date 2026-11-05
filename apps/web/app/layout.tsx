import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'STSK: Shotokan Karate Academy',
  description: 'Mobile-first karate academy dashboard for student attendance, tuition ledger, and announcements.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
