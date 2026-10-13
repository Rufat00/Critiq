import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Use the compiler API provided by the workspace's TypeScript 5.9.
  experimental: { useTypeScriptCli: false },
  transpilePackages: [
    '@critiq/auth',
    '@critiq/db',
    '@critiq/core',
    '@critiq/constants',
  ],
};

export default nextConfig;
