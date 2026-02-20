/**
 * AppShell.tsx - Minimal Shell for Fast First Paint
 * 
 * This component loads INSTANTLY because it has NO heavy dependencies.
 * It provides:
 * - Basic error boundary
 * - Minimal theme (dark background to avoid flash)
 * - Suspense wrapper for lazy-loaded AppCore
 * 
 * The heavy lifting (OptimizedProviders, 68 contexts) is deferred to AppCore
 * which loads lazily after first paint.
 */

import { ParentProps, ErrorBoundary, Suspense, lazy, createSignal, onMount } from "solid-js";

// Startup timing
const SHELL_LOAD_TIME = performance.now();
if (import.meta.env.DEV) console.log(`[STARTUP] AppShell.tsx module loading @ ${SHELL_LOAD_TIME.toFixed(1)}ms`);

// ============================================================================
// LAZY LOAD: The actual app with all providers
// ============================================================================
// This is the key optimization - AppCore (with OptimizedProviders) loads
// AFTER first paint, not during initial bundle evaluation
const AppCore = lazy(() => {
  if (import.meta.env.DEV) console.log(`[STARTUP] AppCore lazy import starting @ ${performance.now().toFixed(1)}ms`);
  return import("./AppCore").then(m => {
    if (import.meta.env.DEV) console.log(`[STARTUP] AppCore lazy import complete @ ${performance.now().toFixed(1)}ms`);
    return m;
  });
});

// ============================================================================
// MINIMAL LOADING INDICATOR
// ============================================================================
// Pure inline styles - no external CSS dependencies
// Matches the dark theme to avoid flash
function LoadingIndicator() {
  const [showSlowWarning, setShowSlowWarning] = createSignal(false);
  
  onMount(() => {
    // Show "loading..." text after 2 seconds if still loading
    const timer = setTimeout(() => setShowSlowWarning(true), 2000);
    return () => clearTimeout(timer);
  });

  return (
    <div style={{
      "min-height": "100vh",
      "min-width": "100vw",
      background: "#1e1e1e",
      display: "flex",
      "flex-direction": "column",
      "align-items": "center",
      "justify-content": "center",
      color: "#888",
      "font-family": "system-ui, -apple-system, sans-serif",
    }}>
      {/* Spinner */}
      <div style={{
        width: "32px",
        height: "32px",
        border: "3px solid rgba(255,255,255,0.1)",
        "border-top-color": "#f38518",
        "border-radius": "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      
      {/* Loading text - only shows after 2s delay */}
      {showSlowWarning() && (
        <div style={{
          "margin-top": "16px",
          "font-size": "13px",
          opacity: "0.6",
        }}>
          Loading workspace...
        </div>
      )}
      
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ============================================================================
// ERROR FALLBACK
// ============================================================================
// Minimal error display - no external dependencies
function ErrorFallback(props: { error: Error }) {
  return (
    <div style={{
      "min-height": "100vh",
      "min-width": "100vw",
      background: "#1e1e1e",
      display: "flex",
      "flex-direction": "column",
      "align-items": "center",
      "justify-content": "center",
      color: "white",
      padding: "32px",
      "font-family": "system-ui, -apple-system, sans-serif",
    }}>
      <h1 style={{
        "font-size": "20px",
        "font-weight": "bold",
        "margin-bottom": "16px",
        color: "#ef4444",
      }}>
        Application Error
      </h1>
      <pre style={{
        background: "rgba(0,0,0,0.5)",
        padding: "16px",
        "border-radius": "8px",
        "font-size": "12px",
        "max-width": "600px",
        overflow: "auto",
        border: "1px solid rgba(255,255,255,0.1)",
        "white-space": "pre-wrap",
        "word-break": "break-word",
      }}>
        {props.error.toString()}
        {"\n\n"}
        {props.error.stack}
      </pre>
      <button
        onClick={() => window.location.reload()}
        style={{
          "margin-top": "24px",
          padding: "8px 16px",
          background: "#3b82f6",
          color: "white",
          border: "none",
          "border-radius": "6px",
          cursor: "pointer",
          "font-size": "14px",
        }}
      >
        Reload Application
      </button>
    </div>
  );
}

// ============================================================================
// APP SHELL - Root component for Router
// ============================================================================
export default function AppShell(props: ParentProps) {
  if (import.meta.env.DEV) console.log(`[STARTUP] AppShell rendering @ ${performance.now().toFixed(1)}ms`);
  
  return (
    <ErrorBoundary fallback={(err) => <ErrorFallback error={err} />}>
      <Suspense fallback={<LoadingIndicator />}>
        <AppCore {...props}>{props.children}</AppCore>
      </Suspense>
    </ErrorBoundary>
  );
}
