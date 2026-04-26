/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse ships test files it tries to read at module init — mark as external
  // so Next doesn't try to bundle its debug paths into the server build.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
  },
};

export default nextConfig;
