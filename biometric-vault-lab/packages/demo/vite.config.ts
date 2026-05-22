import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Strict CSP applied to the PRODUCTION build only. Vite's dev server uses
 * inline scripts and eval for HMR — applying this CSP to dev would break
 * `npm run dev`. The same CSP is appropriate for any HTTPS deployment of
 * the prod bundle.
 *
 * Notes:
 *  - script-src 'self' — no inline scripts, no eval, no remote origins.
 *  - style-src 'self' 'unsafe-inline' — React-injected style attributes
 *    and the few inline `style={...}` props in the demo need it. To
 *    remove 'unsafe-inline', move every inline style into styles.css.
 *  - img-src 'self' data: — ChromaStash slides come back as Blobs (blob:
 *    URLs) when previewed; blob: is implicitly allowed under 'self'.
 *  - connect-src 'self' — vault is offline-first. No remote connections.
 *  - object-src 'none' / base-uri 'none' / frame-ancestors 'none' — kill
 *    legacy embedding / clickjacking surface.
 */
const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
].join('; ');

/**
 * Inject a CSP meta tag into the built HTML only — never in dev.
 */
function prodCspPlugin(): Plugin {
  return {
    name: 'biometric-vault-lab:prod-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const tag = `<meta http-equiv="Content-Security-Policy" content="${PROD_CSP}">`;
        return html.replace('<head>', `<head>\n    ${tag}`);
      },
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    prodCspPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: { enabled: false }, // dev SW disabled while iterating
      workbox: {
        // No cross-origin runtime caching — vault is offline-first by design.
        runtimeCaching: [],
        // Precache the app shell. PNGs and the manifest are included via
        // globPatterns by default.
        navigateFallback: '/index.html',
      },
      manifest: {
        name: 'Biometric Vault Lab',
        short_name: 'VaultLab',
        description:
          'Lab PWA: biometric-only, frontend-only, offline-first local vault.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#1B2A4A',
        theme_color: '#1B2A4A',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    sourcemap: true,
    // Lock asset filenames to predictable shapes so the CSP and SW can
    // reason about what they cache.
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
