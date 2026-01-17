/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // ⚠️ For POC: allow production builds even if there are TS errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

