import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    theme: () => "dark",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/context/SDKContext", () => ({
  useSDK: () => ({
    state: { config: { sandboxMode: "workspace_write", approvalMode: "auto" } },
    updateConfig: vi.fn(),
  }),
}));

vi.mock("@/context/VimContext", () => ({
  useVim: () => ({
    enabled: () => false,
    setEnabled: vi.fn(),
  }),
}));

vi.mock("@/context/LLMContext", () => ({
  useLLM: () => ({
    state: { activeProviderType: "anthropic" },
    getActiveModel: () => null,
    getProviderDisplayName: () => "Anthropic",
    getProviderTypes: () => [],
    getUsageStats: () => ({ totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0, lastReset: Date.now() }),
    getProviderStatuses: () => [],
    providerRequiresApiKey: () => true,
    setApiKey: vi.fn(),
    refreshProviderStatus: vi.fn(),
    resetUsageStats: vi.fn(),
  }),
}));

vi.mock("@/context/SupermavenContext", () => ({
  useSupermaven: () => ({
    state: { enabled: false },
    setEnabled: vi.fn(),
  }),
}));

vi.mock("@/context/FormatterContext", () => ({
  useFormatter: () => ({
    state: {
      settings: {
        enabled: false,
        formatOnSave: false,
        formatOnPaste: false,
        defaultFormatter: "prettier",
        options: {},
      },
      availableFormatters: [],
      isCheckingFormatters: false,
    },
    updateSettings: vi.fn(),
    checkAvailable: vi.fn(),
    resetSettings: vi.fn(),
  }),
}));

vi.mock("@/context/SettingsContext", () => ({
  useSettings: () => ({
    effectiveSettings: () => ({
      theme: { theme: "dark", wrapTabs: false },
      explorer: { sortOrder: "default" },
      files: { confirmDragAndDrop: true },
    }),
    hasWorkspaceOverride: () => false,
    workspaceSettings: () => ({}),
    hasWorkspace: () => false,
    workspacePath: () => null,
    getModifiedCountForSection: () => 0,
    getAllModifiedSettings: () => [],
    loadSettings: vi.fn(),
    updateThemeSetting: vi.fn(),
    updateExplorerSetting: vi.fn(),
    updateFilesSetting: vi.fn(),
    setWorkspaceSetting: vi.fn(),
    resetWorkspaceSetting: vi.fn(),
  }),
  DEFAULT_SETTINGS: {
    theme: { theme: "dark", wrapTabs: false },
    explorer: { sortOrder: "default" },
    files: { confirmDragAndDrop: true },
  },
}));

vi.mock("@/context/WorkspaceContext", () => ({
  useWorkspace: () => ({
    isMultiRoot: () => false,
    folders: () => [],
  }),
}));

vi.mock("@/context/MultiRepoContext", () => ({
  useMultiRepo: () => ({}),
}));

vi.mock("@/components/settings", () => ({
  KeymapEditor: () => <div data-testid="keymap-editor" />,
  Toggle: () => <input type="checkbox" />,
  Select: () => <select />,
  SectionHeader: (props: { title: string }) => <h3>{props.title}</h3>,
  OptionCard: () => <div />,
  FormGroup: (props: { children: unknown }) => <div>{props.children as string}</div>,
  InfoBox: () => <div />,
  Button: () => <button />,
  Kbd: (props: { children: unknown }) => <kbd>{props.children as string}</kbd>,
  EditorSettingsPanel: () => <div />,
  TerminalSettingsPanel: () => <div />,
  FilesSettingsPanel: () => <div />,
  NetworkSettingsPanel: () => <div />,
  JsonSettingsEditor: () => <div />,
  GitSettingsPanel: () => <div />,
}));

vi.mock("@/context/KeymapContext", () => ({
  KeymapProvider: (props: { children: unknown }) => <div>{props.children as string}</div>,
}));

vi.mock("@/components/ai/CopilotStatus", () => ({
  CopilotSettingsPanel: () => <div />,
  CopilotSignInModal: () => <div />,
}));

vi.mock("@/components/extensions", () => ({
  ExtensionsPanel: () => <div />,
}));

vi.mock("@/components/ui", () => ({
  Button: (props: { children: unknown; onClick?: () => void }) => (
    <button onClick={props.onClick}>{props.children as string}</button>
  ),
  IconButton: (props: { children: unknown; onClick?: () => void }) => (
    <button onClick={props.onClick}>{props.children as string}</button>
  ),
  Input: (props: { placeholder?: string }) => <input placeholder={props.placeholder} />,
  Card: (props: { children: unknown }) => <div>{props.children as string}</div>,
  Text: (props: { children: unknown }) => <span>{props.children as string}</span>,
  Badge: (props: { children: unknown }) => <span>{props.children as string}</span>,
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string }) => <span data-icon={props.name} />,
}));

describe("SettingsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export SettingsDialog component", async () => {
    const { SettingsDialog } = await import("../SettingsDialog");
    expect(SettingsDialog).toBeDefined();
    expect(typeof SettingsDialog).toBe("function");
  });

  it("should be a valid component function", async () => {
    const { SettingsDialog } = await import("../SettingsDialog");
    expect(typeof SettingsDialog).toBe("function");
  });
});
