import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://palmora.ai'),
  title: {
    default: 'Palmora AI — Scan your palm. Explore your story.',
    template: '%s | Palmora AI',
  },
  description:
    'Explore classical palmistry reflections of love, career, and vitality through computer vision. Mindful self-reflection grounded in traditional cultural folklore.',
  keywords: [
    'palm reading',
    'palmistry',
    'AI palm reading',
    'chiromancy',
    'heart line',
    'head line',
    'life line',
    'computer vision palmistry',
    'self reflection',
    'cultural folklore',
  ],
  authors: [{ name: 'Palmora AI Team' }],
  creator: 'Palmora AI',
  publisher: 'Palmora AI',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://palmora.ai',
    siteName: 'Palmora AI',
    title: 'Palmora AI — Scan your palm. Explore your story.',
    description:
      'Grounded computer vision palmistry. Interactive crease detection and mindful cultural reflection without subscription traps or biometric retention.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Palmora AI — Mindful AI Palm Reading',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Palmora AI — Scan your palm. Explore your story.',
    description:
      'Grounded computer vision palmistry. Interactive crease detection and mindful cultural reflection.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#070913',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Palmora AI',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Any (Web)',
    description:
      'Computer-vision powered palmistry reading and mindful self-reflection application with zero biometric retention.',
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'USD',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Palmora AI',
      url: 'https://palmora.ai',
    },
  };

  return (
    <html lang="en" className="dark scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[#070913] text-[#F1F4F9] antialiased selection:bg-[#C8AA6E]/30 selection:text-white">
        <Navbar />
        <main className="flex-1 w-full flex flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
