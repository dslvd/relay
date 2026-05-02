/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      // {
      //   source: '/download/:path*',
      //   destination: '/d/:path*',
      //   permanent: true,
      // },
    ];
  },
};

module.exports = nextConfig;
