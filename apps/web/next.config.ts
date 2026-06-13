import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

const envPath = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
].find((candidate) => existsSync(candidate));

if (envPath) {
  process.loadEnvFile(envPath);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
