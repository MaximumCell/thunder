import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silences "ignored package-lock.json ... outside the current Git repository"
  // — there's an unrelated package-lock.json/node_modules in the parent user
  // folder that Turbopack was picking up as a false workspace root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
