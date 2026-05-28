import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://afarhat.org",
  base: "/",
  output: "static",
  build: {
    inlineStylesheets: "always",
  },
});
