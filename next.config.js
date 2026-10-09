/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  // En Vercel public/ se sirve por CDN y no viaja dentro de la función serverless;
  // sin esto fs.readFile('public/whatsapp/...') falla y solo se envía el texto.
  outputFileTracingIncludes: {
    '/api/alerts/send': ['./public/whatsapp/**/*'],
    '/api/cron/evaluate': ['./public/whatsapp/**/*'],
    '/api/alerts/[id]/resend': ['./public/whatsapp/**/*'],
  },
  images: {
    remotePatterns: [],
  },
};

module.exports = nextConfig;
