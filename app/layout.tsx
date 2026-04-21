import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed, Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { QueryProvider } from '@/components/QueryProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-barlow',
});

export const metadata: Metadata = {
  title: 'REV Parts Pit',
  description: 'REV Robotics event parts distribution system',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Parts Pit',
  },
};

export const viewport: Viewport = {
  themeColor: '#FF6B00',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${barlowCondensed.variable} h-full`}>
      <body className="h-full bg-[var(--bg-base)] text-[var(--tx-primary)]">
        <ThemeProvider>
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: 'var(--bg-card)',
                  color: 'var(--tx-primary)',
                  border: '1px solid var(--bg-hover)',
                },
                success: { iconTheme: { primary: '#22C55E', secondary: 'var(--bg-card)' } },
                error: { iconTheme: { primary: '#EF4444', secondary: 'var(--bg-card)' } },
              }}
            />
          </AuthProvider>
        </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
