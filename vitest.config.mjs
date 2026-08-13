import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environment: "jsdom",
    globals: true,
    maxWorkers: 1,
    minWorkers: 1,
    include: [
      "src/**/*.{test,spec}.{js,jsx,ts,tsx}",
      "netlify/functions/**/*.{test,spec}.{js,jsx,ts,tsx}",
      "scripts/**/*.{test,spec}.{js,jsx,ts,tsx}",
    ],
    exclude: [...configDefaults.exclude, "**/e2e/**"],
    setupFiles: "./src/test/setup.js",
  },
});
