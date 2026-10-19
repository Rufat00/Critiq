import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Repository instructions are maintained in the workspace root.
  agentRules: false,
  // Use the compiler API provided by the workspace's TypeScript 5.9.
  experimental: {
    useTypeScriptCli: false,
    // Allow JSON escaping around a CSV capped at 1 MB by core validation.
    serverActions: { bodySizeLimit: '2mb' },
  },
  transpilePackages: [
    '@critiq/auth',
    '@critiq/mail',
    '@critiq/db',
    '@critiq/core',
    '@critiq/constants',
  ],
};

export default nextConfig;
