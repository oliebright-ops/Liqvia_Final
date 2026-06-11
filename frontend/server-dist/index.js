"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Unified Liqvia server — Next.js UI + NestJS API on a single port.
 * Deploy as one process (no separate backend service or CORS).
 */
require("reflect-metadata");
const node_http_1 = require("node:http");
const node_url_1 = require("node:url");
const node_path_1 = __importDefault(require("node:path"));
const next_1 = __importDefault(require("next"));
const nest_app_1 = require("@liqvia2/backend/nest-app");
const load_env_1 = require("./load-env");
(0, load_env_1.loadAppEnv)();
const port = Number(process.env.PORT) || 3000;
const dev = process.env.NODE_ENV !== 'production';
const frontendDir = node_path_1.default.resolve(__dirname, '..');
const nextApp = (0, next_1.default)({ dev, dir: frontendDir });
const handle = nextApp.getRequestHandler();
async function start() {
    await nextApp.prepare();
    const nestApp = await (0, nest_app_1.createNestApplication)({ embedded: true, swagger: dev });
    const api = (0, nest_app_1.getNestExpress)(nestApp);
    const server = (0, node_http_1.createServer)((req, res) => {
        void route(req, res);
    });
    async function route(req, res) {
        try {
            const parsedUrl = (0, node_url_1.parse)(req.url ?? '/', true);
            const pathname = parsedUrl.pathname ?? '/';
            if (pathname.startsWith('/api')) {
                api(req, res);
                return;
            }
            await handle(req, res, parsedUrl);
        }
        catch (error) {
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
