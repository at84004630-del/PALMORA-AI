import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://palmora.ai';
  const now = new Date();

  const routes = [
    '',
    '/scan',
    '/pricing',
    '/dashboard',
    '/privacy',
    '/terms',
    '/delete-account',
    '/guides',
    '/guides/heart-line-meaning',
    '/guides/major-palm-lines-difference',
    '/guides/how-ai-palm-scanning-works',
    '/guides/how-to-photograph-your-palm',
    '/guides/what-ai-palm-reading-can-and-cannot-do',
    '/guides/palm-photo-privacy-and-retention',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route.startsWith('/guides') ? 'monthly' : 'weekly',
    priority: route === '' ? 1.0 : route.startsWith('/guides') ? 0.8 : 0.6,
  }));
}
