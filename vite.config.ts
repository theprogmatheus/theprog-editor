import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  base: '/theprog-editor/',
  plugins: [
    {
      name: 'theprog-base-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const rawUrl = req.url || '';
          const pathOnly = rawUrl.split('?')[0];
          if (pathOnly === '/theprog-editor') {
            const query = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?')) : '';
            res.writeHead(301, { Location: `/theprog-editor/${query}` });
            res.end();
            return;
          }
          next();
        });
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png',
        'v86/**',
      ],
      manifest: {
        name: 'TheProg Editor - IDE Offline',
        short_name: 'TheProg',
        description: 'IDE PWA 100% Offline com compilação nativa C/C++ e ambiente Linux',
        theme_color: '#1e1e1e',
        background_color: '#1e1e1e',
        display: 'standalone',
        orientation: 'any',
        id: '/theprog-editor/',
        start_url: './',
        scope: '/theprog-editor/',
        categories: ['education', 'developer-tools', 'productivity'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      injectManifest: {
        maximumFileSizeToCacheInBytes: 150 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,tar,bin}'],
      },
    }),
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['v86', '@yowasp/clang'],
  },
});
