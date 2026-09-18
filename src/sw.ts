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
};

registerRoute(new NavigationRoute(isolatedNavigationHandler));

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
