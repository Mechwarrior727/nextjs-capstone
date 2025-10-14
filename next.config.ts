// next.config.ts
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    // This is the same as the default, but resolves the warning
    root: process.cwd(),
  },
};

export default nextConfig;
