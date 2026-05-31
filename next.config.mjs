/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep better-sqlite3 (native addon) out of the server bundle.
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

export default nextConfig;
