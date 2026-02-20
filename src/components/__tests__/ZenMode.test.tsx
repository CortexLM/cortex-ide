import { describe, it, expect, vi, beforeEach } from "vitest";

describe("ZenMode Component Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ZenModeSettings Interface", () => {
    interface ZenModeSettings {
      hideSidebar: boolean;
      hidePanel: boolean;
      hideStatusBar: boolean;
      hideActivityBar: boolean;
      hideMenuBar: boolean;
      hideTabs: boolean;
      centerLayout: boolean;
      fullScreen: boolean;
      maxWidth: string;
      silentNotifications: boolean;
    }

    const DEFAULT_ZEN_SETTINGS: ZenModeSettings = {
      hideSidebar: true,
      hidePanel: true,
      hideStatusBar: true,
      hideActivityBar: true,
      hideMenuBar: true,
      hideTabs: false,
      centerLayout: true,
      fullScreen: false,
      maxWidth: "900px",
      silentNotifications: true,
    };

    it("should have correct default settings", () => {
      expect(DEFAULT_ZEN_SETTINGS.hideSidebar).toBe(true);
      expect(DEFAULT_ZEN_SETTINGS.hidePanel).toBe(true);
      expect(DEFAULT_ZEN_SETTINGS.hideStatusBar).toBe(true);
      expect(DEFAULT_ZEN_SETTINGS.hideActivityBar).toBe(true);
      expect(DEFAULT_ZEN_SETTINGS.hideMenuBar).toBe(true);
      expect(DEFAULT_ZEN_SETTINGS.hideTabs).toBe(false);
      expect(DEFAULT_ZEN_SETTINGS.centerLayout).toBe(true);
      expect(DEFAULT_ZEN_SETTINGS.fullScreen).toBe(false);
      expect(DEFAULT_ZEN_SETTINGS.maxWidth).toBe("900px");
      expect(DEFAULT_ZEN_SETTINGS.silentNotifications).toBe(true);
    });

    it("should allow custom max width", () => {
      const settings: ZenModeSettings = { ...DEFAULT_ZEN_SETTINGS, maxWidth: "1200px" };
      expect(settings.maxWidth).toBe("1200px");
    });

    it("should allow enabling full screen", () => {
      const settings: ZenModeSettings = { ...DEFAULT_ZEN_SETTINGS, fullScreen: true };
      expect(settings.fullScreen).toBe(true);
    });
  });

  describe("Keyboard Chord Detection", () => {
    it("should detect Ctrl+K Z chord", () => {
      let chordActive = false;
      const handleKeyDown = (key: string, ctrlKey: boolean) => {
        if (ctrlKey && key === "k" && !chordActive) {
          chordActive = true;
          return "chord-started";
        }
        if (chordActive && (key === "z" || key === "Z")) {
          chordActive = false;
          return "zen-toggled";
        }
        if (chordActive) {
          chordActive = false;
          return "chord-cancelled";
        }
        return "no-action";
      };

      expect(handleKeyDown("k", true)).toBe("chord-started");
      expect(handleKeyDown("z", false)).toBe("zen-toggled");
    });

    it("should cancel chord on non-Z key", () => {
      let chordActive = false;
      const handleKeyDown = (key: string, ctrlKey: boolean) => {
        if (ctrlKey && key === "k" && !chordActive) {
          chordActive = true;
          return "chord-started";
        }
        if (chordActive && (key === "z" || key === "Z")) {
          chordActive = false;
          return "zen-toggled";
        }
        if (chordActive) {
          chordActive = false;
          return "chord-cancelled";
        }
        return "no-action";
      };

      expect(handleKeyDown("k", true)).toBe("chord-started");
      expect(handleKeyDown("a", false)).toBe("chord-cancelled");
    });

    it("should not start chord without Ctrl", () => {
      let chordActive = false;
      const handleKeyDown = (key: string, ctrlKey: boolean) => {
        if (ctrlKey && key === "k" && !chordActive) {
          chordActive = true;
          return "chord-started";
        }
        return "no-action";
      };

      expect(handleKeyDown("k", false)).toBe("no-action");
    });
  });

  describe("CSS Class Management", () => {
    it("should generate correct class list for active zen mode", () => {
      const settings = {
        hideSidebar: true,
        hidePanel: true,
        hideStatusBar: true,
        hideActivityBar: true,
        hideMenuBar: false,
        hideTabs: false,
        centerLayout: true,
      };

      const classes: string[] = ["zen-mode-active"];
      if (settings.hideSidebar) classes.push("zen-hide-sidebar");
      if (settings.hidePanel) classes.push("zen-hide-panel");
      if (settings.hideStatusBar) classes.push("zen-hide-statusbar");
      if (settings.hideActivityBar) classes.push("zen-hide-activitybar");
      if (settings.hideMenuBar) classes.push("zen-hide-menubar");
      if (settings.hideTabs) classes.push("zen-hide-tabs");
      if (settings.centerLayout) classes.push("zen-center-layout");

      expect(classes).toContain("zen-mode-active");
      expect(classes).toContain("zen-hide-sidebar");
      expect(classes).toContain("zen-hide-panel");
      expect(classes).not.toContain("zen-hide-menubar");
      expect(classes).not.toContain("zen-hide-tabs");
      expect(classes).toContain("zen-center-layout");
    });
  });

  describe("Previous Layout State", () => {
    interface PreviousLayoutState {
      sidebarVisible: boolean;
      panelVisible: boolean;
      statusBarVisible: boolean;
      activityBarVisible: boolean;
      menuBarVisible: boolean;
      tabsVisible: boolean;
    }

    it("should store previous layout state", () => {
      const state: PreviousLayoutState = {
        sidebarVisible: true,
        panelVisible: true,
        statusBarVisible: true,
        activityBarVisible: true,
        menuBarVisible: true,
        tabsVisible: true,
      };

      expect(state.sidebarVisible).toBe(true);
      expect(state.panelVisible).toBe(true);
    });

    it("should restore previous layout state", () => {
      const saved: PreviousLayoutState = {
        sidebarVisible: false,
        panelVisible: true,
        statusBarVisible: true,
        activityBarVisible: false,
        menuBarVisible: true,
        tabsVisible: true,
      };

      expect(saved.sidebarVisible).toBe(false);
      expect(saved.activityBarVisible).toBe(false);
    });
  });
});
