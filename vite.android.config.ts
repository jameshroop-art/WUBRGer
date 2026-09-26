import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [tailwindcss(), viteReact()],
  resolve: { tsconfigPaths: true },
  build: {
    outDir: "android/assets/www",
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: {
      input: "android.html",
    },
  },
});
