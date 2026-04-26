import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained bundle for Docker (copies only what's needed to run)
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
