import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://farhat60.github.io",
  base: "/portfolio",
  output: "static",
  build: {
    inlineStylesheets: "always",
  },
});
