// @ts-check
import { defineConfig } from 'astro/config';

// Served from the custom domain dan-mcnamara.com (set under repo Settings → Pages).
// The repo name doesn't matter with a custom domain, so no `base` is needed.
export default defineConfig({
  site: 'https://dan-mcnamara.com',
  // Astro 7 defaults to 'jsx', which can drop spaces between inline elements.
  compressHTML: true,
});
