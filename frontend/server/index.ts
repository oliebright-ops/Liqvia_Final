/**
 * Unified Liqvia server — Next.js UI + NestJS API on a single port.
 * Deploy as one process (no separate backend service or CORS).
 */
import 'reflect-metadata';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { parse } from 'node:url';
import path from 'node:path';
import next from 'next';
import { createNestApplication, getNestExpress } from '@liqvia2/backend/nest-app';
import { loadAppEnv } from './load-env';

loadAppEnv();

const port = Number(process.env.PORT) || 3000;
const dev = process.env.NODE_ENV !== 'production';
const frontendDir = path.resolve(__dirname, '..');

const nextApp = next({ dev, dir: frontendDir });
const handle = nextApp.getRequestHandler();

async function start() {
  await nextApp.prepare();

  const nestApp = await createNestApplication({ embedded: true, swagger: dev });
  const api = getNestExpress(nestApp);

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void route(req, res);
  });

  async function route(req: IncomingMessage, res: ServerResponse) {
    try {
      const parsedUrl = parse(req.url ?? '/', true);
      const pathname = parsedUrl.pathname ?? '/';

      if (pathname.startsWith('/api')) {
        api(req, res);
        return;
      }

      await handle(req, res, parsedUrl);
    } catch (error) {
      console.error('[server] Request error:', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }

  server.listen(port, () => {
    console.log(`> Liqvia ready on http://localhost:${port} (UI + /api)`);
  });
}

start().catch((error) => {
  console.error('[server] Failed to start:', error);
  process.exit(1);
});
