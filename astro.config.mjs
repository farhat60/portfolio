import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://farhat60.github.io",
  base: "/portfolio",
  output: "static",
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
  build: {
    inlineStylesheets: "always",
  },
});
