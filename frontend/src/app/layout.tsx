import type { Metadata } from 'next';
import React from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Streaming Platform',
  description: 'Watch movies and series — trailers free, full playback with a subscription.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a href="/" className="brand">
            StreamCo
          </a>
          <nav>
            <a href="/subscribe">Subscribe</a>
            <a href="/billing">Billing</a>
            <a href="/login">Log in</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
