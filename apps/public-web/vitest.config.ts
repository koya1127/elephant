import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "src/lib/scraper.ts",
        "src/lib/event-utils.ts",
        "src/lib/event-helpers.ts",
        "src/lib/pdfParser.ts",
      ],
    },
  },
});
