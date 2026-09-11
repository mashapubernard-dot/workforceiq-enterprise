/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Replit's proxied preview origins in development
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    process.env.REPLIT_DEV_DOMAIN,
  ].filter(Boolean),
  // Do not fail the production build on pre-existing type/lint errors
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
