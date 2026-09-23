import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

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
    viteStaticCopy({
      targets: [
        { src: 'node_modules/pyodide/pyodide.mjs', dest: 'runtimes/pyodide', rename: { stripBase: true } },
        { src: 'node_modules/pyodide/pyodide.asm.mjs', dest: 'runtimes/pyodide', rename: { stripBase: true } },
        { src: 'node_modules/pyodide/pyodide.asm.wasm', dest: 'runtimes/pyodide', rename: { stripBase: true } },
        { src: 'node_modules/pyodide/python_stdlib.zip', dest: 'runtimes/pyodide', rename: { stripBase: true } },
        { src: 'node_modules/pyodide/pyodide-lock.json', dest: 'runtimes/pyodide', rename: { stripBase: true } },
        { src: 'node_modules/esbuild-wasm/esbuild.wasm', dest: 'runtimes/esbuild', rename: { stripBase: true } },
      ],
    }),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png',
      ],
      manifest: {
        name: 'TheProg Editor - IDE Multilinguagem',
        short_name: 'TheProg',
        description:
          'IDE PWA multilinguagem (C, C++, Python, JavaScript e TypeScript) com compilação e execução no navegador; offline após o primeiro acesso',
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
        globPatterns: [
          '**/*.{js,mjs,css,html,ico,png,svg,wasm,tar,bin,ttf,woff,woff2,webmanifest,json,zip,whl}',
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
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('monaco-editor') || id.includes('@monaco-editor')) {
            return 'vendor-monaco';
          }
          if (id.includes('@xterm')) {
            return 'vendor-xterm';
          }
          if (id.includes('isomorphic-git')) {
            return 'vendor-git';
          }
          if (id.includes('lucide-react') || id.includes('clsx') || id.includes('tailwind-merge')) {
            return 'vendor-ui';
          }
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@yowasp/clang'],
  },
});