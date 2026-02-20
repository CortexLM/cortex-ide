import {
  createContext,
  useContext,
  ParentProps,
  createSignal,
  createEffect,
  onMount,
  onCleanup,
  Accessor,
  batch,
} from "solid-js";
import { createStore } from "solid-js/store";

// ============================================================================
// Accessibility Type Definitions
// ============================================================================

/** Audio signal types for audible feedback */
export type AudioSignalType =
  | "error"
  | "warning"
  | "success"
  | "breakpointHit"
  | "taskComplete"
  | "notification";

/** Font scale options */
export type FontScale = 0.8 | 0.9 | 1.0 | 1.1 | 1.2 | 1.3 | 1.4 | 1.5;

/** Focus indicator style options */
export type FocusIndicatorStyle = "default" | "high-visibility" | "custom";

/** Accessibility state */
export interface AccessibilityState {
  /** Screen reader mode enabled - enhances ARIA attributes and announcements */
  screenReaderMode: boolean;
  /** Respects user's reduced motion preference */
  reducedMotion: boolean;
  /** High contrast mode for better visibility */
  highContrastMode: boolean;
  /** Font scaling factor (1.0 = 100%) */
  fontScale: FontScale;
  /** Focus indicator style */
  focusIndicatorStyle: FocusIndicatorStyle;
  /** Audio signals enabled for various events */
  audioSignalsEnabled: boolean;
  /** Individual audio signal settings */
  audioSignals: {
    error: boolean;
    warning: boolean;
    success: boolean;
    breakpointHit: boolean;
    taskComplete: boolean;
    notification: boolean;
  };
  /** Audio volume (0-1) */
  audioVolume: number;
  /** Live region for screen reader announcements */
  liveRegionPoliteness: "polite" | "assertive";
  /** Skip link enabled for keyboard navigation */
  skipLinkEnabled: boolean;
  /** Focus trap in modals */
  focusTrapEnabled: boolean;
  /** Keyboard navigation hints visible */
  keyboardHintsVisible: boolean;
}

/** Audio signal frequencies in Hz for different signal types */
const AUDIO_FREQUENCIES: Record<AudioSignalType, number[]> = {
  error: [200, 150],
  warning: [400, 350, 400],
  success: [523, 659, 784],
  breakpointHit: [440, 550],
  taskComplete: [523, 659, 784, 1047],
  notification: [800, 600],
};

/** Audio signal durations in milliseconds */
const AUDIO_DURATIONS: Record<AudioSignalType, number[]> = {
  error: [200, 300],
  warning: [100, 100, 200],
  success: [100, 100, 200],
  breakpointHit: [150, 150],
  taskComplete: [100, 100, 100, 300],
  notification: [100, 150],
};

/** Storage key for persisting accessibility settings */
const STORAGE_KEY = "cortex_accessibility_settings";

/** Default accessibility state */
const DEFAULT_STATE: AccessibilityState = {
  screenReaderMode: false,
  reducedMotion: false,
  highContrastMode: false,
  fontScale: 1.0,
  focusIndicatorStyle: "default",
  audioSignalsEnabled: false,
  audioSignals: {
    error: true,
    warning: true,
    success: true,
    breakpointHit: true,
    taskComplete: true,
    notification: true,
  },
  audioVolume: 0.5,
  liveRegionPoliteness: "polite",
  skipLinkEnabled: true,
  focusTrapEnabled: true,
  keyboardHintsVisible: false,
};

// ============================================================================
// Context Value Interface
// ============================================================================

export interface AccessibilityContextValue {
  /** Current accessibility state */
  state: AccessibilityState;

  /** Accessors for reactive properties */
  screenReaderMode: Accessor<boolean>;
  reducedMotion: Accessor<boolean>;
  highContrastMode: Accessor<boolean>;
  fontScale: Accessor<FontScale>;
  focusIndicatorStyle: Accessor<FocusIndicatorStyle>;
  audioSignalsEnabled: Accessor<boolean>;
  audioVolume: Accessor<number>;
  keyboardHintsVisible: Accessor<boolean>;

  /** Toggle screen reader mode */
  toggleScreenReaderMode: () => void;

  /** Toggle high contrast mode */
  toggleHighContrast: () => void;

  /** Set font scale (0.8 to 1.5) */
  setFontScale: (scale: FontScale) => void;

  /** Play an audio signal */
  playSignal: (type: AudioSignalType) => void;

  /** Announce a message to screen readers */
  announceToScreenReader: (message: string, politeness?: "polite" | "assertive") => void;

  /** Toggle reduced motion preference */
  toggleReducedMotion: () => void;

  /** Toggle audio signals */
  toggleAudioSignals: () => void;

  /** Set individual audio signal enabled/disabled */
  setAudioSignalEnabled: (type: AudioSignalType, enabled: boolean) => void;

  /** Set audio volume (0-1) */
  setAudioVolume: (volume: number) => void;

  /** Set focus indicator style */
  setFocusIndicatorStyle: (style: FocusIndicatorStyle) => void;

  /** Toggle keyboard hints visibility */
  toggleKeyboardHints: () => void;

  /** Set live region politeness */
  setLiveRegionPoliteness: (politeness: "polite" | "assertive") => void;

  /** Reset all accessibility settings to defaults */
  resetToDefaults: () => void;

  /** Export settings as JSON */
  exportSettings: () => string;

  /** Import settings from JSON */
  importSettings: (json: string) => boolean;

  /** Get CSS custom properties for font scaling */
  getFontScaleStyles: () => Record<string, string>;

  /** Check if system prefers reduced motion */
  systemPrefersReducedMotion: Accessor<boolean>;
}

// ============================================================================
// Context
// ============================================================================

const AccessibilityContext = createContext<AccessibilityContextValue>();

// ============================================================================
// Audio Context Singleton
// ============================================================================

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch (e) {
      console.warn("[Accessibility] Web Audio API not available:", e);
      return null;
    }
  }

  // Resume if suspended
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {
      // Ignore resume failures - user interaction may be required
    });
  }

  return audioContext;
}

// ============================================================================
// Provider Component
// ============================================================================

export function AccessibilityProvider(props: ParentProps) {
  // Load persisted state
  const loadPersistedState = (): Partial<AccessibilityState> => {
    if (typeof localStorage === "undefined") return {};
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("[Accessibility] Failed to load settings:", e);
    }
    return {};
  };

  // Initialize state with persisted values
  const [state, setState] = createStore<AccessibilityState>({
    ...DEFAULT_STATE,
    ...loadPersistedState(),
  });

  // Reactive accessors
  const [screenReaderMode, setScreenReaderMode] = createSignal(state.screenReaderMode);
  const [reducedMotion, setReducedMotion] = createSignal(state.reducedMotion);
  const [highContrastMode, setHighContrastMode] = createSignal(state.highContrastMode);
  const [fontScale, setFontScaleSignal] = createSignal<FontScale>(state.fontScale);
  const [focusIndicatorStyle, setFocusIndicatorStyleSignal] = createSignal<FocusIndicatorStyle>(state.focusIndicatorStyle);
  const [audioSignalsEnabled, setAudioSignalsEnabled] = createSignal(state.audioSignalsEnabled);
  const [audioVolume, setAudioVolumeSignal] = createSignal(state.audioVolume);
  const [keyboardHintsVisible, setKeyboardHintsVisible] = createSignal(state.keyboardHintsVisible);
  const [systemPrefersReducedMotion, setSystemPrefersReducedMotion] = createSignal(false);

  // Screen reader live region element reference
  let liveRegion: HTMLDivElement | null = null;

  // Persist state changes
  const persistState = () => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("[Accessibility] Failed to persist settings:", e);
    }
  };

  // Sync signals with store
  createEffect(() => {
    setScreenReaderMode(state.screenReaderMode);
    setReducedMotion(state.reducedMotion);
    setHighContrastMode(state.highContrastMode);
    setFontScaleSignal(state.fontScale);
    setFocusIndicatorStyleSignal(state.focusIndicatorStyle);
    setAudioSignalsEnabled(state.audioSignalsEnabled);
    setAudioVolumeSignal(state.audioVolume);
    setKeyboardHintsVisible(state.keyboardHintsVisible);
  });

  // Apply styles to document
  createEffect(() => {
    const root = document.documentElement;

    // High contrast mode
    root.classList.toggle("high-contrast", state.highContrastMode);

    // Reduced motion
    root.classList.toggle("reduced-motion", state.reducedMotion);

    // Screen reader mode
    root.classList.toggle("screen-reader-mode", state.screenReaderMode);

    // Focus indicator style
    root.dataset.focusIndicator = state.focusIndicatorStyle;

    // Font scale
    root.style.setProperty("--accessibility-font-scale", String(state.fontScale));
    root.style.fontSize = `${state.fontScale * 100}%`;

    // Persist changes
    persistState();
  });

  // Create live region for screen reader announcements
  onMount(() => {
    // Create live region if it doesn't exist
    if (!document.getElementById("accessibility-live-region")) {
      liveRegion = document.createElement("div");
      liveRegion.id = "accessibility-live-region";
      liveRegion.setAttribute("aria-live", state.liveRegionPoliteness);
      liveRegion.setAttribute("aria-atomic", "true");
      liveRegion.setAttribute("role", "status");
      liveRegion.style.cssText = `
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      `;
      document.body.appendChild(liveRegion);
    } else {
      liveRegion = document.getElementById("accessibility-live-region") as HTMLDivElement;
    }

    // Check system preference for reduced motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystemPrefersReducedMotion(mediaQuery.matches);

    const handleMediaChange = (e: MediaQueryListEvent) => {
      setSystemPrefersReducedMotion(e.matches);
      // Auto-enable reduced motion if system prefers it
      if (e.matches && !state.reducedMotion) {
        setState("reducedMotion", true);
      }
    };

    mediaQuery.addEventListener("change", handleMediaChange);

    // Inject accessibility CSS
    injectAccessibilityStyles();

    onCleanup(() => {
      mediaQuery.removeEventListener("change", handleMediaChange);
    });
  });

  // Inject CSS styles for accessibility features
  const injectAccessibilityStyles = () => {
    if (document.getElementById("accessibility-styles")) return;

    const styleEl = document.createElement("style");
    styleEl.id = "accessibility-styles";
    styleEl.textContent = `
      /* Reduced motion */
      .reduced-motion *,
      .reduced-motion *::before,
      .reduced-motion *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }

      /* High contrast mode */
      .high-contrast {
        --background-base: #000000 !important;
        --surface-base: #2B2D30 !important;
        --surface-raised: #1a1a1a !important;
        --text-base: #ffffff !important;
        --text-weak: #e0e0e0 !important;
        --border-base: #ffffff !important;
        --border-weak: #cccccc !important;
        --accent: #00ffff !important;
        --accent-alpha: rgba(0, 255, 255, 0.2) !important;
        --error: #ff6b6b !important;
        --warning: #ffd93d !important;
        --success: #6bff6b !important;
      }

      .high-contrast a,
      .high-contrast button {
        text-decoration: underline !important;
      }

      .high-contrast *:focus {
        outline: 3px solid #00ffff !important;
        outline-offset: 2px !important;
      }

      /* High visibility focus indicator */
      [data-focus-indicator="high-visibility"] *:focus {
        outline: 3px solid var(--accent, #6366f1) !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.3) !important;
      }

      [data-focus-indicator="high-visibility"] *:focus:not(:focus-visible) {
        outline: none !important;
        box-shadow: none !important;
      }

      [data-focus-indicator="high-visibility"] *:focus-visible {
        outline: 3px solid var(--accent, #6366f1) !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.3) !important;
      }

      /* Custom focus indicator */
      [data-focus-indicator="custom"] *:focus-visible {
        outline: 2px dashed var(--accent, #6366f1) !important;
        outline-offset: 4px !important;
      }

      /* Screen reader mode - ensure all interactive elements have visible focus */
      .screen-reader-mode *:focus {
        outline: 2px solid var(--accent, #6366f1) !important;
        outline-offset: 2px !important;
      }

      /* Skip link styles */
      .skip-link {
        position: fixed;
        top: -100px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 99999;
        padding: 12px 24px;
        background: var(--surface-raised, #1a1a1a);
        color: var(--text-base, #ffffff);
        border: 2px solid var(--accent, #6366f1);
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
        transition: top 0.2s ease;
      }

      .skip-link:focus {
        top: 16px;
        outline: none;
      }

      /* Keyboard hints */
      .keyboard-hint {
        display: none;
        position: absolute;
        padding: 2px 6px;
        font-size: 11px;
        font-family: monospace;
        background: var(--surface-raised, #1a1a1a);
        color: var(--text-weak, #a0a0a0);
        border: 1px solid var(--border-weak, #333);
        border-radius: 4px;
        pointer-events: none;
        z-index: 9999;
      }

      .keyboard-hints-visible .keyboard-hint {
        display: block;
      }

      /* Visually hidden but accessible */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `;
    document.head.appendChild(styleEl);
  };

  // Play audio signal using Web Audio API
  const playSignal = (type: AudioSignalType) => {
    if (!state.audioSignalsEnabled || !state.audioSignals[type]) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const frequencies = AUDIO_FREQUENCIES[type];
    const durations = AUDIO_DURATIONS[type];
    const volume = state.audioVolume;

    let startTime = ctx.currentTime;

    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, startTime);

      // Fade in/out to prevent clicks
      const duration = durations[index] / 1000;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume * 0.3, startTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);

      startTime += duration;
    });
  };

  // Announce message to screen readers
  const announceToScreenReader = (message: string, politeness?: "polite" | "assertive") => {
    if (!liveRegion) return;

    const effectivePoliteness = politeness || state.liveRegionPoliteness;
    liveRegion.setAttribute("aria-live", effectivePoliteness);

    // Clear and set message to trigger announcement
    liveRegion.textContent = "";
    requestAnimationFrame(() => {
      if (liveRegion) {
        liveRegion.textContent = message;
      }
    });

    // Dispatch custom event for logging/debugging
    window.dispatchEvent(
      new CustomEvent("accessibility:announcement", {
        detail: { message, politeness: effectivePoliteness },
      })
    );
  };

  // Toggle functions
  const toggleScreenReaderMode = () => {
    batch(() => {
      setState("screenReaderMode", (prev) => !prev);
      const newState = state.screenReaderMode;
      announceToScreenReader(
        newState
          ? "Screen reader mode enabled. Enhanced navigation and announcements active."
          : "Screen reader mode disabled."
      );
    });
  };

  const toggleHighContrast = () => {
    batch(() => {
      setState("highContrastMode", (prev) => !prev);
      announceToScreenReader(
        state.highContrastMode ? "High contrast mode enabled." : "High contrast mode disabled."
      );
    });
  };

  const toggleReducedMotion = () => {
    batch(() => {
      setState("reducedMotion", (prev) => !prev);
      announceToScreenReader(
        state.reducedMotion ? "Reduced motion enabled." : "Reduced motion disabled."
      );
    });
  };

  const toggleAudioSignals = () => {
    setState("audioSignalsEnabled", (prev) => !prev);
    if (state.audioSignalsEnabled) {
      // Play a test signal when enabling
      playSignal("success");
    }
  };

  const toggleKeyboardHints = () => {
    batch(() => {
      setState("keyboardHintsVisible", (prev) => !prev);
      document.body.classList.toggle("keyboard-hints-visible", state.keyboardHintsVisible);
      announceToScreenReader(
        state.keyboardHintsVisible ? "Keyboard hints visible." : "Keyboard hints hidden."
      );
    });
  };

  // Setter functions
  const setFontScale = (scale: FontScale) => {
    setState("fontScale", scale);
    announceToScreenReader(`Font size set to ${Math.round(scale * 100)} percent.`);
  };

  const setAudioSignalEnabled = (type: AudioSignalType, enabled: boolean) => {
    setState("audioSignals", type, enabled);
  };

  const setAudioVolume = (volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setState("audioVolume", clampedVolume);
  };

  const setFocusIndicatorStyle = (style: FocusIndicatorStyle) => {
    setState("focusIndicatorStyle", style);
    announceToScreenReader(`Focus indicator style set to ${style}.`);
  };

  const setLiveRegionPoliteness = (politeness: "polite" | "assertive") => {
    setState("liveRegionPoliteness", politeness);
    if (liveRegion) {
      liveRegion.setAttribute("aria-live", politeness);
    }
  };

  // Reset to defaults
  const resetToDefaults = () => {
    batch(() => {
      Object.entries(DEFAULT_STATE).forEach(([key, value]) => {
        setState(key as keyof AccessibilityState, value as AccessibilityState[keyof AccessibilityState]);
      });
    });
    announceToScreenReader("Accessibility settings reset to defaults.");
  };

  // Export settings
  const exportSettings = (): string => {
    return JSON.stringify(state, null, 2);
  };

  // Import settings
  const importSettings = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed === "object" && parsed !== null) {
        batch(() => {
          Object.entries(parsed).forEach(([key, value]) => {
            if (key in DEFAULT_STATE) {
              setState(key as keyof AccessibilityState, value as AccessibilityState[keyof AccessibilityState]);
            }
          });
        });
        announceToScreenReader("Accessibility settings imported successfully.");
        return true;
      }
    } catch (e) {
      console.error("[Accessibility] Failed to import settings:", e);
    }
    return false;
  };

  // Get font scale CSS custom properties
  const getFontScaleStyles = (): Record<string, string> => {
    const scale = state.fontScale;
    return {
      "--font-size-xs": `${10 * scale}px`,
      "--font-size-sm": `${12 * scale}px`,
      "--font-size-base": `${14 * scale}px`,
      "--font-size-lg": `${16 * scale}px`,
      "--font-size-xl": `${18 * scale}px`,
      "--font-size-2xl": `${20 * scale}px`,
      "--font-size-3xl": `${24 * scale}px`,
    };
  };

  const contextValue: AccessibilityContextValue = {
    state,
    screenReaderMode,
    reducedMotion,
    highContrastMode,
    fontScale,
    focusIndicatorStyle,
    audioSignalsEnabled,
    audioVolume,
    keyboardHintsVisible,
    toggleScreenReaderMode,
    toggleHighContrast,
    setFontScale,
    playSignal,
    announceToScreenReader,
    toggleReducedMotion,
    toggleAudioSignals,
    setAudioSignalEnabled,
    setAudioVolume,
    setFocusIndicatorStyle,
    toggleKeyboardHints,
    setLiveRegionPoliteness,
    resetToDefaults,
    exportSettings,
    importSettings,
    getFontScaleStyles,
    systemPrefersReducedMotion,
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {/* Skip link for keyboard navigation */}
      {state.skipLinkEnabled && (
        <a href="#main-content" class="skip-link">
          Skip to main content
        </a>
      )}
      {props.children}
    </AccessibilityContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useAccessibility(): AccessibilityContextValue {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider");
  }
  return context;
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Hook for using audio signals
 * @returns Function to play audio signals
 */
export function useAudioSignal() {
  const { playSignal, audioSignalsEnabled } = useAccessibility();
  return {
    play: playSignal,
    isEnabled: audioSignalsEnabled,
  };
}

/**
 * Hook for screen reader announcements
 * @returns Function to announce messages
 */
export function useAnnounce() {
  const { announceToScreenReader } = useAccessibility();
  return announceToScreenReader;
}

/**
 * Hook for checking motion preference
 * @returns Whether reduced motion is active
 */
export function useReducedMotion() {
  const { reducedMotion, systemPrefersReducedMotion } = useAccessibility();
  return () => reducedMotion() || systemPrefersReducedMotion();
}

/**
 * Hook for font scaling
 * @returns Current font scale and setter
 */
export function useFontScale() {
  const { fontScale, setFontScale, getFontScaleStyles } = useAccessibility();
  return {
    scale: fontScale,
    setScale: setFontScale,
    styles: getFontScaleStyles,
  };
}
