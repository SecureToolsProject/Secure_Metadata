import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "secure-metadata": "src/index.ts" },
  outDir: "dist/browser",
  format: ["esm"],
  platform: "browser",
  target: "es2022",
  dts: false,
  clean: false,
  sourcemap: true,
  splitting: false,
  minify: false,
});
