import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Custom server (server/index.ts) serves UI + /api — no standalone bundle.
  transpilePackages: ['@liqvia2/shared'],
};

export default nextConfig;
