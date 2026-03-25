// Next.js configuration — excludes Playwright from client bundle
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        child_process: false,
      };
    }
    config.externals = config.externals || [];
    config.externals.push('playwright');
    return config;
  },
};

module.exports = nextConfig;
