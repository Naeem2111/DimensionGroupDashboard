/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/brand/blocharch-logo.png",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
