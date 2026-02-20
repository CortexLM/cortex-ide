import { createContext, useContext, createSignal, ParentProps, onMount, onCleanup, createMemo } from "solid-js";
import { useEditor } from "./EditorContext";

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a navigation location in the editor history.
 * Tracks file, cursor position, and timestamp for navigation.
 */
export interface NavigationLocation {
  /** Full path to the file */
  filePath: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** Timestamp when this location was recorded */
  timestamp: number;
}

/** Navigation history context value */
interface NavigationHistoryContextValue {
  /** Navigate to the previous location in history */
  goBack: () => void;
  /** Navigate to the next location in history (after going back) */
  goForward: () => void;
  /** Push a new location to the history stack */
  pushLocation: (location: Omit<NavigationLocation, "timestamp">) => void;
  /** Check if we can navigate back */
  canGoBack: () => boolean;
  /** Check if we can navigate forward */
  canGoForward: () => boolean;
  /** Get the current position in the history stack (for UI display) */
  historyInfo: () => { current: number; total: number };
  /** Clear all navigation history */
  clearHistory: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of navigation locations to keep in history */
const MAX_HISTORY = 50;

/** 
 * Minimum line difference to consider a navigation as significant.
 * Prevents filling history with minor cursor movements.
 */
const SIGNIFICANT_LINE_DIFFERENCE = 5;

// ============================================================================
// Context
// ============================================================================

const NavigationHistoryContext = createContext<NavigationHistoryContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function NavigationHistoryProvider(props: ParentProps) {
  // History stack of navigation locations
  const [history, setHistory] = createSignal<NavigationLocation[]>([]);
  // Current index in the history stack (-1 means no history)
  const [currentIndex, setCurrentIndex] = createSignal(-1);
  // Flag to prevent recording navigation when we're navigating via back/forward
  const [isNavigating, setIsNavigating] = createSignal(false);
  
  const editor = useEditor();

  /**
   * Push a new location to the navigation history.
   * Ignores locations that are too close to the current location.
   */
  const pushLocation = (location: Omit<NavigationLocation, "timestamp">) => {
    // Don't record navigation while we're programmatically navigating (back/forward)
    if (isNavigating()) return;
    
    const currentHistory = history();
    const currentIdx = currentIndex();
    const currentLocation = currentIdx >= 0 ? currentHistory[currentIdx] : null;
    
    // Don't push if it's the same file and within a few lines of current location
    if (currentLocation) {
      const sameFile = currentLocation.filePath === location.filePath;
      const nearbyLine = Math.abs(currentLocation.line - location.line) < SIGNIFICANT_LINE_DIFFERENCE;
      
      if (sameFile && nearbyLine) {
        return;
      }
    }
    
    const newLocation: NavigationLocation = {
      ...location,
      timestamp: Date.now(),
    };
    
    // Truncate forward history when we add a new location (standard browser behavior)
    // Keep only history up to current index, then add the new location
    const truncatedHistory = currentHistory.slice(0, currentIdx + 1);
    const newHistory = [...truncatedHistory, newLocation].slice(-MAX_HISTORY);
    
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };

  /**
   * Navigate to a specific location in the editor.
   * Opens the file if needed and moves cursor to the specified position.
   */
  const navigateToLocation = async (location: NavigationLocation) => {
    setIsNavigating(true);
    
    try {
      // First, open the file (this will also focus it if already open)
      await editor.openFile(location.filePath);
      
      // Dispatch event to set cursor position in the editor
      // The CodeEditor component listens for this event
      window.dispatchEvent(new CustomEvent("editor:set-cursor-position", {
        detail: {
          filePath: location.filePath,
          line: location.line,
          column: location.column,
        },
      }));
    } catch (error) {
      console.error("[NavigationHistory] Failed to navigate to location:", error);
    } finally {
      // Reset navigation flag after a short delay to allow cursor position events to settle
      setTimeout(() => {
        setIsNavigating(false);
      }, 100);
    }
  };

  /**
   * Navigate back to the previous location in history.
   */
  const goBack = () => {
    const currentIdx = currentIndex();
    
    if (currentIdx > 0) {
      const newIndex = currentIdx - 1;
      setCurrentIndex(newIndex);
      navigateToLocation(history()[newIndex]);
    }
  };

  /**
   * Navigate forward to the next location in history.
   */
  const goForward = () => {
    const currentHistory = history();
    const currentIdx = currentIndex();
    
    if (currentIdx < currentHistory.length - 1) {
      const newIndex = currentIdx + 1;
      setCurrentIndex(newIndex);
      navigateToLocation(currentHistory[newIndex]);
    }
  };

  /**
   * Check if we can navigate back in history.
   */
  const canGoBack = createMemo(() => {
    return currentIndex() > 0;
  });

  /**
   * Check if we can navigate forward in history.
   */
  const canGoForward = createMemo(() => {
    return currentIndex() < history().length - 1;
  });

  /**
   * Get current history info for UI display.
   */
  const historyInfo = createMemo(() => ({
    current: currentIndex() + 1,
    total: history().length,
  }));

  /**
   * Clear all navigation history.
   */
  const clearHistory = () => {
    setHistory([]);
    setCurrentIndex(-1);
  };

  // ============================================================================
  // Event Listeners
  // ============================================================================

  onMount(() => {
    // Listen for navigation:back event (from menu, keyboard shortcuts)
    const handleNavigationBack = () => {
      goBack();
    };

    // Listen for navigation:forward event (from menu, keyboard shortcuts)
    const handleNavigationForward = () => {
      goForward();
    };

    // Listen for cursor position changes from the editor
    const handleCursorChange = (event: CustomEvent<{ filePath: string; line: number; column: number }>) => {
      const { filePath, line, column } = event.detail;
      pushLocation({ filePath, line, column });
    };

    // Listen for significant navigation events (go to definition, go to symbol, etc.)
    const handleSignificantNavigation = (event: CustomEvent<{ filePath: string; line: number; column: number }>) => {
      const { filePath, line, column } = event.detail;
      // Force push even if within line threshold (these are intentional navigations)
      const newLocation: NavigationLocation = {
        filePath,
        line,
        column,
        timestamp: Date.now(),
      };
      
      const currentHistory = history();
      const currentIdx = currentIndex();
      const truncatedHistory = currentHistory.slice(0, currentIdx + 1);
      const newHistory = [...truncatedHistory, newLocation].slice(-MAX_HISTORY);
      
      setHistory(newHistory);
      setCurrentIndex(newHistory.length - 1);
    };

    window.addEventListener("navigation:back", handleNavigationBack);
    window.addEventListener("navigation:forward", handleNavigationForward);
    window.addEventListener("editor:cursor-changed", handleCursorChange as EventListener);
    window.addEventListener("navigation:significant", handleSignificantNavigation as EventListener);

    onCleanup(() => {
      window.removeEventListener("navigation:back", handleNavigationBack);
      window.removeEventListener("navigation:forward", handleNavigationForward);
      window.removeEventListener("editor:cursor-changed", handleCursorChange as EventListener);
      window.removeEventListener("navigation:significant", handleSignificantNavigation as EventListener);
    });
  });

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: NavigationHistoryContextValue = {
    goBack,
    goForward,
    pushLocation,
    canGoBack,
    canGoForward,
    historyInfo,
    clearHistory,
  };

  return (
    <NavigationHistoryContext.Provider value={value}>
      {props.children}
    </NavigationHistoryContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useNavigationHistory() {
  const context = useContext(NavigationHistoryContext);
  if (!context) {
    throw new Error("useNavigationHistory must be used within NavigationHistoryProvider");
  }
  return context;
}
