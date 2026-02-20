import { Show, For, createSignal, createMemo, createEffect, onMount, onCleanup, JSX } from "solid-js";
import { Icon } from "./ui/Icon";
import { useTheme, Theme } from "@/context/ThemeContext";
import { useSDK } from "@/context/SDKContext";
import { useVim } from "@/context/VimContext";
import { useLLM } from "@/context/LLMContext";
import { useSupermaven } from "@/context/SupermavenContext";
import { useFormatter, type FormatterType } from "@/context/FormatterContext";
import { useSettings, type SettingsScope, type SettingSource, type CortexSettings, type ExplorerSortOrder, DEFAULT_SETTINGS } from "@/context/SettingsContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useMultiRepo } from "@/context/MultiRepoContext";
import { KeymapEditor, Toggle, Select, SectionHeader, OptionCard, FormGroup, InfoBox, Button, Kbd, EditorSettingsPanel, TerminalSettingsPanel, FilesSettingsPanel, NetworkSettingsPanel, JsonSettingsEditor, GitSettingsPanel } from "@/components/settings";
import { KeymapProvider } from "@/context/KeymapContext";
import { CopilotSettingsPanel, CopilotSignInModal } from "@/components/ai/CopilotStatus";
import { ExtensionsPanel } from "@/components/extensions";
import { Button as UIButton, IconButton, Input, Card, Text, Badge } from "@/components/ui";
import type { LLMProviderType } from "@/utils/llm";

/**
 * Safe accessor for explorer settings with fallback defaults.
 * Prevents "Cannot read properties of undefined" errors when settings are corrupted or missing.
 */
function safeExplorerSettings(settings: CortexSettings | null | undefined) {
  const explorer = settings?.explorer ?? DEFAULT_SETTINGS.explorer;
  return {
    sortOrder: explorer?.sortOrder ?? DEFAULT_SETTINGS.explorer.sortOrder,
  };
}

/**
 * Safe accessor for files settings with fallback defaults.
 */
function safeFilesSettings(settings: CortexSettings | null | undefined) {
  const files = settings?.files ?? DEFAULT_SETTINGS.files;
  return {
    confirmDragAndDrop: files?.confirmDragAndDrop ?? DEFAULT_SETTINGS.files.confirmDragAndDrop,
  };
}

/**
 * Safe accessor for theme settings with fallback defaults.
 */
function safeThemeSettings(settings: CortexSettings | null | undefined) {
  const theme = settings?.theme ?? DEFAULT_SETTINGS.theme;
  return {
    theme: theme?.theme ?? DEFAULT_SETTINGS.theme.theme,
    wrapTabs: theme?.wrapTabs ?? DEFAULT_SETTINGS.theme.wrapTabs,
  };
}

/** Map tree item IDs to settings sections for modified count */
const TREE_ID_TO_SECTION: Record<string, keyof CortexSettings | null> = {
  "common": null,
  "general": "theme",
  "explorer": "explorer",
  "files": "files",
  "security": "security",
  "network": "http",
  "editor-root": null,
  "editor": "editor",
  "formatting": "editor",
  "keybindings": null,
  "terminal": "terminal",
  "ai": null,
  "models": "ai",
  "ai_completion": "ai",
  "extensions": "extensions",
};

interface TreeItem {
  id: string;
  label: string;
  icon?: any;
  children?: TreeItem[];
}

const SETTINGS_TREE: TreeItem[] = [
  {
    id: "common",
    label: "Common",
    icon: () => <Icon name="desktop" />,
    children: [
      { id: "general", label: "General" },
      { id: "explorer", label: "Explorer" },
      { id: "files", label: "Files" },
      { id: "security", label: "Security" },
      { id: "network", label: "Network" },
    ]
  },
  {
    id: "editor-root",
    label: "Editor",
    icon: () => <Icon name="pen-to-square" />,
    children: [
      { id: "editor", label: "Settings" },
      { id: "formatting", label: "Formatting" },
      { id: "keybindings", label: "Keybindings" },
    ]
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: () => <Icon name="terminal" />,
  },
  {
    id: "git",
    label: "Git",
    icon: () => <Icon name="code-branch" />,
  },
  {
    id: "ai",
    label: "AI",
    icon: () => <Icon name="microchip" />,
    children: [
      { id: "models", label: "Models" },
      { id: "ai_completion", label: "AI Completion" },
    ]
  },
  {
    id: "extensions",
    label: "Extensions",
    icon: () => <Icon name="puzzle-piece" />,
  }
];

function SettingsTreeItem(props: {
  item: TreeItem;
  activeSection: string;
  onSelect: (id: string) => void;
  depth: number;
  getModifiedCount: (itemId: string) => number;
  showModifiedOnly: boolean;
}) {
  const [isExpanded, setIsExpanded] = createSignal(true);
  const hasChildren = () => props.item.children && props.item.children.length > 0;
  
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (hasChildren()) {
      setIsExpanded(!isExpanded());
    }
    props.onSelect(props.item.id);
  };

  // Get modified count for this item
  const modifiedCount = () => props.getModifiedCount(props.item.id);
  
  // Calculate total modified count including children
  const totalModifiedCount = (): number => {
    let total = modifiedCount();
    if (props.item.children) {
      for (const child of props.item.children) {
        total += props.getModifiedCount(child.id);
      }
    }
    return total;
  };

  // Check if this item or its children have modifications
  const hasModifications = () => totalModifiedCount() > 0;

  // Filter logic: if showModifiedOnly is true, only show items with modifications
  const shouldShow = () => !props.showModifiedOnly || hasModifications();

  const isActive = () => props.activeSection === props.item.id;

  return (
    <Show when={shouldShow()}>
      <div class="settings-tree-node">
        <button
          onClick={handleClick}
          class={`settings-tab-button ${isActive() ? "settings-tab-button-active" : ""} ${hasModifications() ? "has-modifications" : ""}`}
          style={{
            display: "flex",
            "align-items": "center",
            width: "100%",
            gap: "6px",
            padding: `4px 8px 4px ${8 + props.depth * 16}px`,
            background: isActive() ? "var(--jb-list-active-bg, rgba(255,255,255,0.08))" : "transparent",
            border: "none",
            "border-radius": "var(--cortex-radius-sm, 6px)",
            cursor: "pointer",
            color: isActive() ? "var(--jb-text-body-color, #fff)" : "var(--jb-text-muted-color, rgba(255,255,255,0.7))",
            "font-size": "13px",
            "font-weight": isActive() ? "500" : "400",
            "font-family": "inherit",
            "text-align": "left",
            height: "30px",
            "margin-bottom": "1px",
            transition: "background 0.1s, color 0.1s",
          }}
          onMouseEnter={(e) => {
            if (!isActive()) {
              e.currentTarget.style.background = "var(--jb-list-hover-bg, rgba(255,255,255,0.04))";
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive()) {
              e.currentTarget.style.background = "transparent";
            }
          }}
        >
          <span style={{ width: "14px", "flex-shrink": "0", display: "flex", "align-items": "center", "justify-content": "center" }}>
            <Show when={hasChildren()}>
              <Show when={isExpanded()} fallback={<Icon name="chevron-right" style={{ width: "12px", height: "12px" }} />}>
                <Icon name="chevron-down" style={{ width: "12px", height: "12px" }} />
              </Show>
            </Show>
          </span>
          <Show when={props.item.icon}>
            <span style={{ width: "16px", height: "16px", display: "inline-flex", "align-items": "center", "justify-content": "center", "flex-shrink": "0" }}>
              <props.item.icon />
            </span>
          </Show>
          <span style={{ flex: "1", overflow: "hidden", "white-space": "nowrap", "text-overflow": "ellipsis" }}>{props.item.label}</span>
          <Show when={totalModifiedCount() > 0}>
            <span title={`${totalModifiedCount()} modified setting${totalModifiedCount() > 1 ? 's' : ''}`}>
              <Badge size="sm">
                {totalModifiedCount()}
              </Badge>
            </span>
          </Show>
        </button>
        <Show when={hasChildren() && isExpanded()}>
          <div class="settings-tree-children">
            <For each={props.item.children}>
              {(child) => (
                <SettingsTreeItem
                  item={child}
                  activeSection={props.activeSection}
                  onSelect={props.onSelect}
                  depth={props.depth + 1}
                  getModifiedCount={props.getModifiedCount}
                  showModifiedOnly={props.showModifiedOnly}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  );
}

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Initial JSON view state */
  initialJsonView?: boolean;
  /** Initial show default settings state (only applies when in JSON view) */
  initialShowDefaults?: boolean;
  /** Initial section to scroll to (e.g., "keybindings") */
  initialSection?: string;
}

/** Badge showing where a setting value comes from */
function SettingSourceBadge(props: { source: SettingSource; hasOverride?: boolean }) {
  const getVariant = (): "accent" | "success" | "default" => {
    switch (props.source) {
      case "workspace":
        return "success"; // Purple-ish, using success as closest
      case "user":
        return "accent";
      default:
        return "default";
    }
  };

  const getLabel = () => {
    switch (props.source) {
      case "workspace":
        return "Workspace";
      case "user":
        return "User";
      default:
        return "Default";
    }
  };

  const customStyle = (): JSX.CSSProperties => {
    if (props.source === "workspace") {
      return {
        background: "rgba(168, 85, 247, 0.2)",
        color: "var(--cortex-info)",
        border: "1px solid rgba(168, 85, 247, 0.3)",
      };
    }
    return {};
  };

  return (
    <Badge variant={getVariant()} size="sm" style={customStyle()}>
      {getLabel()}
    </Badge>
  );
}

/** Visual indicator dot for workspace overrides */
function WorkspaceOverrideIndicator(props: { hasOverride: boolean }) {
  return (
    <Show when={props.hasOverride}>
      <span 
        class="inline-block w-2 h-2 rounded-full bg-purple-500" 
        title="This setting has a workspace override"
      />
    </Show>
  );
}

/** Setting row with source indicator and reset button */
function SettingRow(props: {
  label: string;
  source: SettingSource;
  hasOverride: boolean;
  onReset?: () => void;
  children: JSX.Element;
}) {
  return (
    <div class="settings-row group relative">
      <div class="flex items-center gap-2">
        <WorkspaceOverrideIndicator hasOverride={props.hasOverride} />
        <span class="settings-row-label">{props.label}</span>
        <SettingSourceBadge source={props.source} />
      </div>
      <div class="flex items-center gap-2">
        {props.children}
        <Show when={props.hasOverride && props.onReset}>
          <IconButton
            onClick={props.onReset}
            size="sm"
            class="opacity-0 group-hover:opacity-100 transition-opacity"
            title="Reset to user setting"
          >
            <Icon name="rotate-left" class="h-3 w-3" />
          </IconButton>
        </Show>
      </div>
    </div>
  );
}

export function SettingsDialog(props: SettingsDialogProps) {
  const { setTheme } = useTheme();
  const { state, updateConfig } = useSDK();
  const vim = useVim();
  const llm = useLLM();
  const supermaven = useSupermaven();
  const formatter = useFormatter();
  useMultiRepo(); // Context provider hook (values not destructured yet)
  const settings = useSettings();
  const [activeTab, setActiveTab] = createSignal<string>(props.initialSection ?? "general");
  const [searchQuery, setSearchQuery] = createSignal("");
  
  // Scroll to initial section on mount
  onMount(() => {
    if (props.initialSection) {
      setTimeout(() => {
        scrollToSection(props.initialSection!);
      }, 100);
    }
  });
  // Removed unused signals: supermavenApiKey, showSupermavenKey
  const [showCopilotSignIn, setShowCopilotSignIn] = createSignal(false);
  
  // Settings scope toggle: user vs workspace
  const [settingsScope, setSettingsScope] = createSignal<SettingsScope>("user");
  
  // JSON view mode toggle
  const [showJsonView, setShowJsonView] = createSignal(props.initialJsonView ?? false);
  const [jsonViewDirty, setJsonViewDirty] = createSignal(false);
  // Initial value for showing default settings side panel (passed to JsonSettingsEditor)
  const initialShowDefaults = props.initialShowDefaults ?? false;
  
  // Modified settings filter
  const [showModifiedOnly, setShowModifiedOnly] = createSignal(false);
  
  // Get modified count for a tree item
  const getModifiedCount = (itemId: string): number => {
    const section = TREE_ID_TO_SECTION[itemId];
    if (!section) return 0;
    return settings.getModifiedCountForSection(section);
  };
  
  // Get total modified settings count
  const totalModifiedCount = createMemo(() => {
    return settings.getAllModifiedSettings().length;
  });
  
  const [showApiKeys, setShowApiKeys] = createSignal<Record<LLMProviderType, boolean>>({
    anthropic: false,
    openai: false,
    google: false,
    mistral: false,
    deepseek: false,
    openrouter: false,
  });
  const [apiKeyInputs, setApiKeyInputs] = createSignal<Record<LLMProviderType, string>>({
    anthropic: "",
    openai: "",
    google: "",
    mistral: "",
    deepseek: "",
    openrouter: "",
  });
  const [validatingProvider, setValidatingProvider] = createSignal<LLMProviderType | null>(null);

  const [, setContentRef] = createSignal<HTMLDivElement | null>(null);

  const findTreeItem = (items: TreeItem[], id: string): TreeItem | undefined => {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findTreeItem(item.children, id);
        if (found) return found;
      }
    }
    return undefined;
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(`settings-section-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveTab(id);
    } else {
      const item = findTreeItem(SETTINGS_TREE, id);
      if (item && item.children && item.children.length > 0) {
        scrollToSection(item.children[0].id);
      } else {
        setActiveTab(id);
      }
    }
  };

  // Check if workspace is available
  const hasWorkspace = createMemo(() => settings.hasWorkspace());
  const workspacePath = createMemo(() => settings.workspacePath());
  
  // Multi-root workspace support
  const workspace = useWorkspace();
  const isMultiRoot = createMemo(() => workspace.isMultiRoot());
  const workspaceFolders = createMemo(() => workspace.folders());
  
  // Selected folder for folder-level settings
  const [selectedFolder, setSelectedFolder] = createSignal<string | null>(null);
  
  // Initialize selected folder when scope changes to "folder"
  createEffect(() => {
    if (settingsScope() === "folder" && !selectedFolder() && workspaceFolders().length > 0) {
      setSelectedFolder(workspaceFolders()[0].path);
    }
  });

  const toggleShowApiKey = (provider: LLMProviderType) => {
    setShowApiKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleApiKeyChange = (provider: LLMProviderType, value: string) => {
    setApiKeyInputs(prev => ({ ...prev, [provider]: value }));
  };

  const saveApiKey = (provider: LLMProviderType) => {
    const key = apiKeyInputs()[provider];
    if (key) {
      llm.setApiKey(provider, key);
      setApiKeyInputs(prev => ({ ...prev, [provider]: "" }));
    }
  };

  const validateProvider = async (provider: LLMProviderType) => {
    setValidatingProvider(provider);
    await llm.refreshProviderStatus(provider);
    setValidatingProvider(null);
  };

  const getProviderIcon = (type: LLMProviderType): string => {
    const icons: Record<LLMProviderType, string> = {
      anthropic: "🤖",
      openai: "🧠",
      google: "🔷",
      mistral: "💨",
      deepseek: "🌊",
      openrouter: "🔀",
    };
    return icons[type];
  };

  const usageStats = createMemo(() => llm.getUsageStats());
  const providerStatuses = createMemo(() => llm.getProviderStatuses());

  const themes: { value: Theme; label: string; icon: () => JSX.Element }[] = [
    { value: "dark", label: "Dark", icon: () => <Icon name="moon" /> },
    { value: "light", label: "Light", icon: () => <Icon name="sun" /> },
    { value: "system", label: "System", icon: () => <Icon name="desktop" /> },
  ];

  const sandboxModes = [
    { value: "workspace_write", label: "Workspace Write", description: "Write access within workspace" },
    { value: "directory_only", label: "Directory Only", description: "Restricted to current directory" },
    { value: "read_only", label: "Read Only", description: "No write access" },
  ];

  const approvalModes = [
    { value: "auto", label: "Auto Approve", description: "Automatically approve safe operations" },
    { value: "ask_edit", label: "Ask for Edits", description: "Ask before file modifications" },
    { value: "ask_all", label: "Ask All", description: "Ask before any operation" },
  ];

  const formatterDisplayNames: Record<FormatterType, string> = {
    prettier: "Prettier",
    rustfmt: "rustfmt",
    black: "Black",
    gofmt: "gofmt",
    clangformat: "clang-format",
    biome: "Biome",
    deno: "Deno",
  };

  const getFormatterIcon = (type: FormatterType): string => {
    const icons: Record<FormatterType, string> = {
      prettier: "✨",
      rustfmt: "🦀",
      black: "🐍",
      gofmt: "🐹",
      clangformat: "⚙️",
      biome: "🌿",
      deno: "🦕",
    };
    return icons[type];
  };

  // Get workspace folder name for display
  const workspaceName = createMemo(() => {
    const path = workspacePath();
    if (!path) return null;
    const parts = path.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || parts[parts.length - 2];
  });

  // Dialog reference for focus trapping
  const [dialogRef, setDialogRef] = createSignal<HTMLDivElement | null>(null);

  // Focus trapping implementation - VS Code spec
  const getFocusableElements = () => {
    const dialog = dialogRef();
    if (!dialog) return [];
    return Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.isOpen) return;

    // Escape key closes dialog
    if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
      return;
    }

    // Tab key focus trapping with circular navigation
    if (e.key === "Tab") {
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (e.shiftKey) {
        // Shift+Tab: go backwards
        if (activeElement === firstElement || !focusable.includes(activeElement as HTMLElement)) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: go forwards
        if (activeElement === lastElement || !focusable.includes(activeElement as HTMLElement)) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }

    // Prevent Alt key shortcuts within dialog
    if (e.altKey) {
      e.preventDefault();
    }
  };

  // Handle backdrop click - return focus to dialog
  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  // Set up keyboard event listener
  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  // Set up focus management when dialog opens
  createEffect(() => {
    if (props.isOpen) {
      // Focus the search input when dialog opens
      setTimeout(() => {
        const focusable = getFocusableElements();
        if (focusable.length > 0) {
          // Find the search input as preferred initial focus
          const searchInput = focusable.find(el => el.getAttribute('placeholder')?.includes('Search'));
          if (searchInput) {
            searchInput.focus();
          } else {
            focusable[0].focus();
          }
        }
      }, 0);
    }
  });

  return (
    <Show when={props.isOpen}>
      {/* Modal Backdrop - VS Code: z-index 2575, rgba(0,0,0,0.3) */}
      <div
        class="modal-overlay dimmed"
        onClick={handleBackdropClick}
      >
        {/* Dialog Shadow Wrapper */}
        <div class="dialog-shadow">
          {/* Settings Dialog - JetBrains New UI */}
          <div
            ref={setDialogRef}
            class="settings-editor mx-4 w-full transition-all"
            style={{ 
              "max-width": "1200px",
              "min-width": "var(--dialog-min-width)",
              "max-height": "90vh",
              "border-radius": "var(--jb-radius-lg)",
              "border": "1px solid var(--jb-border-default)",
              "background": "var(--jb-modal)",
              "box-shadow": "var(--jb-shadow-modal)",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-dialog-title"
            tabIndex={-1}
            data-focus-trap="true"
            onClick={(e) => e.stopPropagation()}
          >
          {/* Header - JetBrains New UI: 24px horizontal padding */}
            <div class="settings-header flex items-center justify-between" style={{ 
              "padding-left": "24px", 
              "padding-right": "24px", 
              "padding-top": "11px", 
              "padding-bottom": "16px",
              "border-bottom": "1px solid var(--jb-border-default)",
              "background": "var(--jb-panel)",
            }}>
            <div class="flex items-center gap-4">
              <Text as="h2" size="lg" weight="semibold" style={{ color: "var(--jb-text-body-color)" }}>Settings</Text>
              
              {/* Settings Scope Toggle */}
              <div style={{
                display: "flex",
                "align-items": "center",
                gap: "4px",
                "border-radius": "var(--jb-radius-lg)",
                border: "1px solid var(--jb-border-default)",
                background: "var(--jb-input-bg)",
                padding: "2px",
              }}>
                <UIButton
                  onClick={() => setSettingsScope("user")}
                  variant={settingsScope() === "user" ? "primary" : "ghost"}
                  size="sm"
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "6px",
                    padding: "4px 12px",
                    "border-radius": "var(--jb-radius-sm)",
                    "font-size": "var(--jb-text-muted-size)",
                    "font-weight": "500",
                  }}
                  title="User Settings (~/.cortex/settings.json)"
                >
                  <Icon name="user" style={{ width: "12px", height: "12px" }} />
                  User
                </UIButton>
                <UIButton
                  onClick={() => setSettingsScope("workspace")}
                  disabled={!hasWorkspace()}
                  variant={settingsScope() === "workspace" ? "primary" : "ghost"}
                  size="sm"
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "6px",
                    padding: "4px 12px",
                    "border-radius": "var(--jb-radius-sm)",
                    "font-size": "var(--jb-text-muted-size)",
                    "font-weight": "500",
                    opacity: hasWorkspace() ? "1" : "0.5",
                    background: settingsScope() === "workspace" ? "var(--cortex-info)" : "transparent",
                    color: settingsScope() === "workspace" ? "#fff" : "var(--jb-text-muted-color)",
                  }}
                  title={hasWorkspace() 
                    ? `Workspace Settings (.cortex/settings.json in ${workspaceName()})` 
                    : "No workspace open"}
                >
                  <Icon name="folder" style={{ width: "12px", height: "12px" }} />
                  Workspace
                </UIButton>
                {/* Folder scope - only shown in multi-root workspaces */}
                <Show when={isMultiRoot()}>
                  <UIButton
                    onClick={() => setSettingsScope("folder")}
                    variant={settingsScope() === "folder" ? "primary" : "ghost"}
                    size="sm"
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "6px",
                      padding: "4px 12px",
                      "border-radius": "var(--jb-radius-sm)",
                      "font-size": "var(--jb-text-muted-size)",
                      "font-weight": "500",
                      background: settingsScope() === "folder" ? "var(--cortex-success)" : "transparent",
                      color: settingsScope() === "folder" ? "#fff" : "var(--jb-text-muted-color)",
                    }}
                    title="Folder Settings ({folder}/.cortex/settings.json)"
                  >
                    <Icon name="folder" style={{ width: "12px", height: "12px" }} />
                    Folder
                  </UIButton>
                </Show>
              </div>
              
              {/* Folder selector - shown when folder scope is active */}
              <Show when={settingsScope() === "folder" && isMultiRoot()}>
                <select
                  value={selectedFolder() || ""}
                  onChange={(e) => setSelectedFolder(e.currentTarget.value)}
                  style={{
                    "border-radius": "var(--jb-radius-lg)",
                    border: "1px solid rgba(5, 150, 105, 0.3)",
                    background: "rgba(5, 150, 105, 0.1)",
                    padding: "4px 12px",
                    "font-size": "var(--jb-text-muted-size)",
                    "font-weight": "500",
                    color: "var(--cortex-success)",
                  }}
                >
                  <For each={workspaceFolders()}>
                    {(folder) => (
                      <option value={folder.path} style={{ background: "var(--jb-panel)", color: "var(--jb-text-body-color)" }}>
                        {folder.name}
                      </option>
                    )}
                  </For>
                </select>
              </Show>
              
              <div style={{ position: "relative" }}>
                <Icon name="magnifying-glass" style={{ 
                  position: "absolute", 
                  left: "12px", 
                  top: "50%", 
                  transform: "translateY(-50%)", 
                  width: "16px", 
                  height: "16px", 
                  color: "var(--jb-text-muted-color)",
                  "pointer-events": "none",
                  "z-index": "1",
                }} />
                <Input
                  type="text"
                  placeholder="Search settings..."
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  style={{
                    width: "256px",
                    "padding-left": "36px",
                    "padding-right": "32px",
                  }}
                />
                <Show when={searchQuery()}>
                  <IconButton
                    onClick={() => setSearchQuery("")}
                    size="sm"
                    style={{
                      position: "absolute",
                      right: "4px",
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  >
                    <Icon name="xmark" />
                  </IconButton>
                </Show>
              </div>
            </div>
            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
              {/* JSON/GUI Toggle Button */}
              <UIButton
                onClick={() => {
                  if (showJsonView() && jsonViewDirty()) {
                    const confirmed = window.confirm(
                      "You have unsaved changes in the JSON editor. Switch anyway? Changes will be lost."
                    );
                    if (!confirmed) return;
                  }
                  setShowJsonView(!showJsonView());
                  setJsonViewDirty(false);
                }}
                variant={showJsonView() ? "secondary" : "ghost"}
                size="sm"
                icon={showJsonView() ? <Icon name="gear" style={{ width: "14px", height: "14px" }} /> : <Icon name="file-lines" style={{ width: "14px", height: "14px" }} />}
                style={showJsonView() ? {
                  background: "rgba(234, 179, 8, 0.2)",
                  color: "var(--cortex-warning)",
                  border: "1px solid rgba(234, 179, 8, 0.3)",
                } : {}}
                title={showJsonView() ? "Switch to GUI Settings" : "Open Settings (JSON)"}
              >
                {showJsonView() ? "GUI Settings" : "JSON"}
              </UIButton>
              
              {/* Close Button */}
              <IconButton
                onClick={() => {
                  if (showJsonView() && jsonViewDirty()) {
                    const confirmed = window.confirm(
                      "You have unsaved changes in the JSON editor. Close anyway? Changes will be lost."
                    );
                    if (!confirmed) return;
                  }
                  props.onClose();
                }}
                size="lg"
              >
                <Icon name="xmark" style={{ width: "20px", height: "20px" }} />
              </IconButton>
            </div>
          </div>

          {/* Workspace Info Banner */}
          <Show when={settingsScope() === "workspace" && hasWorkspace()}>
            <div style={{
              padding: "8px 24px",
              background: "rgba(168, 85, 247, 0.1)",
              "border-bottom": "1px solid rgba(168, 85, 247, 0.2)",
            }}>
              <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                <Icon name="folder" style={{ width: "12px", height: "12px", color: "var(--cortex-info)" }} />
                <Text size="xs" style={{ color: "var(--cortex-info)" }}>
                  Editing workspace settings for <strong>{workspaceName()}</strong>
                </Text>
                <Text size="xs" style={{ color: "rgba(168, 85, 247, 0.6)" }}>
                  — Settings here override your user settings for this workspace only
                </Text>
              </div>
            </div>
          </Show>

          {/* Folder Info Banner */}
          <Show when={settingsScope() === "folder" && selectedFolder()}>
            <div style={{
              padding: "8px 24px",
              background: "rgba(16, 185, 129, 0.1)",
              "border-bottom": "1px solid rgba(16, 185, 129, 0.2)",
            }}>
              <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                <Icon name="folder" style={{ width: "12px", height: "12px", color: "var(--cortex-success)" }} />
                <Text size="xs" style={{ color: "var(--cortex-success)" }}>
                  Editing folder settings for <strong>{workspaceFolders().find(f => f.path === selectedFolder())?.name || selectedFolder()}</strong>
                </Text>
                <Text size="xs" style={{ color: "rgba(16, 185, 129, 0.6)" }}>
                  — Settings here override user and workspace settings for files in this folder only
                </Text>
              </div>
            </div>
          </Show>

          {/* JSON Settings Editor View */}
          <Show when={showJsonView()}>
            <div class="h-[calc(90vh-120px)] overflow-hidden">
              <JsonSettingsEditor
                initialScope={settingsScope()}
                initialShowDefaults={initialShowDefaults}
                onSave={() => {
                  // Reload settings after JSON save
                  settings.loadSettings();
                }}
                onDirtyChange={(dirty) => setJsonViewDirty(dirty)}
              />
            </div>
          </Show>

          {/* GUI Settings View */}
          <Show when={!showJsonView()}>
          <div style={{ display: "flex", height: "calc(90vh - 120px)", overflow: "hidden" }}>
            {/* Sidebar */}
            <div style={{
              width: "256px",
              "border-right": "1px solid var(--jb-border-default)",
              "overflow-y": "auto",
              padding: "8px",
              "flex-shrink": "0",
              background: "var(--jb-panel)",
            }}>
              {/* Modified filter toggle */}
              <div style={{
                "margin-bottom": "8px",
                "padding-bottom": "8px",
                "border-bottom": "1px solid var(--jb-border-default)",
              }}>
                <UIButton
                  onClick={() => setShowModifiedOnly(!showModifiedOnly())}
                  variant={showModifiedOnly() ? "secondary" : "ghost"}
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    width: "100%",
                    padding: "6px 12px",
                    "border-radius": "var(--jb-radius-sm)",
                    "font-size": "var(--jb-text-muted-size)",
                    "font-weight": "500",
                    "justify-content": "flex-start",
                    background: showModifiedOnly() ? "rgba(234, 179, 8, 0.2)" : "transparent",
                    color: showModifiedOnly() ? "var(--cortex-warning)" : "var(--jb-text-muted-color)",
                    border: showModifiedOnly() ? "1px solid rgba(234, 179, 8, 0.3)" : "1px solid transparent",
                  }}
                  title={showModifiedOnly() ? "Show all settings" : "Show only modified settings"}
                >
                  <Icon name="filter" style={{ width: "14px", height: "14px" }} />
                  <Text size="sm" style={{ flex: "1", "text-align": "left" }}>Modified</Text>
                  <Show when={totalModifiedCount() > 0}>
                    <Badge 
                      size="sm" 
                      style={showModifiedOnly() ? {
                        background: "rgba(234, 179, 8, 0.3)",
                        color: "var(--cortex-warning)",
                      } : {}}
                    >
                      {totalModifiedCount()}
                    </Badge>
                  </Show>
                </UIButton>
              </div>
              
              <For each={SETTINGS_TREE}>
                {(item) => (
                  <SettingsTreeItem
                    item={item}
                    activeSection={activeTab()}
                    onSelect={scrollToSection}
                    depth={0}
                    getModifiedCount={getModifiedCount}
                    showModifiedOnly={showModifiedOnly()}
                  />
                )}
              </For>
            </div>

            {/* Content - JetBrains New UI: 24px horizontal padding */}
            <div 
              ref={setContentRef}
              style={{ 
                flex: "1",
                "overflow-y": "auto",
                "scroll-behavior": "smooth",
                "padding": "24px",
                "max-width": "1200px",
                "max-height": "none",
                background: "var(--jb-modal)",
                color: "var(--jb-text-body-color)",
              }}
            >
              {/* General Section */}
              <div id="settings-section-general" style={{ "margin-bottom": "48px", "scroll-margin-top": "24px" }}>
                <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
                  <SectionHeader 
                    title="General" 
                    description={settingsScope() === "workspace" ? "Override theme for this workspace" : "General application settings"}
                    icon={<Icon name="desktop" class="h-4 w-4" />}
                  />
                  <div>
                    <Text as="h3" size="sm" weight="medium" style={{ "margin-bottom": "12px", color: "var(--jb-text-body-color)" }}>Theme</Text>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <For each={themes}>
                        {(t) => {
                          const hasOverride = () => settings.hasWorkspaceOverride("theme", "theme");
                          const isSelected = () => safeThemeSettings(settings.effectiveSettings()).theme === t.value;
                          
                          return (
                            <div style={{ position: "relative" }}>
                              <UIButton
                                onClick={() => {
                                  if (settingsScope() === "workspace") {
                                    settings.setWorkspaceSetting("theme", "theme", t.value);
                                  } else {
                                    setTheme(t.value);
                                  }
                                }}
                                variant={isSelected() ? "primary" : "secondary"}
                                icon={<span style={{ width: "16px", height: "16px", display: "inline-flex" }}><t.icon /></span>}
                                style={hasOverride() ? { "box-shadow": "0 0 0 2px rgba(168, 85, 247, 0.5)" } : {}}
                              >
                                {t.label}
                              </UIButton>
                              <Show when={hasOverride() && isSelected()}>
                                <span style={{
                                  position: "absolute",
                                  top: "-4px",
                                  right: "-4px",
                                  width: "8px",
                                  height: "8px",
                                  "border-radius": "var(--cortex-radius-full)",
                                  background: "var(--cortex-info)",
                                }} />
                              </Show>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </div>
                  
                  {/* Reset workspace theme override */}
                  <Show when={settingsScope() === "workspace" && settings.hasWorkspaceOverride("theme", "theme")}>
                    <UIButton
                      onClick={() => settings.resetWorkspaceSetting("theme", "theme")}
                      variant="ghost"
                      size="sm"
                      icon={<Icon name="rotate-left" style={{ width: "12px", height: "12px" }} />}
                      style={{ color: "var(--cortex-info)" }}
                    >
                      Reset to user theme
                    </UIButton>
                  </Show>

                  {/* Divider */}
                  <div style={{ "border-top": "1px solid var(--jb-border-default)", "margin": "24px 0" }} />

                  {/* Editor Tabs Settings */}
                  <div>
                    <Text as="h3" size="sm" weight="medium" style={{ "margin-bottom": "12px", color: "var(--jb-text-body-color)" }}>Editor Tabs</Text>
                    <div style={{ position: "relative" }}>
                      <OptionCard
                        selected={safeThemeSettings(settings.effectiveSettings()).wrapTabs}
                        onSelect={async () => {
                          const currentValue = safeThemeSettings(settings.effectiveSettings()).wrapTabs;
                          if (settingsScope() === "workspace") {
                            await settings.setWorkspaceSetting("theme", "wrapTabs", !currentValue);
                          } else {
                            await settings.updateThemeSetting("wrapTabs", !currentValue);
                          }
                        }}
                        title="Wrap Tabs"
                        description="When enabled, tabs wrap to multiple lines instead of showing scroll buttons"
                      />
                      <Show when={settings.hasWorkspaceOverride("theme", "wrapTabs")}>
                        <span style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          width: "8px",
                          height: "8px",
                          "border-radius": "var(--cortex-radius-full)",
                          background: "var(--cortex-info)",
                        }} />
                      </Show>
                    </div>
                  </div>
                  
                  {/* Reset workspace wrapTabs override */}
                  <Show when={settingsScope() === "workspace" && settings.hasWorkspaceOverride("theme", "wrapTabs")}>
                    <UIButton
                      onClick={() => settings.resetWorkspaceSetting("theme", "wrapTabs")}
                      variant="ghost"
                      size="sm"
                      icon={<Icon name="rotate-left" style={{ width: "12px", height: "12px" }} />}
                      style={{ color: "var(--cortex-info)" }}
                    >
                      Reset to user setting
                    </UIButton>
                  </Show>

                  {/* Settings Location Info */}
                  <Card variant="outlined" padding="md" style={{ "margin-top": "24px" }}>
                    <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "8px" }}>
                      <Icon name="house" style={{ width: "12px", height: "12px", color: "var(--jb-text-muted-color)" }} />
                      <Text size="xs" weight="medium" style={{ color: "var(--jb-text-body-color)" }}>Settings Locations</Text>
                    </div>
                    <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
                      <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                        <Text size="xs" style={{ width: "64px", color: "var(--jb-border-focus)" }}>User:</Text>
                        <Text size="xs" style={{ color: "var(--jb-text-muted-color)", opacity: "0.8", "font-family": "monospace" }}>~/.cortex/settings.json</Text>
                      </div>
                      <Show when={hasWorkspace()}>
                        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                          <Text size="xs" style={{ width: "64px", color: "var(--cortex-info)" }}>Workspace:</Text>
                          <Text size="xs" style={{ color: "var(--jb-text-muted-color)", opacity: "0.8", "font-family": "monospace" }}>.cortex/settings.json</Text>
                        </div>
                      </Show>
                      <Show when={isMultiRoot()}>
                        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                          <Text size="xs" style={{ width: "64px", color: "var(--cortex-success)" }}>Folder:</Text>
                          <Text size="xs" style={{ color: "var(--jb-text-muted-color)", opacity: "0.8", "font-family": "monospace" }}>{"{folder}"}/.cortex/settings.json</Text>
                        </div>
                      </Show>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Explorer Section */}
              <div id="settings-section-explorer" style={{ "margin-bottom": "48px", "scroll-margin-top": "24px" }}>
                <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
                  <SectionHeader 
                    title="Explorer" 
                    description="File explorer and drag & drop settings"
                    icon={<Icon name="folder" class="h-4 w-4" />}
                  />
                  
                  {/* Sort Order */}
                  <div>
                    <Text as="h3" size="sm" weight="medium" style={{ "margin-bottom": "12px", color: "var(--jb-text-body-color)" }}>Sort Order</Text>
                    <FormGroup
                      label="File Sort Order"
                      description="Choose how files and folders are sorted in the explorer"
                    >
                      <Select
                        value={safeExplorerSettings(settings.effectiveSettings()).sortOrder}
                        onChange={async (value) => {
                          if (settingsScope() === "workspace") {
                            await settings.setWorkspaceSetting("explorer", "sortOrder", value as ExplorerSortOrder);
                          } else {
                            await settings.updateExplorerSetting("sortOrder", value as ExplorerSortOrder);
                          }
                        }}
                        options={[
                          { value: "default", label: "Name (Folders First)" },
                          { value: "mixed", label: "Name (Mixed)" },
                          { value: "filesFirst", label: "Name (Files First)" },
                          { value: "type", label: "Type" },
                          { value: "modified", label: "Date Modified" },
                          { value: "foldersNestsFiles", label: "Folders with Nests" },
                        ]}
                      />
                    </FormGroup>
                    
                    {/* Reset workspace sort order override */}
                    <Show when={settingsScope() === "workspace" && settings.hasWorkspaceOverride("explorer", "sortOrder")}>
                      <UIButton
                        onClick={() => settings.resetWorkspaceSetting("explorer", "sortOrder")}
                        variant="ghost"
                        size="sm"
                      icon={<Icon name="rotate-left" style={{ width: "12px", height: "12px" }} />}
                      style={{ color: "var(--cortex-info)", "margin-top": "8px" }}
                    >
                      Reset to user setting
                    </UIButton>
                  </Show>
                </div>
                  
                <div>
                  <Text as="h3" size="sm" weight="medium" style={{ "margin-bottom": "12px", color: "var(--jb-text-body-color)" }}>Drag and Drop</Text>
                    <OptionCard
                      selected={safeFilesSettings(settings.effectiveSettings()).confirmDragAndDrop}
                      onSelect={async () => {
                        const currentValue = safeFilesSettings(settings.effectiveSettings()).confirmDragAndDrop;
                        if (settingsScope() === "workspace") {
                          await settings.setWorkspaceSetting("files", "confirmDragAndDrop", !currentValue);
                        } else {
                          await settings.updateFilesSetting("confirmDragAndDrop", !currentValue);
                        }
                      }}
                      title="Confirm Drag and Drop"
                      description="Show a confirmation dialog before moving files via drag and drop in the file explorer"
                    />
                  </div>
                  
                  {/* Reset workspace explorer override */}
                  <Show when={settingsScope() === "workspace" && settings.hasWorkspaceOverride("files", "confirmDragAndDrop")}>
                    <UIButton
                      onClick={() => settings.resetWorkspaceSetting("files", "confirmDragAndDrop")}
                      variant="ghost"
                      size="sm"
                      icon={<Icon name="rotate-left" style={{ width: "12px", height: "12px" }} />}
                      style={{ color: "var(--cortex-info)" }}
                    >
                      Reset to user setting
                    </UIButton>
                  </Show>
                </div>
              </div>

              {/* Files Section */}
              <div id="settings-section-files" style={{ "margin-bottom": "48px", "scroll-margin-top": "24px" }}>
                <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
                  <SectionHeader 
                    title="Files" 
                    description="File associations, auto save, and formatting settings"
                    icon={<Icon name="file-lines" class="h-4 w-4" />}
                  />
                  <FilesSettingsPanel scope={settingsScope()} />
                </div>
              </div>

              {/* Security Section */}
              <div id="settings-section-security" style={{ "margin-bottom": "48px", "scroll-margin-top": "24px" }}>
                <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
                  <div>
                    <SectionHeader 
                      title="Security" 
                      description="Manage security and sandbox settings"
                      icon={<Icon name="shield" class="h-4 w-4" />}
                    />
                    <Text as="h3" weight="medium" style={{ "margin-top": "16px", "margin-bottom": "12px", display: "flex", "align-items": "center", gap: "8px", color: "var(--jb-text-body-color)" }}>
                      Sandbox Mode
                    </Text>
                    <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
                      <For each={sandboxModes}>
                        {(mode) => (
                          <UIButton
                            onClick={() => updateConfig({ sandboxMode: mode.value })}
                            variant={state.config.sandboxMode === mode.value ? "secondary" : "ghost"}
                            style={{
                              display: "flex",
                              width: "100%",
                              "align-items": "center",
                              gap: "12px",
                              "border-radius": "var(--jb-radius-lg)",
                              border: state.config.sandboxMode === mode.value ? "1px solid var(--jb-border-focus)" : "1px solid var(--jb-border-default)",
                              padding: "12px",
                              "text-align": "left",
                              "justify-content": "flex-start",
                              background: state.config.sandboxMode === mode.value ? "rgba(53, 116, 240, 0.1)" : "transparent",
                            }}
                          >
                            <div style={{
                              display: "flex",
                              width: "20px",
                              height: "20px",
                              "align-items": "center",
                              "justify-content": "center",
                              "border-radius": "var(--cortex-radius-full)",
                              border: state.config.sandboxMode === mode.value ? "1px solid var(--jb-border-focus)" : "1px solid var(--jb-border-default)",
                              background: state.config.sandboxMode === mode.value ? "var(--jb-btn-primary-bg)" : "transparent",
                            }}>
                              <Show when={state.config.sandboxMode === mode.value}>
                                <Icon name="check" style={{ width: "12px", height: "12px", color: "var(--cortex-text-primary)" }} />
                              </Show>
                            </div>
                            <div>
                              <Text weight="medium" size="sm" style={{ color: "var(--jb-text-body-color)" }}>{mode.label}</Text>
                              <Text size="xs" style={{ color: "var(--jb-text-muted-color)" }}>{mode.description}</Text>
                            </div>
                          </UIButton>
                        )}
                      </For>
                    </div>
                  </div>

                  <div>
                    <Text as="h3" weight="medium" style={{ "margin-bottom": "12px", color: "var(--jb-text-body-color)" }}>Approval Mode</Text>
                    <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
                      <For each={approvalModes}>
                        {(mode) => (
                          <UIButton
                            onClick={() => updateConfig({ approvalMode: mode.value })}
                            variant={state.config.approvalMode === mode.value ? "secondary" : "ghost"}
                            style={{
                              display: "flex",
                              width: "100%",
                              "align-items": "center",
                              gap: "12px",
                              "border-radius": "var(--jb-radius-lg)",
                              border: state.config.approvalMode === mode.value ? "1px solid var(--jb-border-focus)" : "1px solid var(--jb-border-default)",
                              padding: "12px",
                              "text-align": "left",
                              "justify-content": "flex-start",
                              background: state.config.approvalMode === mode.value ? "rgba(53, 116, 240, 0.1)" : "transparent",
                            }}
                          >
                            <div style={{
                              display: "flex",
                              width: "20px",
                              height: "20px",
                              "align-items": "center",
                              "justify-content": "center",
                              "border-radius": "var(--cortex-radius-full)",
                              border: state.config.approvalMode === mode.value ? "1px solid var(--jb-border-focus)" : "1px solid var(--jb-border-default)",
                              background: state.config.approvalMode === mode.value ? "var(--jb-btn-primary-bg)" : "transparent",
                            }}>
                              <Show when={state.config.approvalMode === mode.value}>
                                <Icon name="check" style={{ width: "12px", height: "12px", color: "var(--cortex-text-primary)" }} />
                              </Show>
                            </div>
                            <div>
                              <Text weight="medium" size="sm" style={{ color: "var(--jb-text-body-color)" }}>{mode.label}</Text>
                              <Text size="xs" style={{ color: "var(--jb-text-muted-color)" }}>{mode.description}</Text>
                            </div>
                          </UIButton>
                        )}
                      </For>
                    </div>
                  </div>
                </div>
              </div>

              {/* Network Section */}
              <div id="settings-section-network" style={{ "margin-bottom": "48px", "scroll-margin-top": "24px" }}>
                <SectionHeader
                  title="Network"
                  description="Configure HTTP proxy and network settings"
                  icon={<Icon name="globe" class="h-4 w-4" />}
                />
                <div style={{ "margin-top": "16px" }}>
                  <NetworkSettingsPanel scope={settingsScope()} />
                </div>
              </div>

              {/* Editor Section */}
              <div id="settings-section-editor" style={{ "margin-bottom": "48px", "scroll-margin-top": "24px" }}>
                <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
                  <SectionHeader
                    title="Editor Settings"
                    description="Configure editor behavior and appearance"
                    icon={<Icon name="pen-to-square" class="h-4 w-4" />}
                  />
                  
                  {/* Vim Mode Toggle */}
                  <div>
                    <Text as="h3" size="sm" weight="medium" style={{ "margin-bottom": "12px", color: "var(--jb-text-body-color)" }}>Vim Mode</Text>
                    <div style={{ position: "relative" }}>
                      <OptionCard
                        selected={vim.enabled()}
                        onSelect={() => vim.setEnabled(!vim.enabled())}
                        title={vim.enabled() ? "Vim Mode Enabled" : "Vim Mode Disabled"}
                        description={vim.enabled() 
                          ? "Use h,j,k,l for navigation, i for insert mode, v for visual mode" 
                          : "Click to enable Vim-style keyboard navigation"
                        }
                      />
                      <Show when={settings.workspaceSettings()?.vimEnabled !== undefined}>
                        <span style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          width: "8px",
                          height: "8px",
                          "border-radius": "var(--cortex-radius-full)",
                          background: "var(--cortex-info)",
                        }} />
                      </Show>
                    </div>
                  </div>

                  {/* Vim Mode Info */}
                  <Show when={vim.enabled()}>
                    <InfoBox title="Vim Keybindings Reference">
                      <div class="shortcuts-grid">
                        <div class="shortcut-item"><Kbd>i</Kbd> Insert mode</div>
                        <div class="shortcut-item"><Kbd>Esc</Kbd> Normal mode</div>
                        <div class="shortcut-item"><Kbd>v</Kbd> Visual mode</div>
                        <div class="shortcut-item"><Kbd>V</Kbd> Visual Line</div>
                        <div class="shortcut-item"><Kbd>:</Kbd> Command mode</div>
                        <div class="shortcut-item"><Kbd>h,j,k,l</Kbd> Move</div>
                        <div class="shortcut-item"><Kbd>w,b,e</Kbd> Word motions</div>
                        <div class="shortcut-item"><Kbd>d,c,y</Kbd> Operators</div>
                        <div class="shortcut-item"><Kbd>dd</Kbd> Delete line</div>
                        <div class="shortcut-item"><Kbd>yy</Kbd> Yank line</div>
                        <div class="shortcut-item"><Kbd>p</Kbd> Paste after</div>
                        <div class="shortcut-item"><Kbd>u</Kbd> Undo</div>
                      </div>
                    </InfoBox>
                  </Show>

                  {/* Divider */}
                  <div class="border-t border-border my-6" />

                  {/* Full Editor Settings Panel */}
                  <EditorSettingsPanel scope={settingsScope()} />
                </div>
              </div>

              {/* Formatting Section */}
              <div id="settings-section-formatting" style={{ "margin-bottom": "48px", "scroll-margin-top": "24px" }}>
                <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
                  {/* Formatter Enabled */}
                  <SectionHeader
                    title="Code Formatting"
                    description="Configure code formatters and triggering behavior"
                    icon={<Icon name="code" class="h-4 w-4" />}
                  />
                  <OptionCard
                    selected={formatter.state.settings.enabled}
                    onSelect={() => formatter.updateSettings({ enabled: !formatter.state.settings.enabled })}
                    title={formatter.state.settings.enabled ? "Formatting Enabled" : "Formatting Disabled"}
                    description="Enable automatic code formatting with Prettier and other formatters"
                  />

                  {/* Format on Save */}
                  <Show when={formatter.state.settings.enabled}>
                    <SectionHeader title="Format Triggers" />
                    <div class="space-y-2">
                      <OptionCard
                        selected={formatter.state.settings.formatOnSave}
                        onSelect={() => formatter.updateSettings({ formatOnSave: !formatter.state.settings.formatOnSave })}
                        title="Format On Save"
                        description="Automatically format code when saving"
                      />
                      <OptionCard
                        selected={formatter.state.settings.formatOnPaste}
                        onSelect={() => formatter.updateSettings({ formatOnPaste: !formatter.state.settings.formatOnPaste })}
                        title="Format On Paste"
                        description="Automatically format pasted code"
                      />
                    </div>

                    {/* Default Formatter */}
                    <SectionHeader title="Default Formatter" />
                    <div style={{ display: "grid", "grid-template-columns": "repeat(2, 1fr)", gap: "8px" }}>
                      <For each={["prettier", "biome", "deno"] as FormatterType[]}>
                        {(fmt) => (
                          <UIButton
                            onClick={() => formatter.updateSettings({ defaultFormatter: fmt })}
                            variant={formatter.state.settings.defaultFormatter === fmt ? "primary" : "secondary"}
                          >
                            <span>{getFormatterIcon(fmt)}</span>
                            <Text size="sm">{formatterDisplayNames[fmt]}</Text>
                          </UIButton>
                        )}
                      </For>
                    </div>

                    {/* Available Formatters */}
                    <SectionHeader
                      title="Available Formatters"
                      action={
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => formatter.checkAvailable()}
                          disabled={formatter.state.isCheckingFormatters}
                          icon={<Icon name="rotate" class={`h-3 w-3 ${formatter.state.isCheckingFormatters ? "animate-spin" : ""}`} />}
                        >
                          Refresh
                        </Button>
                      }
                    />
                    <div class="space-y-2">
                      <For each={formatter.state.availableFormatters}>
                        {(fmt) => (
                          <div class="provider-card flex items-center justify-between">
                            <div class="flex items-center gap-2">
                              <span>{getFormatterIcon(fmt.formatter)}</span>
                              <span class="text-sm font-medium">{formatterDisplayNames[fmt.formatter]}</span>
                            </div>
                            <div class="flex items-center gap-2">
                              <Show when={fmt.version}>
                                <span class="text-xs text-foreground-muted">{fmt.version}</span>
                              </Show>
                              <span class={`status-badge ${fmt.available ? "status-badge-success" : "status-badge-error"}`}>
                                {fmt.available ? "Available" : "Not Found"}
                              </span>
                            </div>
                          </div>
                        )}
                      </For>
                      <Show when={formatter.state.availableFormatters.length === 0}>
                        <p class="text-sm text-foreground-muted text-center py-4">
                          Click "Refresh" to check available formatters
                        </p>
                      </Show>
                    </div>

                    {/* Prettier Options */}
                    <SectionHeader title="Prettier Options" />
                    <FormGroup>
                      <div class="settings-row">
                        <span class="settings-row-label">Tab Width</span>
                        <select
                          value={formatter.state.settings.options.tabWidth ?? 2}
                          onChange={(e) => formatter.updateSettings({
                            options: { ...formatter.state.settings.options, tabWidth: parseInt(e.currentTarget.value) }
                          })}
                          class="settings-inline-select"
                        >
                          <option value="2">2</option>
                          <option value="4">4</option>
                          <option value="8">8</option>
                        </select>
                      </div>
                      <div class="settings-row">
                        <span class="settings-row-label">Print Width</span>
                        <select
                          value={formatter.state.settings.options.printWidth ?? 80}
                          onChange={(e) => formatter.updateSettings({
                            options: { ...formatter.state.settings.options, printWidth: parseInt(e.currentTarget.value) }
                          })}
                          class="settings-inline-select"
                        >
                          <option value="80">80</option>
                          <option value="100">100</option>
                          <option value="120">120</option>
                          <option value="140">140</option>
                        </select>
                      </div>
                      <div class="settings-row">
                        <span class="settings-row-label">Single Quote</span>
                        <Toggle
                          checked={formatter.state.settings.options.singleQuote ?? false}
                          onChange={(checked) => formatter.updateSettings({
                            options: { ...formatter.state.settings.options, singleQuote: checked }
                          })}
                        />
                      </div>
                      <div class="settings-row">
                        <span class="settings-row-label">Semicolons</span>
                        <Toggle
                          checked={formatter.state.settings.options.semi ?? true}
                          onChange={(checked) => formatter.updateSettings({
                            options: { ...formatter.state.settings.options, semi: checked }
                          })}
                        />
                      </div>
                      <div class="settings-row">
                        <span class="settings-row-label">Trailing Comma</span>
                        <select
                          value={formatter.state.settings.options.trailingComma ?? "es5"}
                          onChange={(e) => formatter.updateSettings({
                            options: { ...formatter.state.settings.options, trailingComma: e.currentTarget.value as "none" | "es5" | "all" }
                          })}
                          class="settings-inline-select"
                        >
                          <option value="none">None</option>
                          <option value="es5">ES5</option>
                          <option value="all">All</option>
                        </select>
                      </div>
                    </FormGroup>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => formatter.resetSettings()}
                    >
                      Reset to Defaults
                    </Button>
                  </Show>

                  {/* Keyboard Shortcuts Reference */}
                  <InfoBox title="Formatting Shortcuts">
                    <div class="shortcuts-grid">
                      <div class="shortcut-item"><Kbd>Shift+Alt+F</Kbd> Format Document</div>
                      <div class="shortcut-item"><Kbd>Ctrl+K Ctrl+F</Kbd> Format Selection</div>
                      <div class="shortcut-item"><Kbd>Ctrl+S</Kbd> Save (+ Format if enabled)</div>
                    </div>
                  </InfoBox>
                </div>
              </div>

              {/* Keybindings Section */}
              <div id="settings-section-keybindings" style={{ "margin-bottom": "48px", "scroll-margin-top": "24px" }}>
                <SectionHeader
                  title="Keybindings"
                  description="Customize keyboard shortcuts"
                  icon={<Icon name="key" class="h-4 w-4" />}
                />
                <div style={{ 
                  height: "500px", 
                  border: "1px solid var(--jb-border-default)", 
                  "border-radius": "var(--jb-radius-lg)", 
                  overflow: "hidden", 
                  "margin-top": "16px" 
                }}>
                  <KeymapProvider>
                    <KeymapEditor onClose={props.onClose} />
                  </KeymapProvider>
                </div>
              </div>

              {/* Terminal Section */}
              <div id="settings-section-terminal" style={{ "margin-bottom": "48px", "scroll-margin-top": "24px" }}>
                <SectionHeader
                  title="Terminal"
                  description="Configure terminal appearance and behavior"
                  icon={<Icon name="terminal" class="h-4 w-4" />}
                />
                <div style={{ "margin-top": "16px" }}>
                  <TerminalSettingsPanel scope={settingsScope()} />
                </div>
              </div>

              {/* Git Section */}
              <div id="settings-section-git" style={{ "margin-bottom": "48px", "scroll-margin-top": "24px" }}>
                <SectionHeader
                  title="Git"
                  description="Configure Git settings, autofetch, and sync behavior"
                  icon={<Icon name="code-branch" class="h-4 w-4" />}
                />
                <div style={{ "margin-top": "16px" }}>
                  <GitSettingsPanel scope={settingsScope()} />
                </div>
              </div>

              {/* Models Section */}
              <div id="settings-section-models" style={{ "margin-bottom": "48px", "scroll-margin-top": "24px" }}>
                <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
                  <SectionHeader
                    title="Models"
                    description="Configure LLM providers and API keys"
                    icon={<Icon name="microchip" class="h-4 w-4" />}
                  />
                  
                  {/* Current Model */}
                  <div>
                    <Text as="h3" weight="medium" style={{ "margin-bottom": "12px", display: "flex", "align-items": "center", gap: "8px", color: "var(--jb-text-body-color)" }}>
                      Current Model
                    </Text>
                    <Card variant="outlined" padding="md">
                      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
                        <div>
                          <Text weight="medium" size="sm" style={{ color: "var(--jb-text-body-color)" }}>{llm.getActiveModel()?.name || "No model selected"}</Text>
                          <Text size="xs" style={{ color: "var(--jb-text-muted-color)", "text-transform": "capitalize" }}>{llm.getProviderDisplayName(llm.state.activeProviderType)}</Text>
                        </div>
                        <div style={{ "text-align": "right" }}>
                          <Text size="xs" style={{ color: "var(--jb-text-muted-color)" }}>{llm.getActiveModel()?.maxContextTokens?.toLocaleString() || 0} context</Text>
                          <Text size="xs" style={{ color: "var(--jb-text-muted-color)" }}>{llm.getActiveModel()?.maxOutputTokens?.toLocaleString() || 0} output</Text>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* API Keys Configuration */}
                  <div>
                    <Text as="h3" weight="medium" style={{ "margin-bottom": "12px", display: "flex", "align-items": "center", gap: "8px", color: "var(--jb-text-body-color)" }}>
                      API Keys
                    </Text>
                    <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
                      <For each={llm.getProviderTypes()}>
                        {(providerType) => {
                          const status = () => providerStatuses().find(s => s.type === providerType);
                          const needsApiKey = llm.providerRequiresApiKey(providerType);
                          
                          return (
                            <div class="rounded-lg border border-border p-3">
                              <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center gap-2">
                                  <span class="text-lg">{getProviderIcon(providerType)}</span>
                                  <span class="font-medium text-sm">{llm.getProviderDisplayName(providerType)}</span>
                                  <Show when={status()?.isConfigured}>
                                    <span class="text-[10px] rounded-full bg-green-500/20 px-2 py-0.5 text-green-400">Configured</span>
                                  </Show>
                                  <Show when={!needsApiKey}>
                                    <span class="text-[10px] rounded-full bg-blue-500/20 px-2 py-0.5 text-blue-400">Local</span>
                                  </Show>
                                </div>
                                <Show when={needsApiKey}>
                                  <UIButton
                                    onClick={() => validateProvider(providerType)}
                                    disabled={validatingProvider() !== null}
                                    variant="ghost"
                                    size="sm"
                                  >
                                    <Icon name="rotate" class={`h-3 w-3 ${validatingProvider() === providerType ? "animate-spin" : ""}`} />
                                    Test
                                  </UIButton>
                                </Show>
                              </div>
                              
                              <Show when={needsApiKey}>
                                <div class="flex gap-2">
                                  <div class="flex-1 relative">
                                    <Input
                                      type={showApiKeys()[providerType] ? "text" : "password"}
                                      placeholder={status()?.isConfigured ? "••••••••••••" : "Enter API key"}
                                      value={apiKeyInputs()[providerType]}
                                      onInput={(e) => handleApiKeyChange(providerType, e.currentTarget.value)}
                                      style={{ "padding-right": "32px" }}
                                    />
                                    <IconButton
                                      onClick={() => toggleShowApiKey(providerType)}
                                      size="sm"
                                      style={{
                                        position: "absolute",
                                        right: "4px",
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                      }}
                                    >
                                      <Show when={showApiKeys()[providerType]} fallback={<Icon name="eye-slash" class="h-4 w-4" />}>
                                        <Icon name="eye" class="h-4 w-4" />
                                      </Show>
                                    </IconButton>
                                  </div>
                                  <UIButton
                                    onClick={() => saveApiKey(providerType)}
                                    disabled={!apiKeyInputs()[providerType]}
                                    variant="primary"
                                    size="sm"
                                  >
                                    Save
                                  </UIButton>
                                </div>
                              </Show>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </div>

                  {/* Usage Statistics */}
                  <div>
                    <h3 class="mb-3 font-medium flex items-center gap-2">
                      <Icon name="wave-pulse" class="h-4 w-4" />
                      Usage Statistics
                    </h3>
                    <div class="rounded-lg border border-border p-3">
                      <div class="grid grid-cols-3 gap-4 mb-3">
                        <div class="text-center">
                          <p class="text-2xl font-semibold">{usageStats().totalRequests.toLocaleString()}</p>
                          <p class="text-xs text-foreground-muted">Requests</p>
                        </div>
                        <div class="text-center">
                          <p class="text-2xl font-semibold">{usageStats().totalInputTokens.toLocaleString()}</p>
                          <p class="text-xs text-foreground-muted">Input Tokens</p>
                        </div>
                        <div class="text-center">
                          <p class="text-2xl font-semibold">{usageStats().totalOutputTokens.toLocaleString()}</p>
                          <p class="text-xs text-foreground-muted">Output Tokens</p>
                        </div>
                      </div>
                      
                      <div class="flex items-center justify-between mt-3 pt-3 border-t border-border">
                        <Text size="xs" style={{ color: "var(--jb-text-muted-color)" }}>
                          Since {new Date(usageStats().lastReset).toLocaleDateString()}
                        </Text>
                        <UIButton
                          onClick={() => llm.resetUsageStats()}
                          variant="ghost"
                          size="sm"
                        >
                          Reset Stats
                        </UIButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Completion Section */}
              <div id="settings-section-ai_completion" style={{ "margin-bottom": "48px", "scroll-margin-top": "24px" }}>
                <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
                  <SectionHeader
                    title="AI Completion"
                    description="Configure inline code completions and ghost text"
                    icon={<Icon name="bolt" class="h-4 w-4" />}
                  />
                  
                  {/* Supermaven Enable Toggle */}
                  <div>
                    <Text as="h3" weight="medium" style={{ "margin-bottom": "12px", display: "flex", "align-items": "center", gap: "8px", color: "var(--jb-text-body-color)" }}>
                      Supermaven
                    </Text>
                    <UIButton
                      onClick={() => supermaven.setEnabled(!supermaven.state.enabled)}
                      variant={supermaven.state.enabled ? "secondary" : "ghost"}
                      style={{
                        display: "flex",
                        width: "100%",
                        "align-items": "center",
                        gap: "12px",
                        "border-radius": "var(--jb-radius-lg)",
                        border: supermaven.state.enabled ? "1px solid var(--jb-border-focus)" : "1px solid var(--jb-border-default)",
                        padding: "12px",
                        "text-align": "left",
                        "justify-content": "flex-start",
                        background: supermaven.state.enabled ? "rgba(53, 116, 240, 0.1)" : "transparent",
                      }}
                    >
                      <div style={{
                        display: "flex",
                        width: "20px",
                        height: "20px",
                        "align-items": "center",
                        "justify-content": "center",
                        "border-radius": "var(--cortex-radius-full)",
                        border: supermaven.state.enabled ? "1px solid var(--jb-border-focus)" : "1px solid var(--jb-border-default)",
                        background: supermaven.state.enabled ? "var(--jb-btn-primary-bg)" : "transparent",
                      }}>
                        <Show when={supermaven.state.enabled}>
                          <Icon name="check" style={{ width: "12px", height: "12px", color: "var(--cortex-text-primary)" }} />
                        </Show>
                      </div>
                      <div style={{ flex: "1" }}>
                        <Text weight="medium" size="sm" style={{ color: "var(--jb-text-body-color)" }}>
                          {supermaven.state.enabled ? "Supermaven Enabled" : "Supermaven Disabled"}
                        </Text>
                        <Text size="xs" style={{ color: "var(--jb-text-muted-color)" }}>
                          {supermaven.state.enabled 
                            ? "Press Tab to accept completions, Ctrl+→ for word-by-word" 
                            : "Click to enable AI code completions"
                          }
                        </Text>
                      </div>
                    </UIButton>
                  </div>

                  {/* GitHub Copilot Section */}
                  <div>
                    <Text as="h3" weight="medium" style={{ "margin-bottom": "12px", display: "flex", "align-items": "center", gap: "8px", color: "var(--jb-text-body-color)" }}>
                      <Icon name="github" style={{ width: "16px", height: "16px" }} />
                      GitHub Copilot
                    </Text>
                    <CopilotSettingsPanel onOpenSignIn={() => setShowCopilotSignIn(true)} />
                  </div>
                </div>
              </div>

              {/* Extensions Section */}
              <div id="settings-section-extensions" style={{ "margin-bottom": "48px", "scroll-margin-top": "24px" }}>
                <SectionHeader
                  title="Extensions"
                  description="Manage installed extensions"
                  icon={<Icon name="puzzle-piece" class="h-4 w-4" />}
                />
                <div style={{ 
                  "margin-top": "16px", 
                  border: "1px solid var(--jb-border-default)", 
                  "border-radius": "var(--jb-radius-lg)", 
                  overflow: "hidden", 
                  height: "700px" 
                }}>
                  <ExtensionsPanel />
                </div>
              </div>
            </div>
          </div>
          </Show>
          </div>
        </div>
      </div>

      {/* Copilot Sign-In Modal */}
      <CopilotSignInModal
        isOpen={showCopilotSignIn()}
        onClose={() => setShowCopilotSignIn(false)}
      />
    </Show>
  );
}

// Re-export helper components for use in sub-panels
export { SettingSourceBadge, WorkspaceOverrideIndicator, SettingRow };


