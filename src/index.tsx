import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { lazy, Suspense } from "solid-js";
import { initializeWindowStorage } from "@/utils/windowStorage";

// CRITICAL: Use AppShell instead of App for instant first paint
// AppShell is minimal (~1KB) and lazy-loads AppCore (with 68 providers) after render
import AppShell from "./AppShell";
import "@/styles/index.css";

// ============================================================================
// PERFORMANCE TRACKING: Startup Metrics
// ============================================================================
const STARTUP_METRICS = {
  scriptStart: performance.now(),
  windowStorageInit: 0,
  renderStart: 0,
  firstPaint: 0,
};

// Log startup progress with timestamps
function logStartup(phase: string) {
  if (!import.meta.env.DEV) return;
  const elapsed = (performance.now() - STARTUP_METRICS.scriptStart).toFixed(1);
  console.log(`[STARTUP] ${phase} @ ${elapsed}ms`);
}

logStartup("Script executing");

// ============================================================================
// STARTUP OPTIMIZATION: Window Storage Initialization
// ============================================================================
// Initialize window-specific storage synchronously (required for routing)
// This is on the critical path and must complete before render
logStartup("Window storage init start");
initializeWindowStorage();
STARTUP_METRICS.windowStorageInit = performance.now();
logStartup("Window storage init done");

// ============================================================================
// DEFERRED PRELOADING: Non-critical resources loaded during idle time
// ============================================================================
// These resources are not needed for initial render but improve UX when accessed.
// Loading during idle time prevents blocking the main thread during startup.

// Monaco and Shiki are NOT preloaded here — they load on demand:
// - Monaco loads when the user first opens/focuses an editor tab
// - Shiki loads when a code block first appears in AI chat or file preview
// This keeps the main bundle lean and avoids blocking startup.

// ============================================================================
// CODE SPLITTING: Lazy-loaded Pages
// ============================================================================
// Pages are lazy-loaded to reduce initial bundle size.
// Each page chunk is loaded on-demand when the route is accessed.

// Home page - routing hub that redirects to /welcome
const Home = lazy(() => import("./pages/Home"));

// Welcome page - full welcome screen with branding, recent projects, quick actions
const Welcome = lazy(() => import("./pages/Welcome"));

// Session page - only loaded when user navigates to a session
// Uses dynamic import with explicit chunk name for better caching
const Session = lazy(() => import("./pages/Session"));

// Layout component - Figma pixel-perfect design (replaces old Layout.tsx)
const Layout = lazy(() => import("@/components/cortex/CortexDesktopLayout").then(m => ({ default: m.CortexDesktopLayout })));

// ============================================================================
// INITIAL RENDER OPTIMIZATION: Minimal Fallback
// ============================================================================
// Ultra-minimal fallback that renders immediately without external dependencies.
// Uses inline styles to avoid CSS loading delays.
// The spinner animation is inlined to avoid FOUC.
const MinimalFallback = () => (
  <div style={{ 
    "min-height": "100vh", 
    background: "#131217",
    display: "flex",
    "align-items": "center",
    "justify-content": "center"
  }}>
    <div style={{ 
      width: "24px", 
      height: "24px", 
      border: "2px solid rgba(255,255,255,0.1)",
      "border-top-color": "#BFFF00",
      "border-radius": "50%",
      animation: "spin 0.8s linear infinite"
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ============================================================================
// APPLICATION RENDER
// ============================================================================
// The render is structured to:
// 1. Mount App immediately (provides context providers)
// 2. Show MinimalFallback while Layout and pages load
// 3. Progressively render content as chunks arrive

logStartup("Render start");
STARTUP_METRICS.renderStart = performance.now();

// Track first paint and cleanup
requestAnimationFrame(() => {
  STARTUP_METRICS.firstPaint = performance.now();
  logStartup("First paint (RAF)");
  
  // Remove the initial HTML loader (from index.html)
  const initialLoader = document.getElementById("initial-loader");
  if (initialLoader) {
    initialLoader.style.opacity = "0";
    initialLoader.style.transition = "opacity 150ms ease-out";
    setTimeout(() => initialLoader.remove(), 150);
  }
  
  // Emit frontend:ready event to backend for metrics
  import("@tauri-apps/api/event").then(({ emit }) => {
    const startupTime = performance.now() - STARTUP_METRICS.scriptStart;
    emit("frontend:ready", { startupTime }).catch(() => {
      // Silent fail - not critical
    });
    logStartup(`frontend:ready emitted (${startupTime.toFixed(1)}ms)`);
  }).catch(() => {
    // Not in Tauri context (browser dev)
  });
  
  // Log final startup summary
  if (import.meta.env.DEV) {
    setTimeout(() => {
      const total = performance.now() - STARTUP_METRICS.scriptStart;
      console.log(`[STARTUP SUMMARY]
  Total time: ${total.toFixed(1)}ms
  Window storage: ${(STARTUP_METRICS.windowStorageInit - STARTUP_METRICS.scriptStart).toFixed(1)}ms
  Render phase: ${(STARTUP_METRICS.firstPaint - STARTUP_METRICS.renderStart).toFixed(1)}ms
  `);
    }, 100);
  }
});

render(
  () => (
    <Router root={AppShell}>
      {/* All routes use CortexDesktopLayout */}
      <Route path="*all" component={(props) => (
        <Suspense fallback={<MinimalFallback />}>
          <Layout>{props.children}</Layout>
        </Suspense>
      )}>
        <Route path="/" component={Home} />
        <Route path="/index.html" component={Home} />
        <Route path="/welcome" component={Welcome} />
        <Route path="/session/:id?" component={Session} />
      </Route>
    </Router>
  ),
  document.getElementById("root")!
);

