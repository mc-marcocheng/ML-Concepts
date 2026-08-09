/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  trailingSlash: true,
  experimental: { optimizePackageImports: ['lucide-react'] },
};

export default nextConfig;
