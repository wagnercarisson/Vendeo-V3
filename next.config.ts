import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/dashboard",
        statusCode: 301,
      },
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
