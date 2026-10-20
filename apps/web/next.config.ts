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

const hrBrowserToken = process.env.HR_BROWSER_TEST_TOKEN;
if (hrBrowserToken && !/^[a-f0-9]{32}$/.test(hrBrowserToken)) throw new Error("Invalid isolated browser build token");
const nextConfig: NextConfig = {
  ...(hrBrowserToken ? { distDir: `.next-hr-test-${hrBrowserToken}` } : {}),
  reactStrictMode: true,
};

export default nextConfig;
