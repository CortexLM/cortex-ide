import { defineConfig, type UserConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

// Check if we're running bundle analysis
const isAnalyze = process.env.ANALYZE === "true";

const host = process.env.TAURI_DEV_HOST;

/**
 * Manual chunk configuration for optimal code splitting.
 * Separates large dependencies into individual chunks for better caching
 * and parallel loading.
 */
function createManualChunks(id: string): string | undefined {
  // ===========================================================================
  // SOURCE CODE SPLITTING - Split heavy app modules for lazy loading
  // ===========================================================================
  
  // Extension host system - ~590KB, loaded lazily when extensions are activated
  if (id.includes("/extension-host/") && !id.includes("node_modules")) {
    return "app-extension-host";
  }
  
  // Heavy context providers - defer loading to after first paint
  if (id.includes("/context/DebugContext") && !id.includes("node_modules")) {
    return "app-context-debug";
  }
  if (id.includes("/context/TasksContext") && !id.includes("node_modules")) {
    return "app-context-tasks";
  }
  if (id.includes("/context/TerminalsContext") && !id.includes("node_modules")) {
    return "app-context-terminals";
  }
  if (id.includes("/context/TestingContext") && !id.includes("node_modules")) {
    return "app-context-testing";
  }
  if (id.includes("/context/LSPContext") && !id.includes("node_modules")) {
    return "app-context-lsp";
  }
  if (id.includes("/context/ExtensionsContext") && !id.includes("node_modules")) {
    return "app-context-extensions";
  }
  
  // ===========================================================================
  // VENDOR SPLITTING - External dependencies
  // ===========================================================================
  
  // Monaco Editor - Large library, separate chunk for lazy loading
  if (id.includes("monaco-editor") || id.includes("@monaco-editor")) {
    return "vendor-monaco";
  }

  // Xterm terminal - Split for progressive loading
  if (id.includes("@xterm/xterm")) {
    return "vendor-xterm-core";
  }
  if (id.includes("@xterm/addon-webgl")) {
    return "vendor-xterm-webgl";
  }
  if (id.includes("@xterm/addon")) {
    return "vendor-xterm-addons";
  }

  // Shiki syntax highlighter - Split into core + languages for better lazy loading
  if (id.includes("shiki")) {
    // Shiki WASM engine - load separately (required for highlighting)
    if (id.includes("onig.wasm") || id.includes("/wasm")) {
      return "vendor-shiki-wasm";
    }
    // Shiki themes - only github-dark is used, but bundle includes others
    if (id.includes("/themes/")) {
      return "vendor-shiki-themes";
    }
    // Shiki languages - split by usage frequency
    if (id.includes("/langs/")) {
      // High priority: JS/TS ecosystem (most common in IDE)
      if (id.match(/\/(javascript|typescript|jsx|tsx|json)\./)) {
        return "vendor-shiki-lang-js";
      }
      // Web languages
      if (id.match(/\/(html|css|scss|markdown|xml)\./)) {
        return "vendor-shiki-lang-web";
      }
      // Scripting languages
      if (id.match(/\/(python|ruby|php|bash|shell)\./)) {
        return "vendor-shiki-lang-script";
      }
      // Systems languages
      if (id.match(/\/(rust|go|c|cpp|java|kotlin|swift)\./)) {
        return "vendor-shiki-lang-systems";
      }
      // Everything else - rarely used
      return "vendor-shiki-lang-other";
    }
    // Core shiki engine
    return "vendor-shiki-core";
  }

  // Marked markdown parser
  if (id.includes("marked")) {
    return "vendor-marked";
  }

  // Kobalte UI components
  if (id.includes("@kobalte")) {
    return "vendor-kobalte";
  }

  // Solid.js ecosystem (core + router + primitives)
  if (
    id.includes("solid-js") ||
    id.includes("@solidjs/router") ||
    id.includes("@solid-primitives")
  ) {
    return "vendor-solid";
  }

  // Solid icons - Many icon components
  if (id.includes("solid-icons")) {
    return "vendor-icons";
  }

  // Tauri plugins - Group all Tauri-related code
  if (id.includes("@tauri-apps")) {
    return "vendor-tauri";
  }

  // Diff library
  if (id.includes("node_modules/diff")) {
    return "vendor-diff";
  }

  // Generic node_modules fallback (small remaining dependencies)
  if (id.includes("node_modules")) {
    return "vendor-common";
  }

  return undefined;
}

export default defineConfig(async (): Promise<UserConfig> => ({
  plugins: [
    solid({
      // Enable HMR and solid-specific optimizations
      hot: true,
      // Include solid-icons in JSX transformation (fixes "React is not defined")
      include: [
        /\.tsx$/,
        /\.jsx$/,
        /solid-icons/,
      ],
    }),
    tailwindcss(),
    // Bundle analyzer - only in analyze mode
    isAnalyze && visualizer({
      open: true,
      filename: "dist/bundle-stats.html",
      gzipSize: true,
      brotliSize: true,
      template: "treemap",
    }),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Optimize module resolution
    dedupe: ["solid-js", "@solidjs/router"],
  },

  // Dependency optimization for dev server
  optimizeDeps: {
    // Only include pure JS dependencies (no JSX)
    include: [
      "marked",
      "diff",
    ],
    // Exclude solid-icons - it needs JSX transformation
    exclude: ["solid-icons"],
    // Aggressive esbuild optimization
    esbuildOptions: {
      target: "esnext",
      treeShaking: true,
      // Minify pre-bundled deps for faster parsing
      minify: true,
      // Keep names for debugging
      keepNames: true,
    },
    // Don't wait for first request - prebundle immediately
    noDiscovery: false,
    // Hold until deps are optimized
    holdUntilCrawlEnd: true,
  },

  // Build configuration
  build: {
    // Use esbuild for faster minification (default in Vite 5+, but explicit)
    minify: "esbuild",
    // Target modern browsers for smaller bundles
    target: "esnext",
    // Enable source maps for production debugging (optional, remove for smaller builds)
    sourcemap: false,
    // CSS code splitting
    cssCodeSplit: true,
    // Increase chunk size warning limit (Monaco is large)
    chunkSizeWarningLimit: 1000,
    // CRITICAL: Disable modulepreload polyfill to prevent heavy chunks from being preloaded
    // This allows lazy chunks (AppCore, contexts) to load AFTER first paint
    modulePreload: {
      // Only preload essential entry chunks, not lazy-loaded ones
      resolveDependencies: (filename, deps) => {
        // Don't preload heavy app chunks - they should load lazily
        const heavyChunks = [
          'app-context-debug',
          'app-context-tasks', 
          'app-context-terminals',
          'app-context-testing',
          'app-context-lsp',
          'app-context-extensions',
          'app-extension-host',
          'AppCore',
          'vendor-monaco',
          'vendor-shiki',
          'vendor-xterm',
        ];
        return deps.filter(dep => 
          !heavyChunks.some(chunk => dep.includes(chunk))
        );
      },
    },
    // Rollup-specific options
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal caching
        manualChunks: createManualChunks,
        // Use content hashing for cache busting
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        // Optimize chunk loading
        compact: true,
        // Preserve module structure for better tree-shaking
        preserveModules: false,
        // Minimize side effects
        hoistTransitiveImports: true,
      },
      // Tree-shake unused exports
      treeshake: {
        // Aggressive tree-shaking
        moduleSideEffects: (id) => {
          // CSS files have side effects
          if (id.endsWith(".css")) return true;
          // Tauri plugins may have side effects
          if (id.includes("@tauri-apps")) return true;
          // Everything else is tree-shakeable
          return false;
        },
        // Remove unused property reads
        propertyReadSideEffects: false,
        // Remove annotations from output
        annotations: true,
      },
    },
    // Report compressed size for better insights
    reportCompressedSize: true,
  },

  // CSS configuration
  css: {
    // CSS modules configuration
    modules: {
      // Generate scoped class names in production
      generateScopedName: "[hash:base64:8]",
      // Local scope by default
      scopeBehaviour: "local",
    },
    // PostCSS/preprocessor options
    devSourcemap: true,
  },

  // Esbuild configuration
  esbuild: {
    // Remove console.log and debugger in production
    drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
    // Target modern browsers
    target: "esnext",
    // Enable tree-shaking
    treeShaking: true,
    // Legal comments handling
    legalComments: "none",
  },

  // Clear screen disabled for Tauri integration
  clearScreen: false,

  // Development server configuration
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    // Warm up ALL critical files for instant navigation
    warmup: {
      // Pre-transform critical entry points and frequently used modules
      clientFiles: [
        // Entry points
        "./src/index.tsx",
        // Pages
        "./src/pages/Home.tsx",
        "./src/pages/Session.tsx",
        // Core layout
        "./src/components/MenuBar.tsx",
        "./src/components/cortex/CortexDesktopLayout.tsx",
        // All providers (critical for startup)
        "./src/context/OptimizedProviders.tsx",
        "./src/context/ThemeContext.tsx",
        "./src/context/SDKContext.tsx",
        "./src/context/SessionContext.tsx",
        "./src/context/SettingsContext.tsx",
        "./src/context/LayoutContext.tsx",
        "./src/context/WindowsContext.tsx",
        "./src/context/ToastContext.tsx",
        "./src/context/EditorContext.tsx",
        "./src/context/WorkspaceContext.tsx",
        "./src/context/CommandContext.tsx",
        "./src/context/KeymapContext.tsx",
        // Design system
        "./src/design-system/tokens/index.ts",
        "./src/design-system/primitives/Flex.tsx",
      ],
    },
    // Pre-warm dependencies
    preTransformRequests: true,
  },

  // Preview server (for testing production builds)
  preview: {
    port: 1421,
    strictPort: true,
    host: host || false,
  },

  // Worker configuration for web workers
  worker: {
    format: "es",
    rollupOptions: {
      output: {
        entryFileNames: "assets/worker-[name]-[hash].js",
      },
    },
  },

  // JSON handling optimization
  json: {
    // Enable named exports for tree-shaking JSON imports
    namedExports: true,
    // Stringify JSON for smaller bundles
    stringify: true,
  },

  // Define global constants (dead code elimination)
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== "production"),
    __VERSION__: JSON.stringify(process.env.npm_package_version || "0.1.0"),
  },
}));

