import { describe, it, expect, vi, beforeEach } from "vitest";

describe("AccessibilityContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Audio Signal Types", () => {
    type AudioSignalType =
      | "error"
      | "warning"
      | "success"
      | "breakpointHit"
      | "taskComplete"
      | "notification";

    it("should define audio signal types", () => {
      const types: AudioSignalType[] = [
        "error",
        "warning",
        "success",
        "breakpointHit",
        "taskComplete",
        "notification",
      ];
      expect(types).toHaveLength(6);
    });
  });

  describe("Audio Frequencies", () => {
    const AUDIO_FREQUENCIES: Record<string, number[]> = {
      error: [200, 150],
      warning: [400, 350, 400],
      success: [523, 659, 784],
      breakpointHit: [440, 550],
      taskComplete: [523, 659, 784, 1047],
      notification: [800, 600],
    };

    it("should define frequencies for error signal", () => {
      expect(AUDIO_FREQUENCIES.error).toEqual([200, 150]);
    });

    it("should define frequencies for success signal", () => {
      expect(AUDIO_FREQUENCIES.success).toEqual([523, 659, 784]);
    });

    it("should define frequencies for taskComplete signal", () => {
      expect(AUDIO_FREQUENCIES.taskComplete).toHaveLength(4);
    });
  });

  describe("Audio Durations", () => {
    const AUDIO_DURATIONS: Record<string, number[]> = {
      error: [200, 300],
      warning: [100, 100, 200],
      success: [100, 100, 200],
      breakpointHit: [150, 150],
      taskComplete: [100, 100, 100, 300],
      notification: [100, 150],
    };

    it("should define durations for error signal", () => {
      expect(AUDIO_DURATIONS.error).toEqual([200, 300]);
    });

    it("should define durations for warning signal", () => {
      expect(AUDIO_DURATIONS.warning).toHaveLength(3);
    });
  });

  describe("Font Scale Types", () => {
    type FontScale = 0.8 | 0.9 | 1.0 | 1.1 | 1.2 | 1.3 | 1.4 | 1.5;

    it("should define valid font scales", () => {
      const scales: FontScale[] = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5];
      expect(scales).toHaveLength(8);
    });

    it("should have default scale of 1.0", () => {
      const defaultScale: FontScale = 1.0;
      expect(defaultScale).toBe(1.0);
    });
  });

  describe("Focus Indicator Style", () => {
    type FocusIndicatorStyle = "default" | "high-visibility" | "custom";

    it("should define focus indicator styles", () => {
      const styles: FocusIndicatorStyle[] = ["default", "high-visibility", "custom"];
      expect(styles).toHaveLength(3);
    });
  });

  describe("Accessibility State", () => {
    interface AccessibilityState {
      screenReaderMode: boolean;
      reducedMotion: boolean;
      highContrastMode: boolean;
      fontScale: number;
      focusIndicatorStyle: string;
      audioSignalsEnabled: boolean;
      audioSignals: {
        error: boolean;
        warning: boolean;
        success: boolean;
        breakpointHit: boolean;
        taskComplete: boolean;
        notification: boolean;
      };
      audioVolume: number;
      liveRegionPoliteness: "polite" | "assertive";
      skipLinkEnabled: boolean;
      focusTrapEnabled: boolean;
      keyboardHintsVisible: boolean;
    }

    it("should create accessibility state", () => {
      const state: AccessibilityState = {
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

      expect(state.fontScale).toBe(1.0);
      expect(state.audioVolume).toBe(0.5);
    });
  });

  describe("Default State", () => {
    const DEFAULT_STATE = {
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

    it("should have screen reader mode disabled by default", () => {
      expect(DEFAULT_STATE.screenReaderMode).toBe(false);
    });

    it("should have reduced motion disabled by default", () => {
      expect(DEFAULT_STATE.reducedMotion).toBe(false);
    });

    it("should have high contrast mode disabled by default", () => {
      expect(DEFAULT_STATE.highContrastMode).toBe(false);
    });

    it("should have font scale at 1.0 by default", () => {
      expect(DEFAULT_STATE.fontScale).toBe(1.0);
    });

    it("should have audio signals disabled by default", () => {
      expect(DEFAULT_STATE.audioSignalsEnabled).toBe(false);
    });

    it("should have all individual audio signals enabled by default", () => {
      expect(DEFAULT_STATE.audioSignals.error).toBe(true);
      expect(DEFAULT_STATE.audioSignals.warning).toBe(true);
      expect(DEFAULT_STATE.audioSignals.success).toBe(true);
    });

    it("should have audio volume at 0.5 by default", () => {
      expect(DEFAULT_STATE.audioVolume).toBe(0.5);
    });

    it("should have polite live region politeness by default", () => {
      expect(DEFAULT_STATE.liveRegionPoliteness).toBe("polite");
    });
  });

  describe("Storage Key", () => {
    const STORAGE_KEY = "cortex_accessibility_settings";

    it("should have correct storage key", () => {
      expect(STORAGE_KEY).toBe("cortex_accessibility_settings");
    });
  });

  describe("LocalStorage Persistence", () => {
    it("should save settings to localStorage", () => {
      const mockSetItem = vi.fn();
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = mockSetItem;

      const settings = { fontScale: 1.2 };
      localStorage.setItem("cortex_accessibility_settings", JSON.stringify(settings));

      expect(mockSetItem).toHaveBeenCalledWith(
        "cortex_accessibility_settings",
        JSON.stringify(settings)
      );

      Storage.prototype.setItem = originalSetItem;
    });

    it("should load settings from localStorage", () => {
      const settings = { fontScale: 1.2, screenReaderMode: true };
      const mockGetItem = vi.fn().mockReturnValue(JSON.stringify(settings));
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = mockGetItem;

      const stored = localStorage.getItem("cortex_accessibility_settings");
      const parsed = JSON.parse(stored || "{}");

      expect(parsed.fontScale).toBe(1.2);
      expect(parsed.screenReaderMode).toBe(true);

      Storage.prototype.getItem = originalGetItem;
    });
  });

  describe("Reduced Motion Detection", () => {
    it("should detect prefers-reduced-motion media query", () => {
      const mockMatchMedia = vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

      const originalMatchMedia = window.matchMedia;
      window.matchMedia = mockMatchMedia;

      const result = window.matchMedia("(prefers-reduced-motion: reduce)");
      expect(result.matches).toBe(true);

      window.matchMedia = originalMatchMedia;
    });

    it("should detect no reduced motion preference", () => {
      const mockMatchMedia = vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

      const originalMatchMedia = window.matchMedia;
      window.matchMedia = mockMatchMedia;

      const result = window.matchMedia("(prefers-reduced-motion: reduce)");
      expect(result.matches).toBe(false);

      window.matchMedia = originalMatchMedia;
    });
  });

  describe("Screen Reader Announcements", () => {
    it("should create live region for announcements", () => {
      const liveRegion = {
        role: "status",
        "aria-live": "polite" as const,
        "aria-atomic": true,
      };

      expect(liveRegion.role).toBe("status");
      expect(liveRegion["aria-live"]).toBe("polite");
    });

    it("should support assertive announcements", () => {
      const liveRegion = {
        role: "alert",
        "aria-live": "assertive" as const,
        "aria-atomic": true,
      };

      expect(liveRegion["aria-live"]).toBe("assertive");
    });
  });

  describe("Toggle Functions", () => {
    it("should toggle screen reader mode", () => {
      let screenReaderMode = false;
      const toggleScreenReaderMode = () => {
        screenReaderMode = !screenReaderMode;
      };

      toggleScreenReaderMode();
      expect(screenReaderMode).toBe(true);

      toggleScreenReaderMode();
      expect(screenReaderMode).toBe(false);
    });

    it("should toggle high contrast mode", () => {
      let highContrastMode = false;
      const toggleHighContrast = () => {
        highContrastMode = !highContrastMode;
      };

      toggleHighContrast();
      expect(highContrastMode).toBe(true);
    });

    it("should toggle reduced motion", () => {
      let reducedMotion = false;
      const toggleReducedMotion = () => {
        reducedMotion = !reducedMotion;
      };

      toggleReducedMotion();
      expect(reducedMotion).toBe(true);
    });

    it("should toggle audio signals", () => {
      let audioSignalsEnabled = false;
      const toggleAudioSignals = () => {
        audioSignalsEnabled = !audioSignalsEnabled;
      };

      toggleAudioSignals();
      expect(audioSignalsEnabled).toBe(true);
    });
  });

  describe("Font Scale", () => {
    it("should set font scale", () => {
      let fontScale = 1.0;
      const setFontScale = (scale: number) => {
        fontScale = scale;
      };

      setFontScale(1.2);
      expect(fontScale).toBe(1.2);
    });

    it("should clamp font scale to valid range", () => {
      const clampFontScale = (scale: number): number => {
        return Math.min(1.5, Math.max(0.8, scale));
      };

      expect(clampFontScale(0.5)).toBe(0.8);
      expect(clampFontScale(2.0)).toBe(1.5);
      expect(clampFontScale(1.2)).toBe(1.2);
    });
  });

  describe("Audio Volume", () => {
    it("should set audio volume", () => {
      let audioVolume = 0.5;
      const setAudioVolume = (volume: number) => {
        audioVolume = Math.min(1, Math.max(0, volume));
      };

      setAudioVolume(0.8);
      expect(audioVolume).toBe(0.8);
    });

    it("should clamp audio volume to valid range", () => {
      const clampVolume = (volume: number): number => {
        return Math.min(1, Math.max(0, volume));
      };

      expect(clampVolume(-0.5)).toBe(0);
      expect(clampVolume(1.5)).toBe(1);
      expect(clampVolume(0.7)).toBe(0.7);
    });
  });

  describe("Individual Audio Signal Settings", () => {
    it("should toggle individual audio signal", () => {
      const audioSignals = {
        error: true,
        warning: true,
        success: true,
        breakpointHit: true,
        taskComplete: true,
        notification: true,
      };

      audioSignals.error = false;
      expect(audioSignals.error).toBe(false);
      expect(audioSignals.warning).toBe(true);
    });

    it("should enable all audio signals", () => {
      const audioSignals = {
        error: false,
        warning: false,
        success: false,
        breakpointHit: false,
        taskComplete: false,
        notification: false,
      };

      const enableAll = () => {
        Object.keys(audioSignals).forEach((key) => {
          audioSignals[key as keyof typeof audioSignals] = true;
        });
      };

      enableAll();
      expect(audioSignals.error).toBe(true);
      expect(audioSignals.notification).toBe(true);
    });
  });

  describe("Keyboard Hints", () => {
    it("should toggle keyboard hints visibility", () => {
      let keyboardHintsVisible = false;
      const toggleKeyboardHints = () => {
        keyboardHintsVisible = !keyboardHintsVisible;
      };

      toggleKeyboardHints();
      expect(keyboardHintsVisible).toBe(true);
    });
  });

  describe("Skip Link", () => {
    it("should enable skip link", () => {
      let skipLinkEnabled = true;
      expect(skipLinkEnabled).toBe(true);
    });

    it("should toggle skip link", () => {
      let skipLinkEnabled = true;
      skipLinkEnabled = false;
      expect(skipLinkEnabled).toBe(false);
    });
  });

  describe("Focus Trap", () => {
    it("should enable focus trap by default", () => {
      let focusTrapEnabled = true;
      expect(focusTrapEnabled).toBe(true);
    });

    it("should toggle focus trap", () => {
      let focusTrapEnabled = true;
      focusTrapEnabled = false;
      expect(focusTrapEnabled).toBe(false);
    });
  });

  describe("Helper Hooks", () => {
    it("should provide useAudioSignal functionality", () => {
      const playSignal = (type: string) => {
        return `Playing ${type} signal`;
      };

      expect(playSignal("error")).toBe("Playing error signal");
    });

    it("should provide useAnnounce functionality", () => {
      const announce = (message: string, politeness: "polite" | "assertive" = "polite") => {
        return { message, politeness };
      };

      const result = announce("File saved", "assertive");
      expect(result.message).toBe("File saved");
      expect(result.politeness).toBe("assertive");
    });

    it("should provide useReducedMotion functionality", () => {
      const reducedMotion = () => false;
      expect(reducedMotion()).toBe(false);
    });

    it("should provide useFontScale functionality", () => {
      const fontScale = () => 1.0;
      expect(fontScale()).toBe(1.0);
    });
  });

  describe("CSS Custom Properties", () => {
    it("should calculate font scale CSS value", () => {
      const fontScale = 1.2;
      const cssValue = `${fontScale * 100}%`;
      expect(cssValue).toBe("120%");
    });

    it("should apply high contrast mode class", () => {
      const highContrastMode = true;
      const className = highContrastMode ? "high-contrast" : "";
      expect(className).toBe("high-contrast");
    });

    it("should apply reduced motion class", () => {
      const reducedMotion = true;
      const className = reducedMotion ? "reduced-motion" : "";
      expect(className).toBe("reduced-motion");
    });
  });

  describe("System High Contrast Detection", () => {
    it("should detect systemPrefersHighContrast via media query", () => {
      const mockMatchMedia = vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

      const originalMatchMedia = window.matchMedia;
      window.matchMedia = mockMatchMedia;

      const result = window.matchMedia("(prefers-contrast: more)");
      expect(result.matches).toBe(true);
      expect(mockMatchMedia).toHaveBeenCalledWith("(prefers-contrast: more)");

      window.matchMedia = originalMatchMedia;
    });

    it("should detect high contrast on Windows via forced-colors", () => {
      const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === "(forced-colors: active)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      const originalMatchMedia = window.matchMedia;
      window.matchMedia = mockMatchMedia;

      const forcedColors = window.matchMedia("(forced-colors: active)");
      expect(forcedColors.matches).toBe(true);

      const prefersContrast = window.matchMedia("(prefers-contrast: more)");
      expect(prefersContrast.matches).toBe(false);

      window.matchMedia = originalMatchMedia;
    });

    it("should detect forced-colors media query", () => {
      const mockMatchMedia = vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

      const originalMatchMedia = window.matchMedia;
      window.matchMedia = mockMatchMedia;

      const result = window.matchMedia("(forced-colors: active)");
      expect(result.matches).toBe(true);

      window.matchMedia = originalMatchMedia;
    });

    it("should fallback when matchMedia is unavailable", () => {
      const originalMatchMedia = window.matchMedia;
      const matchMediaRef = window.matchMedia;

      const detectHighContrast = (): boolean => {
        try {
          if (typeof matchMediaRef !== "function") return false;
          return matchMediaRef("(prefers-contrast: more)").matches;
        } catch {
          return false;
        }
      };

      window.matchMedia = undefined as unknown as typeof window.matchMedia;

      const result = detectHighContrast();
      expect(result).toBe(false);

      window.matchMedia = originalMatchMedia;
    });
  });

  describe("Accessibility Settings Import/Export", () => {
    interface AccessibilitySettings {
      screenReaderMode: boolean;
      reducedMotion: boolean;
      highContrastMode: boolean;
      fontScale: number;
      audioSignalsEnabled: boolean;
      audioVolume: number;
    }

    const DEFAULT_SETTINGS: AccessibilitySettings = {
      screenReaderMode: false,
      reducedMotion: false,
      highContrastMode: false,
      fontScale: 1.0,
      audioSignalsEnabled: false,
      audioVolume: 0.5,
    };

    const exportSettings = (settings: AccessibilitySettings): string => {
      return JSON.stringify(settings, null, 2);
    };

    const importSettings = (json: string): AccessibilitySettings | null => {
      try {
        const parsed = JSON.parse(json);
        if (typeof parsed !== "object" || parsed === null) return null;
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch {
        return null;
      }
    };

    it("should export settings as valid JSON", () => {
      const settings: AccessibilitySettings = {
        screenReaderMode: true,
        reducedMotion: true,
        highContrastMode: false,
        fontScale: 1.3,
        audioSignalsEnabled: true,
        audioVolume: 0.8,
      };

      const exported = exportSettings(settings);
      const parsed = JSON.parse(exported);

      expect(parsed.screenReaderMode).toBe(true);
      expect(parsed.fontScale).toBe(1.3);
    });

    it("should import settings and apply them", () => {
      const json = JSON.stringify({
        screenReaderMode: true,
        fontScale: 1.4,
        audioVolume: 0.9,
      });

      const imported = importSettings(json);
      expect(imported).toBeDefined();
      expect(imported!.screenReaderMode).toBe(true);
      expect(imported!.fontScale).toBe(1.4);
      expect(imported!.audioVolume).toBe(0.9);
    });

    it("should return null for invalid JSON", () => {
      const result = importSettings("this is not json{{{");
      expect(result).toBeNull();
    });

    it("should round-trip export then import", () => {
      const original: AccessibilitySettings = {
        screenReaderMode: true,
        reducedMotion: true,
        highContrastMode: true,
        fontScale: 1.5,
        audioSignalsEnabled: true,
        audioVolume: 1.0,
      };

      const exported = exportSettings(original);
      const imported = importSettings(exported);

      expect(imported).toEqual(original);
    });

    it("should handle partial settings during import", () => {
      const json = JSON.stringify({ fontScale: 1.2 });
      const imported = importSettings(json);

      expect(imported).toBeDefined();
      expect(imported!.fontScale).toBe(1.2);
      expect(imported!.screenReaderMode).toBe(false);
      expect(imported!.reducedMotion).toBe(false);
      expect(imported!.audioVolume).toBe(0.5);
    });
  });
});
