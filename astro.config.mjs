import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://afarhat.org",
  base: "/portfolio",
  output: "static",
  build: {
    inlineStylesheets: "always",
  },
});
