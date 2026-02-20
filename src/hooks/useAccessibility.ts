/**
 * useAccessibility - Media queries for reduced motion, high contrast, and color scheme
 *
 * Provides reactive signals for common accessibility-related CSS media queries.
 * Automatically listens for changes and cleans up event listeners on unmount.
 *
 * Features:
 * - Reduced motion preference detection
 * - High contrast (forced colors) detection
 * - Dark mode preference detection
 * - Increased contrast preference detection
 * - Automatic event listener cleanup
 * - SSR-safe with fallback values
 *
 * @example
 * ```tsx
 * function App() {
 *   const {
 *     prefersReducedMotion, prefersHighContrast,
 *     prefersDarkMode, prefersMoreContrast,
 *   } = useAccessibility();
 *
 *   return (
 *     <div
 *       class={prefersDarkMode() ? "dark-theme" : "light-theme"}
 *       style={{
 *         "transition-duration": prefersReducedMotion() ? "0ms" : "300ms",
 *       }}
 *     >
 *       <Show when={prefersHighContrast()}>
 *         <HighContrastOverlay />
 *       </Show>
 *       <MainContent />
 *     </div>
 *   );
 * }
 * ```
 */

import {
  createSignal,
  onMount,
  onCleanup,
  type Accessor,
} from "solid-js";

// ============================================================================
// Types
// ============================================================================

/** Return type for useAccessibility hook */
export interface UseAccessibilityReturn {
  /** Whether the user prefers reduced motion */
  prefersReducedMotion: Accessor<boolean>;
  /** Whether the user has forced colors / high contrast mode active */
  prefersHighContrast: Accessor<boolean>;
  /** Whether the user prefers a dark color scheme */
  prefersDarkMode: Accessor<boolean>;
  /** Whether the user prefers more contrast */
  prefersMoreContrast: Accessor<boolean>;
}

// ============================================================================
// Helpers
// ============================================================================

/** Media query strings for accessibility preferences */
const MEDIA_QUERIES = {
  reducedMotion: "(prefers-reduced-motion: reduce)",
  highContrast: "(forced-colors: active)",
  darkMode: "(prefers-color-scheme: dark)",
  moreContrast: "(prefers-contrast: more)",
} as const;

/**
 * Create a signal that tracks a media query match state
 */
function createMediaQuerySignal(
  query: string
): [Accessor<boolean>, (mql: MediaQueryList) => () => void] {
  const initialMatch =
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = createSignal<boolean>(initialMatch);

  const subscribe = (mql: MediaQueryList): (() => void) => {
    const listener = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };

    if (mql.addEventListener) {
      mql.addEventListener("change", listener);
      return () => mql.removeEventListener("change", listener);
    }

    mql.addListener(listener);
    return () => mql.removeListener(listener);
  };

  return [matches, subscribe];
}

// ============================================================================
// useAccessibility Hook
// ============================================================================

/**
 * Hook for detecting user accessibility preferences via CSS media queries.
 *
 * @returns Object with reactive signals for each accessibility preference
 *
 * @example
 * ```tsx
 * const { prefersReducedMotion, prefersDarkMode } = useAccessibility();
 *
 * createEffect(() => {
 *   if (prefersReducedMotion()) {
 *     disableAnimations();
 *   }
 * });
 * ```
 */
export function useAccessibility(): UseAccessibilityReturn {
  const [prefersReducedMotion, subscribeReducedMotion] = createMediaQuerySignal(
    MEDIA_QUERIES.reducedMotion
  );
  const [prefersHighContrast, subscribeHighContrast] = createMediaQuerySignal(
    MEDIA_QUERIES.highContrast
  );
  const [prefersDarkMode, subscribeDarkMode] = createMediaQuerySignal(
    MEDIA_QUERIES.darkMode
  );
  const [prefersMoreContrast, subscribeMoreContrast] = createMediaQuerySignal(
    MEDIA_QUERIES.moreContrast
  );

  onMount(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const cleanups: (() => void)[] = [];

    const reducedMotionMql = window.matchMedia(MEDIA_QUERIES.reducedMotion);
    cleanups.push(subscribeReducedMotion(reducedMotionMql));

    const highContrastMql = window.matchMedia(MEDIA_QUERIES.highContrast);
    cleanups.push(subscribeHighContrast(highContrastMql));

    const darkModeMql = window.matchMedia(MEDIA_QUERIES.darkMode);
    cleanups.push(subscribeDarkMode(darkModeMql));

    const moreContrastMql = window.matchMedia(MEDIA_QUERIES.moreContrast);
    cleanups.push(subscribeMoreContrast(moreContrastMql));

    onCleanup(() => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    });
  });

  return {
    prefersReducedMotion,
    prefersHighContrast,
    prefersDarkMode,
    prefersMoreContrast,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default useAccessibility;
