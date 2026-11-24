// @ts-check
import { defineConfig } from 'astro/config';

// User site: repo named DMcNamara.github.io, served at the root.
// For a project repo (e.g. github.com/DMcNamara/site), add: base: '/site'
// For a custom domain, set `site` to it and add public/CNAME.
export default defineConfig({
  site: 'https://dmcnamara.github.io',
  // Astro 7 defaults to 'jsx', which can drop spaces between inline elements.
  compressHTML: true,
});
