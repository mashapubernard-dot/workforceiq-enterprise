/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Replit's proxied preview origins in development
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    process.env.REPLIT_DEV_DOMAIN,
  ].filter(Boolean),
};

module.exports = nextConfig;
