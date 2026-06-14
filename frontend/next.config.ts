import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Custom server (server/index.ts) serves UI + /api — no standalone bundle.
  transpilePackages: ['@liqvia2/shared'],
  // Include workspace packages when Vercel traces server dependencies.
  outputFileTracingRoot: path.join(__dirname, '..'),
};

export default nextConfig;
