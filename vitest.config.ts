import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";
import path from "path";

export default defineConfig({
  plugins: [
    solid({
      // Enable solid-js JSX transformation for tests
      hot: false,
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  test: {
    // Use jsdom for DOM environment
    environment: "jsdom",
    
    // Setup file for global test configuration
    setupFiles: ["./src/__tests__/setup.ts", "./src/test/setup.ts"],
    
    // Global test utilities
    globals: true,
    
    // Include test files
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "src/**/__tests__/**/*.{ts,tsx}",
    ],
    
    // Exclude patterns
    exclude: [
      "node_modules",
      "dist",
      "src-tauri",
      "mcp-server",
      "src/__tests__/setup.ts",
    ],
    
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/types/**",
      ],
      include: [
        "src/components/**/*.{ts,tsx}",
        "src/utils/**/*.ts",
        "src/providers/**/*.ts",
        "src/context/**/*.tsx",
        "src/sdk/**/*.ts",
        "src/hooks/**/*.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    
    // Transform dependencies that need JSX processing
    deps: {
      inline: [
        "@solid-primitives",
      ],
    },
    
    // Reporter configuration
    reporters: ["default"],
    
    // Test timeout
    testTimeout: 10000,
    
    // Isolation mode - run tests in isolation
    isolate: true,
    
    // Watch mode settings
    watch: false,
    
    // Mock reset between tests
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },
});
