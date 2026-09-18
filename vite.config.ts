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
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'v86/**'],
      manifest: {
        name: 'TheProg Editor - IDE Offline',
        short_name: 'TheProg',
        description: 'IDE PWA 100% Offline com ambiente Linux isolado',
        theme_color: '#1e1e1e',
        background_color: '#1e1e1e',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        icons: [
          {
            src: './favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 150 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,tar,bin}'],
        runtimeCaching: [
          {
            urlPattern: /.*\.(?:wasm|tar|bin)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-tar-resources-cache',
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
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
