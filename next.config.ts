/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: "/cdn/:path*",
        destination:
          "https://rcltxppgseuupozb.public.blob.vercel-storage.com/cdn/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
