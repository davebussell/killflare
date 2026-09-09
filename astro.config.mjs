import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://killflare.com',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  image: {
    // Amazon Product Advertising API image hosts — used once PA-API keys are live.
    domains: ['m.media-amazon.com', 'images-na.ssl-images-amazon.com'],
  },
  integrations: [sitemap()],
});
