import type { Plugin } from 'vite';

/** Development-only process counter; it resets when the Vite server restarts. */
export function localVisitCounter(): Plugin {
  let count = 0;
  return {
    name: 'local-visit-counter',
    configureServer(server) {
      server.middlewares.use('/api/visits', (request, response, next) => {
        if (request.method !== 'POST') return next();
        count += 1;
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store, max-age=0');
        response.end(JSON.stringify({ count }));
      });
    },
  };
}
