import { copyFileSync, existsSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Ensure ONNX Runtime WASM .mjs files are available in public/onnxruntime/
const onnxDir = join(__dirname, "public/onnxruntime")
mkdirSync(onnxDir, { recursive: true })
for (const file of [
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.mjs",
]) {
  const src = join(__dirname, "node_modules/onnxruntime-web/dist", file)
  const dest = join(onnxDir, file)
  if (existsSync(src) && !existsSync(dest)) {
    copyFileSync(src, dest)
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {},
}

export default nextConfig
