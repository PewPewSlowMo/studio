import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  serverExternalPackages: ['asterisk-manager', 'mysql2', 'sqlite3', 'xlsx'],
  // Ignore watching the data directory to prevent server restarts in dev mode
  watchOptions: {
    ignored: ['**/data/**'],
  },
};

export default nextConfig;
