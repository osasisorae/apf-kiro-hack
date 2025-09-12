/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@neondatabase/serverless"],
  },
  // allow listed development origins (e.g. ngrok) to access Next.js dev assets
  allowedDevOrigins: ["https://5cf49ddbdef9.ngrok-free.app"],
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    OANDA_TOKEN: process.env.OANDA_TOKEN,
    OANDA_ENVIRONMENT: process.env.OANDA_ENVIRONMENT,
    OANDA_ACCOUNT_ID: process.env.OANDA_ACCOUNT_ID,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
};

module.exports = nextConfig;
