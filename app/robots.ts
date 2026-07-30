import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://relay.xstlo.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Per-file download/API/admin/auth routes aren't search-relevant pages -
      // keep crawl budget on the marketing surface (/, /pricing, /docs, /api, /plus).
      disallow: ['/api/', '/admin', '/d/', '/dl/', '/download/', '/p/', '/s/', '/i/', '/folder/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
