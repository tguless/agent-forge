/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    // Keep better-sqlite3 (native addon) out of the server bundle.
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

export default nextConfig;
