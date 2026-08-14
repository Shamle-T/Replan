import { defineConfig } from "vitest/config"; // Predefined config module

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"]
  }
});
