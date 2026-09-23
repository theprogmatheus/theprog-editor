/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import type { WorkboxPlugin, RouteHandlerCallback } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
self.clients.claim();

// Plugin para adicionar cabeçalhos Cross-Origin Isolation em assets do runtime
const coopCoepPlugin: WorkboxPlugin = {
  handlerWillRespond: async ({ response }) => {
    if (!response) {
      return new Response('', { status: 404 });
    }
    if (response.status === 0) {
      return response;
    }
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
    newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
    newHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA Navigation com injeção de Cross-Origin Isolation (COOP e COEP)
const rawNavigationHandler = createHandlerBoundToURL('index.html');
const isolatedNavigationHandler: RouteHandlerCallback = async (params) => {
  try {
    const response = await rawNavigationHandler(params);
    if (!response || response.status === 0) return response;
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
    newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
    newHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (_err) {
    // Fallback de contingência para navegação offline direta do cache
    const cached = (await caches.match('index.html')) || (await caches.match('/theprog-editor/index.html'));
    if (cached) {
      const newHeaders = new Headers(cached.headers);
      newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
      newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
      newHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: newHeaders,
      });
    }
    throw _err;
  }
};

registerRoute(new NavigationRoute(isolatedNavigationHandler));

// Cache de wheels Python (micropip) para reinstalação offline de pacotes
registerRoute(
  /.*\.whl$/,
  new CacheFirst({
    cacheName: 'python-wheels-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      coopCoepPlugin,
    ],
  })
);

// Cache de arquivos binários grandes (Wasm, Tar, Bin)
registerRoute(
  /.*\.(?:wasm|tar|bin)$/,
  new CacheFirst({
    cacheName: 'wasm-tar-resources-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      coopCoepPlugin,
    ],
  })
);

// Cache com prioridade máxima para ícones, imagens, favicon e fontes
registerRoute(
  /.*\.(?:png|jpg|jpeg|svg|ico|webp|ttf|woff|woff2|eot|webmanifest)$/,
  new CacheFirst({
    cacheName: 'static-assets-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      coopCoepPlugin,
    ],
  })
);

// Cache específico para qualquer requisição de Favicon (svg ou ico)
registerRoute(
  ({ url }) => url.pathname.endsWith('favicon.svg') || url.pathname.endsWith('favicon.ico'),
  new CacheFirst({
    cacheName: 'favicon-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Cache com prioridade para scripts e módulos dos runtimes (ex: Pyodide .mjs/.js)
registerRoute(
  ({ url }) => url.pathname.includes('/runtimes/') && /\.(?:js|mjs|css)$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'runtime-scripts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      coopCoepPlugin,
    ],
  })
);

// Fallback de contingência para eventuais CDNs externas
registerRoute(
  /^https:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com)\/.*/,
  new CacheFirst({
    cacheName: 'external-cdn-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);
