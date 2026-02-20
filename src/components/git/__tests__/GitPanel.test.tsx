/**
 * GitPanel Tests
 *
 * Tests for the GitPanel component that provides the main git integration UI
 * with staging, committing, branch management, and multiple repository support.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@/test/utils";
import { GitPanel } from "../GitPanel";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/utils/tauri-api", () => ({
  gitLog: vi.fn().mockResolvedValue([]),
  gitDiff: vi.fn().mockResolvedValue(""),
  gitSubmoduleList: vi.fn().mockResolvedValue([]),
  gitSubmoduleInit: vi.fn().mockResolvedValue(undefined),
  gitSubmoduleUpdate: vi.fn().mockResolvedValue(undefined),
  gitIsGpgConfigured: vi.fn().mockResolvedValue(false),
  gitInit: vi.fn().mockResolvedValue(undefined),
  gitTagList: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/utils/workspace", () => ({
  getProjectPath: vi.fn().mockReturnValue("/test/project"),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string; class?: string; size?: number; style?: Record<string, string> }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    if (props.class) el.className = props.class;
    return el;
  },
}));

vi.mock("@/components/ui/VirtualList", () => ({
  VirtualList: () => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "virtual-list");
    return el;
  },
}));

vi.mock("@/components/ui", () => ({
  Button: (props: { children?: unknown; onClick?: () => void; style?: Record<string, string> }) => {
    const el = document.createElement("button");
    if (props.children) el.textContent = String(props.children);
    if (props.onClick) el.addEventListener("click", props.onClick);
    return el;
  },
  IconButton: (props: { children?: unknown; onClick?: (e: Event) => void; tooltip?: string }) => {
    const el = document.createElement("button");
    if (props.tooltip) el.setAttribute("title", props.tooltip);
    if (props.onClick) el.addEventListener("click", (e) => props.onClick!(e));
    return el;
  },
  Input: (props: { placeholder?: string; value?: string }) => {
    const el = document.createElement("input");
    if (props.placeholder) el.placeholder = props.placeholder;
    if (props.value) el.value = props.value;
    return el;
  },
  Textarea: (props: { placeholder?: string; value?: string }) => {
    const el = document.createElement("textarea");
    if (props.placeholder) el.placeholder = props.placeholder;
    if (props.value) el.value = props.value;
    return el;
  },
  Badge: (props: { children?: unknown }) => {
    const el = document.createElement("span");
    if (props.children) el.textContent = String(props.children);
    return el;
  },
  Text: (props: { children?: unknown; as?: string; style?: Record<string, string> }) => {
    const el = document.createElement(props.as || "span");
    if (props.children) el.textContent = String(props.children);
    return el;
  },
  ListItem: (props: { children?: unknown; label?: string; onClick?: () => void }) => {
    const el = document.createElement("div");
    if (props.label) el.textContent = props.label;
    if (props.onClick) el.addEventListener("click", props.onClick);
    return el;
  },
}));

vi.mock("@/design-system/tokens", () => ({
  tokens: {
    colors: {
      surface: { canvas: "transparent", panel: "transparent" },
      text: { primary: "inherit", muted: "inherit" },
      border: { divider: "transparent" },
      semantic: { primary: "blue", success: "green", error: "red", warning: "orange" },
      icon: { default: "inherit" },
      interactive: { hover: "transparent" },
    },
    spacing: { sm: "4px", md: "8px", lg: "12px" },
    radius: { sm: "4px", md: "8px" },
  },
}));

vi.mock("@/context/MultiRepoContext", () => ({
  useMultiRepo: () => ({
    state: { isLoading: false },
    activeRepository: () => null,
    repositories: () => [],
    detectRepositories: vi.fn(),
    setActiveRepository: vi.fn(),
    stageFiles: vi.fn().mockResolvedValue(undefined),
    unstageFiles: vi.fn().mockResolvedValue(undefined),
    stageAll: vi.fn().mockResolvedValue(undefined),
    unstageAll: vi.fn().mockResolvedValue(undefined),
    discardChanges: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(true),
    checkout: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
    pull: vi.fn().mockResolvedValue(undefined),
    fetch: vi.fn().mockResolvedValue(undefined),
    createBranch: vi.fn().mockResolvedValue(undefined),
    deleteBranch: vi.fn().mockResolvedValue(undefined),
    mergeBranch: vi.fn().mockResolvedValue({ hasConflicts: false }),
    executeCrossRepoOperation: vi.fn().mockResolvedValue(undefined),
    getSummary: () => ({ totalRepos: 0, reposWithChanges: 0, totalConflicts: 0 }),
  }),
}));

vi.mock("@/context/SettingsContext", () => ({
  useSettings: () => ({
    effectiveSettings: () => ({
      git: {
        branchSortOrder: "alphabetically",
        postCommitCommand: "none",
      },
    }),
  }),
}));

vi.mock("@/context/WorkspaceContext", () => ({
  useWorkspace: () => ({
    folders: () => [{ path: "/test/project" }],
  }),
}));

vi.mock("../CommitGraph", () => ({
  CommitGraph: () => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "commit-graph");
    return el;
  },
}));

vi.mock("../StashPanel", () => ({
  StashPanel: () => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "stash-panel");
    return el;
  },
}));

vi.mock("../TagManager", () => ({
  TagManager: () => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "tag-manager");
    return el;
  },
}));

vi.mock("../IncomingOutgoingView", () => ({
  IncomingOutgoingSection: () => null,
  IncomingOutgoingView: () => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "incoming-outgoing-view");
    return el;
  },
}));

vi.mock("../GitLFSManager", () => ({
  GitLFSManager: () => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "git-lfs-manager");
    return el;
  },
}));

vi.mock("../WorktreeManager", () => ({
  WorktreeManager: () => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "worktree-manager");
    return el;
  },
}));

describe("GitPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(() => <GitPanel />);
      expect(container).toBeTruthy();
    });

    it("should be a defined component", () => {
      expect(GitPanel).toBeDefined();
      expect(typeof GitPanel).toBe("function");
    });
  });
});
