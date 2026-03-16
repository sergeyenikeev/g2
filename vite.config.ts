import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const platform = env.VITE_PLATFORM || "generic";
  const isYandex = platform === "yandex";
  const distName = env.VITE_DIST_NAME || platform;
  const flatAssets = env.VITE_FLAT_ASSETS === "1" || env.VITE_FLAT_ASSETS === "true";
  const useFlatAssets = isYandex || flatAssets;

  return {
    base: "./",
    build: {
      outDir: `dist/${distName}`,
      sourcemap: false,
      emptyOutDir: true,
      assetsDir: useFlatAssets ? "." : "assets",
      rollupOptions: useFlatAssets
        ? {
            output: {
              entryFileNames: "index-[hash].js",
              chunkFileNames: "chunk-[hash].js",
              assetFileNames: "[name]-[hash][extname]"
            }
          }
        : undefined
    }
  };
});
