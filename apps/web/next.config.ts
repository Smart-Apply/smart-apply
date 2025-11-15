import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  // Set workspace root for file tracing (monorepo setup)
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
