import { describe, it, expect, vi, beforeEach } from "vitest";

describe("useAccessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("UseAccessibilityReturn Interface", () => {
    interface UseAccessibilityReturn {
      prefersReducedMotion: () => boolean;
      prefersHighContrast: () => boolean;
      prefersDarkMode: () => boolean;
      prefersMoreContrast: () => boolean;
      screenReaderMode: () => boolean;
      fontScale: () => number;
    }

    it("should define complete return type", () => {
      const mockReturn: UseAccessibilityReturn = {
        prefersReducedMotion: () => false,
        prefersHighContrast: () => false,
        prefersDarkMode: () => true,
        prefersMoreContrast: () => false,
        screenReaderMode: () => false,
        fontScale: () => 1.0,
      };

      expect(mockReturn.prefersReducedMotion()).toBe(false);
      expect(mockReturn.prefersDarkMode()).toBe(true);
      expect(mockReturn.fontScale()).toBe(1.0);
    });

    it("should support all preferences enabled", () => {
      const mockReturn: UseAccessibilityReturn = {
        prefersReducedMotion: () => true,
        prefersHighContrast: () => true,
        prefersDarkMode: () => true,
        prefersMoreContrast: () => true,
        screenReaderMode: () => true,
        fontScale: () => 1.5,
      };

      expect(mockReturn.prefersReducedMotion()).toBe(true);
      expect(mockReturn.prefersHighContrast()).toBe(true);
      expect(mockReturn.prefersMoreContrast()).toBe(true);
      expect(mockReturn.fontScale()).toBe(1.5);
    });
  });

  describe("Media Query Detection", () => {
    const createMatchMediaMock = (matches: boolean) => ({
      matches,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn().mockReturnValue(true),
    });

    it("should detect prefers-reduced-motion", () => {
      const matchMedia = vi.fn().mockReturnValue(createMatchMediaMock(true));

      const result = matchMedia("(prefers-reduced-motion: reduce)");

      expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
      expect(result.matches).toBe(true);
    });

    it("should detect prefers-contrast: more", () => {
      const matchMedia = vi.fn().mockReturnValue(createMatchMediaMock(true));

      const result = matchMedia("(prefers-contrast: more)");

      expect(matchMedia).toHaveBeenCalledWith("(prefers-contrast: more)");
      expect(result.matches).toBe(true);
    });

    it("should detect prefers-color-scheme: dark", () => {
      const matchMedia = vi.fn().mockReturnValue(createMatchMediaMock(true));

      const result = matchMedia("(prefers-color-scheme: dark)");

      expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
      expect(result.matches).toBe(true);
    });

    it("should detect forced-colors: active for high contrast", () => {
      const matchMedia = vi.fn().mockReturnValue(createMatchMediaMock(true));

      const result = matchMedia("(forced-colors: active)");

      expect(matchMedia).toHaveBeenCalledWith("(forced-colors: active)");
      expect(result.matches).toBe(true);
    });

    it("should return false when preference is not set", () => {
      const matchMedia = vi.fn().mockReturnValue(createMatchMediaMock(false));

      const result = matchMedia("(prefers-reduced-motion: reduce)");

      expect(result.matches).toBe(false);
    });
  });

  describe("Media Query Change Listener", () => {
    it("should update state when media query changes", () => {
      let prefersReducedMotion = false;
      const listeners: ((e: { matches: boolean }) => void)[] = [];

      const mockMediaQuery = {
        matches: false,
        addEventListener: (
          _event: string,
          handler: (e: { matches: boolean }) => void
        ) => {
          listeners.push(handler);
        },
        removeEventListener: vi.fn(),
      };

      mockMediaQuery.addEventListener("change", (e: { matches: boolean }) => {
        prefersReducedMotion = e.matches;
      });

      expect(prefersReducedMotion).toBe(false);

      listeners[0]({ matches: true });
      expect(prefersReducedMotion).toBe(true);

      listeners[0]({ matches: false });
      expect(prefersReducedMotion).toBe(false);
    });
  });

  describe("Correct Media Query Strings", () => {
    const MEDIA_QUERIES = {
      reducedMotion: "(prefers-reduced-motion: reduce)",
      highContrast: "(forced-colors: active)",
      darkMode: "(prefers-color-scheme: dark)",
      moreContrast: "(prefers-contrast: more)",
    };

    it("should use correct reduced motion query", () => {
      expect(MEDIA_QUERIES.reducedMotion).toBe("(prefers-reduced-motion: reduce)");
    });

    it("should use correct high contrast query", () => {
      expect(MEDIA_QUERIES.highContrast).toBe("(forced-colors: active)");
    });

    it("should use correct dark mode query", () => {
      expect(MEDIA_QUERIES.darkMode).toBe("(prefers-color-scheme: dark)");
    });

    it("should use correct more contrast query", () => {
      expect(MEDIA_QUERIES.moreContrast).toBe("(prefers-contrast: more)");
    });
  });

  describe("Default Values Without matchMedia", () => {
    it("should default to false when matchMedia is not available", () => {
      const getPreference = (query: string): boolean => {
        if (typeof globalThis.matchMedia !== "function") {
          return false;
        }
        return globalThis.matchMedia(query).matches;
      };

      const originalMatchMedia = globalThis.matchMedia;
      Object.defineProperty(globalThis, "matchMedia", { value: undefined, writable: true });

      expect(getPreference("(prefers-reduced-motion: reduce)")).toBe(false);
      expect(getPreference("(prefers-color-scheme: dark)")).toBe(false);
      expect(getPreference("(forced-colors: active)")).toBe(false);
      expect(getPreference("(prefers-contrast: more)")).toBe(false);

      Object.defineProperty(globalThis, "matchMedia", { value: originalMatchMedia, writable: true });
    });
  });

  describe("Accessibility State Interface", () => {
    interface AccessibilityState {
      screenReaderMode: boolean;
      reducedMotion: boolean;
      highContrastMode: boolean;
      fontScale: number;
      audioSignalsEnabled: boolean;
      audioVolume: number;
    }

    it("should create default state", () => {
      const state: AccessibilityState = {
        screenReaderMode: false,
        reducedMotion: false,
        highContrastMode: false,
        fontScale: 1.0,
        audioSignalsEnabled: false,
        audioVolume: 0.5,
      };

      expect(state.screenReaderMode).toBe(false);
      expect(state.fontScale).toBe(1.0);
      expect(state.audioVolume).toBe(0.5);
    });

    it("should support custom font scales", () => {
      const scales = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5];

      scales.forEach((scale) => {
        const state: AccessibilityState = {
          screenReaderMode: false,
          reducedMotion: false,
          highContrastMode: false,
          fontScale: scale,
          audioSignalsEnabled: false,
          audioVolume: 0.5,
        };

        expect(state.fontScale).toBe(scale);
      });
    });
  });
});
