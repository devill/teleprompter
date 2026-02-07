import type { NextConfig } from "next";

const isStaticExport = process.env.STATIC_EXPORT === 'true';

const nextConfig: NextConfig = {
  output: isStaticExport ? 'export' : undefined,
  basePath: isStaticExport ? '/teleprompter' : '',
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_STATIC_MODE: isStaticExport ? 'true' : 'false',
  },
};

export default nextConfig;
