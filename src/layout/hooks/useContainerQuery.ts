/**
 * =============================================================================
 * USE CONTAINER QUERY - Container query hook for responsive components
 * =============================================================================
 * 
 * This hook provides container query functionality, allowing components to
 * respond to their container's size rather than the viewport.
 * 
 * Features:
 * - ResizeObserver-based size tracking
 * - Predefined breakpoints
 * - Custom breakpoint support
 * - Debounced updates for performance
 * 
 * Usage:
 *   const [ref, setRef] = createSignal<HTMLElement>();
 *   const { size, breakpoints, matches } = useContainerQuery(ref);
 *   
 *   return (
 *     <div ref={setRef}>
 *       {breakpoints().sm && <CompactView />}
 *       {breakpoints().lg && <FullView />}
 *     </div>
 *   );
 * =============================================================================
 */

import { createSignal, createMemo, onMount, onCleanup, Accessor } from "solid-js";

// =============================================================================
// TYPES
// =============================================================================

export interface ContainerSize {
  width: number;
  height: number;
}

export interface ContainerBreakpoints {
  xs: boolean;  // < 200px
  sm: boolean;  // 200-400px
  md: boolean;  // 400-600px
  lg: boolean;  // 600-900px
  xl: boolean;  // > 900px
}

export interface CustomBreakpoint {
  name: string;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

export interface UseContainerQueryOptions {
  debounceMs?: number;
  customBreakpoints?: CustomBreakpoint[];
}

export interface UseContainerQueryReturn {
  size: Accessor<ContainerSize>;
  breakpoints: Accessor<ContainerBreakpoints>;
  matches: (breakpoint: CustomBreakpoint) => boolean;
  orientation: Accessor<"portrait" | "landscape" | "square">;
  aspectRatio: Accessor<number>;
}

// =============================================================================
// DEFAULT BREAKPOINTS
// =============================================================================

const DEFAULT_BREAKPOINTS = {
  xs: { max: 200 },
  sm: { min: 200, max: 400 },
  md: { min: 400, max: 600 },
  lg: { min: 600, max: 900 },
  xl: { min: 900 },
} as const;

// =============================================================================
// HOOK
// =============================================================================

export function useContainerQuery(
  ref: Accessor<HTMLElement | undefined>,
  options: UseContainerQueryOptions = {}
): UseContainerQueryReturn {
  const { debounceMs = 0 } = options;

  const [size, setSize] = createSignal<ContainerSize>({ width: 0, height: 0 });
  
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Compute breakpoints
  const breakpoints = createMemo((): ContainerBreakpoints => {
    const { width } = size();
    return {
      xs: width < DEFAULT_BREAKPOINTS.xs.max,
      sm: width >= DEFAULT_BREAKPOINTS.sm.min && width < DEFAULT_BREAKPOINTS.sm.max,
      md: width >= DEFAULT_BREAKPOINTS.md.min && width < DEFAULT_BREAKPOINTS.md.max,
      lg: width >= DEFAULT_BREAKPOINTS.lg.min && width < DEFAULT_BREAKPOINTS.lg.max,
      xl: width >= DEFAULT_BREAKPOINTS.xl.min,
    };
  });

  // Custom breakpoint matcher
  const matches = (breakpoint: CustomBreakpoint): boolean => {
    const { width, height } = size();
    
    if (breakpoint.minWidth !== undefined && width < breakpoint.minWidth) return false;
    if (breakpoint.maxWidth !== undefined && width >= breakpoint.maxWidth) return false;
    if (breakpoint.minHeight !== undefined && height < breakpoint.minHeight) return false;
    if (breakpoint.maxHeight !== undefined && height >= breakpoint.maxHeight) return false;
    
    return true;
  };

  // Compute orientation
  const orientation = createMemo((): "portrait" | "landscape" | "square" => {
    const { width, height } = size();
    if (width === height) return "square";
    return width > height ? "landscape" : "portrait";
  });

  // Compute aspect ratio
  const aspectRatio = createMemo((): number => {
    const { width, height } = size();
    if (height === 0) return 0;
    return width / height;
  });

  // Update size with optional debounce
  const updateSize = (width: number, height: number) => {
    if (debounceMs > 0) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setSize({ width, height });
      }, debounceMs);
    } else {
      setSize({ width, height });
    }
  };

  // Set up ResizeObserver
  onMount(() => {
    const element = ref();
    if (!element) return;

    // Initial size
    const rect = element.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });

    // Observe changes
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        updateSize(width, height);
      }
    });

    observer.observe(element);

    onCleanup(() => {
      observer.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    });
  });

  return {
    size,
    breakpoints,
    matches,
    orientation,
    aspectRatio,
  };
}

// =============================================================================
// UTILITY HOOKS
// =============================================================================

/**
 * Simple hook that just tracks container size
 */
export function useContainerSize(
  ref: Accessor<HTMLElement | undefined>
): Accessor<ContainerSize> {
  const { size } = useContainerQuery(ref);
  return size;
}

/**
 * Hook that returns true when container width is below a threshold
 */
export function useIsCompact(
  ref: Accessor<HTMLElement | undefined>,
  threshold: number = 400
): Accessor<boolean> {
  const { size } = useContainerQuery(ref);
  return createMemo(() => size().width < threshold);
}

/**
 * Hook that returns a size class based on container width
 */
export function useContainerSizeClass(
  ref: Accessor<HTMLElement | undefined>
): Accessor<"xs" | "sm" | "md" | "lg" | "xl"> {
  const { breakpoints } = useContainerQuery(ref);
  
  return createMemo(() => {
    const bp = breakpoints();
    if (bp.xs) return "xs";
    if (bp.sm) return "sm";
    if (bp.md) return "md";
    if (bp.lg) return "lg";
    return "xl";
  });
}

export default useContainerQuery;
