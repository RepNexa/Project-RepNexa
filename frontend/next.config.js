/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const origin = process.env.API_ORIGIN || "http://localhost:8080";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${origin}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
