"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAppEnv = loadAppEnv;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
/** Load env from frontend and backend packages (backend holds DATABASE_URL, JWT, etc.). */
function loadAppEnv() {
    const shellKeys = new Set(Object.keys(process.env));
    const frontendRoot = node_path_1.default.join(__dirname, '..');
    const backendRoot = node_path_1.default.join(frontendRoot, '..', 'backend');
    const repoRoot = node_path_1.default.join(frontendRoot, '..');
    for (const [file, override] of [
        [node_path_1.default.join(repoRoot, '.env'), false],
        [node_path_1.default.join(backendRoot, '.env'), false],
        [node_path_1.default.join(backendRoot, '.env.local'), true],
        [node_path_1.default.join(frontendRoot, '.env'), false],
        [node_path_1.default.join(frontendRoot, '.env.local'), true],
    ]) {
        applyEnvFile(file, override, shellKeys);
    }
}
function applyEnvFile(filePath, override, shellKeys) {
    if (!(0, node_fs_1.existsSync)(filePath))
        return;
    const lines = (0, node_fs_1.readFileSync)(filePath, 'utf8').split('\n');
    for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith('#'))
            continue;
        const eq = line.indexOf('=');
        if (eq === -1)
            continue;
        const key = line.slice(0, eq).trim();
        if (shellKeys.has(key))
            continue;
        let value = line.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (override || process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}
