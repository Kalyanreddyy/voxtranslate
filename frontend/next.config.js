/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  rewrites: async () => {
    // In Docker: backend service is at http://backend:8000
    // Locally: backend is at http://localhost:8000
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
      ],
      fallback: [],
    }
  },
}

module.exports = nextConfig
