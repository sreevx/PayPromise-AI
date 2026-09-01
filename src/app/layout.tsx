import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { DemoBanner } from '@/components/DemoBanner';

export const metadata: Metadata = {
  title: 'PayPromise AI — Intelligent Invoice Recovery',
  description: 'AI-powered B2B invoice recovery platform. Recover your revenue faster with smart payment reminders and recovery workflows.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <DemoBanner />
        <div className="flex min-h-[calc(100vh-32px)]">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
