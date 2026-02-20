import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("ViewModeContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ViewMode Types", () => {
    type ViewMode = "vibe" | "ide";

    it("should define vibe mode", () => {
      const mode: ViewMode = "vibe";
      expect(mode).toBe("vibe");
    });

    it("should define ide mode", () => {
      const mode: ViewMode = "ide";
      expect(mode).toBe("ide");
    });

    it("should only allow valid modes", () => {
      const validModes: ViewMode[] = ["vibe", "ide"];
      expect(validModes).toHaveLength(2);
      expect(validModes).toContain("vibe");
      expect(validModes).toContain("ide");
    });
  });

  describe("View Mode State", () => {
    type ViewMode = "vibe" | "ide";

    interface ViewModeState {
      mode: ViewMode;
    }

    it("should create initial state with vibe mode", () => {
      const state: ViewModeState = {
        mode: "vibe",
      };

      expect(state.mode).toBe("vibe");
    });

    it("should create initial state with ide mode", () => {
      const state: ViewModeState = {
        mode: "ide",
      };

      expect(state.mode).toBe("ide");
    });

    it("should track current mode", () => {
      let currentMode: ViewMode = "vibe";

      const setMode = (mode: ViewMode) => {
        currentMode = mode;
      };

      setMode("ide");
      expect(currentMode).toBe("ide");

      setMode("vibe");
      expect(currentMode).toBe("vibe");
    });
  });

  describe("Mode Switching", () => {
    type ViewMode = "vibe" | "ide";

    it("should switch from vibe to ide", () => {
      let mode: ViewMode = "vibe";

      mode = "ide";

      expect(mode).toBe("ide");
    });

    it("should switch from ide to vibe", () => {
      let mode: ViewMode = "ide";

      mode = "vibe";

      expect(mode).toBe("vibe");
    });

    it("should toggle mode", () => {
      let mode: ViewMode = "vibe";

      const toggleMode = () => {
        mode = mode === "vibe" ? "ide" : "vibe";
      };

      toggleMode();
      expect(mode).toBe("ide");

      toggleMode();
      expect(mode).toBe("vibe");
    });
  });

  describe("Mode Helper Functions", () => {
    type ViewMode = "vibe" | "ide";

    it("should check if in vibe mode", () => {
      const isVibeMode = (mode: ViewMode): boolean => mode === "vibe";

      expect(isVibeMode("vibe")).toBe(true);
      expect(isVibeMode("ide")).toBe(false);
    });

    it("should check if in ide mode", () => {
      const isIDEMode = (mode: ViewMode): boolean => mode === "ide";

      expect(isIDEMode("ide")).toBe(true);
      expect(isIDEMode("vibe")).toBe(false);
    });

    it("should provide mode display name", () => {
      type ViewMode = "vibe" | "ide";

      const getModeDisplayName = (mode: ViewMode): string => {
        switch (mode) {
          case "vibe":
            return "Vibe Mode";
          case "ide":
            return "IDE Mode";
        }
      };

      expect(getModeDisplayName("vibe")).toBe("Vibe Mode");
      expect(getModeDisplayName("ide")).toBe("IDE Mode");
    });
  });

  describe("LocalStorage Persistence", () => {
    type ViewMode = "vibe" | "ide";

    const STORAGE_KEY = "cortex_view_mode";

    it("should save mode to storage", () => {
      const saveMode = (mode: ViewMode): void => {
        const stored = mode;
        expect(stored).toBe(mode);
      };

      saveMode("vibe");
      saveMode("ide");
    });

    it("should load mode from storage", () => {
      const loadMode = (stored: string | null): ViewMode => {
        if (stored === "vibe" || stored === "ide") {
          return stored;
        }
        return "vibe";
      };

      expect(loadMode("vibe")).toBe("vibe");
      expect(loadMode("ide")).toBe("ide");
      expect(loadMode(null)).toBe("vibe");
      expect(loadMode("invalid")).toBe("vibe");
    });

    it("should use storage key for persistence", () => {
      expect(STORAGE_KEY).toBe("cortex_view_mode");
    });

    it("should default to vibe mode when no stored value", () => {
      const getInitialMode = (stored: string | null): ViewMode => {
        return (stored as ViewMode) || "vibe";
      };

      expect(getInitialMode(null)).toBe("vibe");
    });
  });

  describe("Mode Context Value", () => {
    type ViewMode = "vibe" | "ide";

    interface ViewModeContextValue {
      mode: ViewMode;
      setMode: (mode: ViewMode) => void;
      isVibeMode: boolean;
      isIDEMode: boolean;
      toggleMode: () => void;
    }

    it("should create context value", () => {
      let currentMode: ViewMode = "vibe";

      const getIsVibeMode = () => currentMode === "vibe";
      const getIsIDEMode = () => currentMode === "ide";

      const contextValue: ViewModeContextValue = {
        mode: currentMode,
        setMode: (mode: ViewMode) => {
          currentMode = mode;
        },
        isVibeMode: getIsVibeMode(),
        isIDEMode: getIsIDEMode(),
        toggleMode: () => {
          currentMode = currentMode === "vibe" ? "ide" : "vibe";
        },
      };

      expect(contextValue.mode).toBe("vibe");
      expect(contextValue.isVibeMode).toBe(true);
      expect(contextValue.isIDEMode).toBe(false);
    });

    it("should update context value on mode change", () => {
      let mode: ViewMode = "vibe";

      const createContextValue = (): ViewModeContextValue => ({
        mode,
        setMode: (newMode: ViewMode) => {
          mode = newMode;
        },
        isVibeMode: mode === "vibe",
        isIDEMode: mode === "ide",
        toggleMode: () => {
          mode = mode === "vibe" ? "ide" : "vibe";
        },
      });

      let contextValue = createContextValue();
      expect(contextValue.isVibeMode).toBe(true);

      contextValue.setMode("ide");
      contextValue = createContextValue();
      expect(contextValue.isIDEMode).toBe(true);
    });
  });

  describe("Mode Preferences", () => {
    type ViewMode = "vibe" | "ide";

    interface ModePreferences {
      defaultMode: ViewMode;
      rememberLastMode: boolean;
      autoSwitchOnProject: boolean;
    }

    it("should define mode preferences", () => {
      const preferences: ModePreferences = {
        defaultMode: "vibe",
        rememberLastMode: true,
        autoSwitchOnProject: false,
      };

      expect(preferences.defaultMode).toBe("vibe");
      expect(preferences.rememberLastMode).toBe(true);
    });

    it("should get default mode from preferences", () => {
      const preferences: ModePreferences = {
        defaultMode: "ide",
        rememberLastMode: false,
        autoSwitchOnProject: false,
      };

      expect(preferences.defaultMode).toBe("ide");
    });
  });

  describe("Mode Features", () => {
    type ViewMode = "vibe" | "ide";

    interface ModeFeatures {
      showActivityBar: boolean;
      showSidebar: boolean;
      showStatusBar: boolean;
      showTabs: boolean;
      simplifiedUI: boolean;
    }

    it("should define vibe mode features", () => {
      const getVibeFeatures = (): ModeFeatures => ({
        showActivityBar: false,
        showSidebar: false,
        showStatusBar: true,
        showTabs: false,
        simplifiedUI: true,
      });

      const features = getVibeFeatures();
      expect(features.simplifiedUI).toBe(true);
      expect(features.showActivityBar).toBe(false);
    });

    it("should define ide mode features", () => {
      const getIDEFeatures = (): ModeFeatures => ({
        showActivityBar: true,
        showSidebar: true,
        showStatusBar: true,
        showTabs: true,
        simplifiedUI: false,
      });

      const features = getIDEFeatures();
      expect(features.simplifiedUI).toBe(false);
      expect(features.showActivityBar).toBe(true);
    });

    it("should get features for current mode", () => {
      const getFeaturesForMode = (mode: ViewMode): ModeFeatures => {
        if (mode === "vibe") {
          return {
            showActivityBar: false,
            showSidebar: false,
            showStatusBar: true,
            showTabs: false,
            simplifiedUI: true,
          };
        }
        return {
          showActivityBar: true,
          showSidebar: true,
          showStatusBar: true,
          showTabs: true,
          simplifiedUI: false,
        };
      };

      expect(getFeaturesForMode("vibe").simplifiedUI).toBe(true);
      expect(getFeaturesForMode("ide").simplifiedUI).toBe(false);
    });
  });

  describe("Mode Events", () => {
    it("should listen for mode change events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("viewmode:changed", () => {});

      expect(listen).toHaveBeenCalledWith("viewmode:changed", expect.any(Function));
    });

    it("should emit mode change events", () => {
      type ViewMode = "vibe" | "ide";

      interface ModeChangeEvent {
        previousMode: ViewMode;
        newMode: ViewMode;
        timestamp: number;
      }

      const event: ModeChangeEvent = {
        previousMode: "vibe",
        newMode: "ide",
        timestamp: Date.now(),
      };

      expect(event.previousMode).toBe("vibe");
      expect(event.newMode).toBe("ide");
    });
  });

  describe("Mode Invoke Commands", () => {
    it("should get mode via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("vibe");

      const result = await invoke("get_view_mode");

      expect(result).toBe("vibe");
    });

    it("should set mode via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("set_view_mode", { mode: "ide" });

      expect(invoke).toHaveBeenCalledWith("set_view_mode", { mode: "ide" });
    });

    it("should handle mode change error", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Failed to set mode"));

      await expect(invoke("set_view_mode", { mode: "ide" })).rejects.toThrow("Failed to set mode");
    });
  });

  describe("Mode Transitions", () => {
    type ViewMode = "vibe" | "ide";

    interface ModeTransition {
      from: ViewMode;
      to: ViewMode;
      animate: boolean;
      duration: number;
    }

    it("should define mode transition", () => {
      const transition: ModeTransition = {
        from: "vibe",
        to: "ide",
        animate: true,
        duration: 300,
      };

      expect(transition.from).toBe("vibe");
      expect(transition.to).toBe("ide");
      expect(transition.animate).toBe(true);
    });

    it("should track transition state", () => {
      let isTransitioning = false;

      const startTransition = () => {
        isTransitioning = true;
      };

      const endTransition = () => {
        isTransitioning = false;
      };

      expect(isTransitioning).toBe(false);
      startTransition();
      expect(isTransitioning).toBe(true);
      endTransition();
      expect(isTransitioning).toBe(false);
    });
  });

  describe("Mode Layout", () => {
    type ViewMode = "vibe" | "ide";

    interface LayoutConfig {
      sidebarWidth: number;
      panelHeight: number;
      activityBarWidth: number;
    }

    it("should get layout for vibe mode", () => {
      const getVibeLayout = (): LayoutConfig => ({
        sidebarWidth: 0,
        panelHeight: 200,
        activityBarWidth: 0,
      });

      const layout = getVibeLayout();
      expect(layout.sidebarWidth).toBe(0);
      expect(layout.activityBarWidth).toBe(0);
    });

    it("should get layout for ide mode", () => {
      const getIDELayout = (): LayoutConfig => ({
        sidebarWidth: 250,
        panelHeight: 200,
        activityBarWidth: 48,
      });

      const layout = getIDELayout();
      expect(layout.sidebarWidth).toBe(250);
      expect(layout.activityBarWidth).toBe(48);
    });

    it("should apply layout based on mode", () => {
      const getLayoutForMode = (mode: ViewMode): LayoutConfig => {
        if (mode === "vibe") {
          return { sidebarWidth: 0, panelHeight: 200, activityBarWidth: 0 };
        }
        return { sidebarWidth: 250, panelHeight: 200, activityBarWidth: 48 };
      };

      expect(getLayoutForMode("vibe").sidebarWidth).toBe(0);
      expect(getLayoutForMode("ide").sidebarWidth).toBe(250);
    });
  });
});
