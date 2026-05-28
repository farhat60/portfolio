import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://afarhat.org",
  output: "static",
  build: {
    inlineStylesheets: "always",
  },
});
