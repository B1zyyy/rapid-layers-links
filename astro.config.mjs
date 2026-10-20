// @ts-check
import { defineConfig } from 'astro/config';
import { BASE_PATH, SITE_URL } from './deploy.config.mjs';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'ignore',
  // No Markdown code blocks on this site; turning highlighting off keeps the strict CSP warning-free.
  markdown: { syntaxHighlight: false },
  build: {
    inlineStylesheets: 'auto',
  },
  security: {
    // Generates a Content-Security-Policy <meta> tag with hashes for every script and style Astro emits.
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ],
    },
  },
});
