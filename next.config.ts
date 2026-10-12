import type { NextConfig } from "next";
import { buildRobotsHeaders } from "./src/lib/seo/robots-headers";
import { isProductionConfirmed } from "./src/lib/seo/environment";

const nextConfig: NextConfig = {
  async headers() {
    return buildRobotsHeaders({ productionConfirmed: isProductionConfirmed() });
  },
  async redirects() {
    return [
      {
        source: "/minhas-campanhas",
        destination: "/campanhas",
        statusCode: 301,
      },
      {
        source: "/campanha/:id",
        destination: "/campanhas/:id",
        statusCode: 301,
      },
      {
        source: "/store",
        destination: "/loja",
        statusCode: 301,
      },
      {
        source: "/campaign/preview",
        destination: "/campanhas/nova",
        statusCode: 301,
      },
    ];
  },
};

export default nextConfig;
