import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

const config: NextConfig = {
  transpilePackages: ["@quad/ui", "@quad/shared"],
  // Same-origin API: the browser talks to /api/*, Next forwards it to the Fastify server.
  // In production Caddy does the same routing, so session cookies stay first-party.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
  poweredByHeader: false,
};

export default config;
