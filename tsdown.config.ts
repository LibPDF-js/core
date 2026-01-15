import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["esm"],
  outDir: "./dist",
  clean: true,
  dts: true,
  sourcemap: true,
  // Keep dependencies external - consumers install their own
  skipNodeModulesBundle: true,
});
