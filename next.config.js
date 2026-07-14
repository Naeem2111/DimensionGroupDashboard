/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/brand/dimension-group-logo.png",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
