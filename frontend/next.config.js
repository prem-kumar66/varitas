/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/teacher/questions',
        destination: '/teacher/exams',
        permanent: false,
      },
    ];
  },
};
module.exports = nextConfig;
