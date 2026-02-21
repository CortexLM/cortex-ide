import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@solidjs/testing-library";

vi.mock("@/context/SettingsContext", () => {
  const settings = {
    version: 1,
    editor: {
      fontFamily: "JetBrains Mono", fontSize: 14, lineHeight: 1.5, tabSize: 2,
      insertSpaces: true, wordWrap: "off", lineNumbers: "on", minimapEnabled: true,
      minimapWidth: 120, bracketPairColorization: true, autoClosingBrackets: "languageDefined",
      autoIndent: true, formatOnSave: false, formatOnPaste: false, formatOnType: false,
      cursorStyle: "line", cursorBlink: "blink", renderWhitespace: "none",
      scrollBeyondLastLine: true, smoothScrolling: false, mouseWheelZoom: false,
      linkedEditing: false, stickyScrollEnabled: false, foldingEnabled: true,
      showFoldingControls: "mouseover", guidesIndentation: true, guidesBracketPairs: true,
      verticalTabs: false,
    },
    theme: {
      theme: "dark", iconTheme: "seti", accentColor: "#007acc", uiFontFamily: "Inter",
      uiFontSize: 13, zoomLevel: 1, sidebarPosition: "left", activityBarVisible: true,
      activityBarPosition: "side", statusBarVisible: true, tabBarVisible: true,
      breadcrumbsEnabled: true, wrapTabs: false, menuBarVisibility: "classic", panelPosition: "bottom",
    },
    terminal: {
      shellPath: "", fontFamily: "JetBrains Mono", fontSize: 13, lineHeight: 1.2,
      cursorStyle: "block", cursorBlink: true, scrollback: 10000, copyOnSelection: false,
      colorScheme: "dark", bell: "none",
    },
    files: {
      autoSave: "off", autoSaveDelay: 1000, hotExit: "onExit", defaultLanguage: "",
      trimTrailingWhitespace: false, insertFinalNewline: false, trimFinalNewlines: false,
      encoding: "utf-8", eol: "auto", confirmDelete: true, confirmDragAndDrop: true, enableTrash: true,
    },
    explorer: { compactFolders: true, sortOrder: "default" },
    security: {
      sandboxMode: "workspace_write", approvalMode: "ask_edit", networkAccess: true,
      telemetryEnabled: false, crashReportsEnabled: false,
    },
    git: {
      enabled: true, autofetch: false, autofetchPeriod: 180, confirmSync: true,
      enableSmartCommit: false, pruneOnFetch: false, postCommitCommand: "none",
    },
    ai: {}, zenMode: {}, screencastMode: {}, extensions: {}, vimEnabled: false,
    languageOverrides: {}, debug: {}, search: {}, http: {}, commandPalette: {},
    workbench: { editor: {} },
  };
  const mockFn = () => { const f = (..._a: any[]) => (f as any)._rv; (f as any)._rv = undefined; (f as any).mockReturnValue = (v: any) => { (f as any)._rv = v; return f; }; return f; };
  const getAllModified = mockFn() as any;
  getAllModified.mockReturnValue([]);
  (globalThis as any).__mockGetAllModifiedSettings = getAllModified;
  return {
    useSettings: () => ({
      effectiveSettings: () => settings,
      updateSettings: () => {},
      isSettingModified: () => false,
      hasWorkspaceOverride: () => false,
      resetSettingToDefault: () => {},
      resetWorkspaceSetting: () => {},
      getModifiedCountForSection: () => 0,
      getAllModifiedSettings: getAllModified,
      hasWorkspace: () => false,
      workspacePath: () => null,
      getEffectiveSettingsForPath: () => ({}),
      setFolderSetting: () => {},
      hasFolderOverride: () => false,
      resetFolderSetting: () => {},
      setWorkspaceSetting: () => {},
      getSettingSource: () => "default",
    }),
    DEFAULT_SETTINGS: settings,
    DEFAULT_WORKBENCH_EDITOR: { tabSizing: "fit", tabSizingFixedMinWidth: 80, tabSizingFixedWidth: 120 },
    SettingsScope: {},
    CortexSettings: {},
  };
});

vi.mock("@/context/WorkspaceContext", () => ({
  useWorkspace: () => { throw new Error("WorkspaceContext not available"); },
}));

vi.mock("@/context/SettingsSyncContext", () => ({
  useSettingsSync: () => { throw new Error("SettingsSyncContext not available"); },
}));

vi.mock("@/context/PolicySettingsContext", () => ({
  usePolicySettings: () => { throw new Error("PolicySettingsContext not available"); },
}));

vi.mock("@/context/WorkspaceTrustContext", () => ({
  useWorkspaceTrust: () => { throw new Error("WorkspaceTrustContext not available"); },
}));

vi.mock("@/utils/restrictedSettings", () => ({
  isSettingRestricted: () => false,
  getSettingRestrictionReason: () => null,
}));

vi.mock("@/utils/lazyStyles", () => ({
  loadStylesheet: () => {},
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: any) => <span data-testid={`icon-${props.name}`} />,
  default: (props: any) => <span data-testid={`icon-${props.name}`} />,
}));

vi.mock("../ui/Icon", () => ({
  Icon: (props: any) => <span data-testid={`icon-${props.name}`} />,
  default: (props: any) => <span data-testid={`icon-${props.name}`} />,
}));

vi.mock("@/components/ui", () => ({
  Button: (props: any) => <button {...props} data-testid="ui-button">{props.children}</button>,
  IconButton: (props: any) => <button {...props} data-testid="ui-icon-button">{props.children}</button>,
  Input: (props: any) => <input {...props} data-testid="ui-input" />,
  Text: (props: any) => <span>{props.children}</span>,
  Badge: (props: any) => <span data-testid="ui-badge">{props.children}</span>,
  Toggle: (props: any) => (
    <button
      data-testid="ui-toggle"
      role="switch"
      aria-checked={props.checked}
      onClick={() => props.onChange(!props.checked)}
    >
      {props.label}
    </button>
  ),
}));

vi.mock("@/design-system/tokens", () => ({
  tokens: {
    colors: {
      text: { primary: "#fff", muted: "#888", secondary: "#aaa" },
      surface: { input: "#1e1e1e", panel: "#252526", card: "#2d2d2d", active: "#37373d", canvas: "#1e1e1e", modal: "#1e1e1e" },
      border: { default: "#3c3c3c", focus: "#007acc" },
      accent: { primary: "#007acc" },
      semantic: { primary: "#007acc", error: "#f44747" },
      interactive: { hover: "#2a2d2e" },
    },
    spacing: { sm: "4px", md: "8px", lg: "12px" },
    radius: { sm: "4px", md: "6px", full: "9999px" },
  },
}));

import { SettingsEditor } from "../SettingsEditor";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  const mock = (globalThis as any).__mockGetAllModifiedSettings;
  if (mock) mock.mockReturnValue([]);
});

describe("SettingsEditor", () => {
  describe("Rendering", () => {
    it("renders the Settings heading", () => {
      const { getByText } = render(() => <SettingsEditor />);
      expect(getByText("Settings")).toBeTruthy();
    });

    it("renders TOC sidebar with Editor category", () => {
      const { getByText } = render(() => <SettingsEditor />);
      expect(getByText("Editor")).toBeTruthy();
    });

    it("renders TOC sidebar with Workbench category", () => {
      const { getByText } = render(() => <SettingsEditor />);
      expect(getByText("Workbench")).toBeTruthy();
    });

    it("renders TOC sidebar with Terminal category", () => {
      const { getByText } = render(() => <SettingsEditor />);
      expect(getByText("Terminal")).toBeTruthy();
    });

    it("renders TOC sidebar with Files category", () => {
      const { getByText } = render(() => <SettingsEditor />);
      expect(getByText("Files")).toBeTruthy();
    });

    it("renders TOC sidebar with Git category", () => {
      const { getByText } = render(() => <SettingsEditor />);
      expect(getByText("Git")).toBeTruthy();
    });

    it("renders TOC sidebar with Security category", () => {
      const { getByText } = render(() => <SettingsEditor />);
      expect(getByText("Security")).toBeTruthy();
    });

    it("renders TOC sidebar with AI category", () => {
      const { getByText } = render(() => <SettingsEditor />);
      expect(getByText("AI")).toBeTruthy();
    });

    it("renders the Modified filter button in sidebar", () => {
      const { getByText } = render(() => <SettingsEditor />);
      expect(getByText("Modified")).toBeTruthy();
    });

    it("renders search input with placeholder", () => {
      const { container } = render(() => <SettingsEditor />);
      const input = container.querySelector("input[data-testid='ui-input']") as HTMLInputElement;
      expect(input).toBeTruthy();
    });

    it("renders User scope tab", () => {
      const { getByText } = render(() => <SettingsEditor />);
      expect(getByText("User")).toBeTruthy();
    });

    it("renders close button when onClose provided", () => {
      const onClose = vi.fn();
      const { container } = render(() => <SettingsEditor onClose={onClose} />);
      const closeButtons = container.querySelectorAll("[data-testid='ui-icon-button']");
      expect(closeButtons.length).toBeGreaterThan(0);
    });
  });

  describe("Settings Content", () => {
    it("renders editor settings by default (editor is active section)", () => {
      const { getByText } = render(() => <SettingsEditor />);
      expect(getByText("Font Family")).toBeTruthy();
    });

    it("renders setting descriptions", () => {
      const { getByText } = render(() => <SettingsEditor />);
      expect(getByText("Controls the font family for the editor.")).toBeTruthy();
    });

    it("renders setting IDs", () => {
      const { getByText } = render(() => <SettingsEditor />);
      expect(getByText("editor.fontFamily")).toBeTruthy();
    });

    it("renders default value indicators", () => {
      const { container } = render(() => <SettingsEditor />);
      const defaults = container.querySelectorAll("span");
      const defaultTexts = Array.from(defaults).filter(el => el.textContent?.startsWith("Default:"));
      expect(defaultTexts.length).toBeGreaterThan(0);
    });

    it("renders boolean settings with toggle controls", () => {
      const { container } = render(() => <SettingsEditor />);
      const toggles = container.querySelectorAll("[role='switch']");
      expect(toggles.length).toBeGreaterThan(0);
    });

    it("renders enum settings with select dropdowns", () => {
      const { container } = render(() => <SettingsEditor />);
      const selects = container.querySelectorAll("select");
      expect(selects.length).toBeGreaterThan(0);
    });

    it("renders number settings with number inputs", () => {
      const { container } = render(() => <SettingsEditor />);
      const numberInputs = container.querySelectorAll("input[type='number']");
      expect(numberInputs.length).toBeGreaterThan(0);
    });

    it("renders string settings with text inputs", () => {
      const { container } = render(() => <SettingsEditor />);
      const textInputs = container.querySelectorAll("[data-testid='ui-input']");
      expect(textInputs.length).toBeGreaterThan(0);
    });
  });

  describe("TOC Navigation", () => {
    it("renders Editor sub-categories in TOC", () => {
      const { getByText } = render(() => <SettingsEditor />);
      expect(getByText("Font")).toBeTruthy();
      expect(getByText("Cursor")).toBeTruthy();
      expect(getByText("Minimap")).toBeTruthy();
    });

    it("renders Workbench sub-categories", () => {
      const { getByText } = render(() => <SettingsEditor />);
      expect(getByText("Appearance")).toBeTruthy();
      expect(getByText("Layout")).toBeTruthy();
    });

    it("renders Files sub-categories", () => {
      const { getByText } = render(() => <SettingsEditor />);
      expect(getByText("Auto Save")).toBeTruthy();
      expect(getByText("Encoding")).toBeTruthy();
    });
  });

  describe("Modified Filter", () => {
    it("shows modified count badge when settings are modified", () => {
      const mock = (globalThis as any).__mockGetAllModifiedSettings;
      mock.mockReturnValue(["editor.fontSize", "editor.tabSize"]);
      const { container } = render(() => <SettingsEditor />);
      const badges = container.querySelectorAll("[data-testid='ui-badge']");
      const modifiedBadge = Array.from(badges).find(b => b.textContent === "2");
      expect(modifiedBadge).toBeTruthy();
    });
  });

  describe("Search", () => {
    it("shows results count when searching", () => {
      const { container } = render(() => <SettingsEditor />);
      const input = container.querySelector("[data-testid='ui-input']") as HTMLInputElement;
      fireEvent.input(input, { target: { value: "font" } });
      const resultsText = container.querySelectorAll("span");
      const found = Array.from(resultsText).some(el => el.textContent?.includes("found"));
      expect(found).toBe(true);
    });

    it("filters settings by search query", () => {
      const { container } = render(() => <SettingsEditor />);
      const input = container.querySelector("[data-testid='ui-input']") as HTMLInputElement;
      fireEvent.input(input, { target: { value: "font" } });
      const settingItems = container.querySelectorAll(".settings-item");
      expect(settingItems.length).toBeGreaterThan(0);
    });

    it("shows no settings found when search has no results", () => {
      const { container, getByText } = render(() => <SettingsEditor />);
      const input = container.querySelector("[data-testid='ui-input']") as HTMLInputElement;
      fireEvent.input(input, { target: { value: "xyznonexistentsetting123" } });
      expect(getByText("No settings found")).toBeTruthy();
    });

    it("shows clear button when search has text", () => {
      const { container } = render(() => <SettingsEditor />);
      const input = container.querySelector("[data-testid='ui-input']") as HTMLInputElement;
      fireEvent.input(input, { target: { value: "test" } });
      const clearButtons = container.querySelectorAll("[data-testid='ui-icon-button']");
      expect(clearButtons.length).toBeGreaterThan(0);
    });
  });

  describe("Setting Tags", () => {
    it("renders experimental tag for tagged settings", () => {
      const { container } = render(() => <SettingsEditor />);
      const allSpans = container.querySelectorAll("span");
      const experimentalTag = Array.from(allSpans).find(s => s.textContent?.includes("experimental"));
      expect(experimentalTag).toBeTruthy();
    });
  });

  describe("Scope Tabs", () => {
    it("does not show Workspace tab when no workspace", () => {
      const { queryByText } = render(() => <SettingsEditor />);
      expect(queryByText("Workspace")).toBeNull();
    });
  });
});
