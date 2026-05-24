/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    middlewareClientMaxBodySize: 52428800, // 50MB — covers requests that pass through middleware
  },
}

module.exports = nextConfig

