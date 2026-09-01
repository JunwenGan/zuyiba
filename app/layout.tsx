import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '足一把 - Guess the Footballer',
  description:
    'An infinite football player guessing game. Test your football knowledge by guessing players based on their attributes.',
  keywords: ['football', 'soccer', 'guessing game', 'wordle', 'player quiz'],
  authors: [{ name: 'ZuYiBa' }],
  openGraph: {
    title: '足一把 - Guess the Footballer',
    description:
      'An infinite football player guessing game. Test your football knowledge by guessing players based on their attributes.',
    type: 'website',
    locale: 'zh_CN',
  },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
