import type { Metadata } from 'next';
import { Geist, Geist_Mono, Manrope } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'] });

const publicAppUrl = process.env.PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(publicAppUrl),
  title: 'Dento AI · Recepción dental inteligente',
  description: 'Agenda, conversaciones y automatización por WhatsApp para consultorios dentales.',
  openGraph: {
    title: 'Dento AI',
    description: 'Recepción dental inteligente por WhatsApp',
    type: 'website',
    locale: 'es_MX',
    images: [
      {
        url: '/og.png',
        width: 1536,
        height: 806,
        alt: 'Dento AI · Recepción dental inteligente por WhatsApp',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dento AI',
    description: 'Recepción dental inteligente por WhatsApp',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
