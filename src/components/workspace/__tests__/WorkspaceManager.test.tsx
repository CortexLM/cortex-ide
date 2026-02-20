import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/context/workspace/MultiRootProvider", () => ({
  useMultiRoot: () => ({
    folders: () => [
      { path: "/home/user/project1", name: "Project 1" },
      { path: "/home/user/project2", name: "Project 2" },
    ],
    workspaceFilePath: () => "/home/user/workspace.cortex-workspace.json",
    isMultiRoot: () => true,
    addFolder: vi.fn(),
    removeFolder: vi.fn(),
    saveWorkspace: vi.fn(),
    loadWorkspace: vi.fn(),
    getFolderSettings: () => ({}),
    setFolderSettings: vi.fn(),
    perFolderSettings: {},
  }),
}));

vi.mock("@/components/cortex/primitives", () => ({
  CortexButton: (props: { children?: unknown; onClick?: () => void; icon?: string; title?: string; class?: string }) => {
    const el = document.createElement("button");
    el.textContent = String(props.children || "");
    if (props.title) el.setAttribute("title", props.title);
    if (props.onClick) el.addEventListener("click", props.onClick);
    return el;
  },
  CortexIcon: (props: { name: string; size?: number }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    return el;
  },
  CortexTooltip: (props: { children: unknown; content?: string }) => {
    if (props.children instanceof Node) return props.children;
    const el = document.createElement("div");
    return el;
  },
}));

describe("WorkspaceManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("component is defined", async () => {
    const { WorkspaceManager } = await import("../WorkspaceManager");
    expect(WorkspaceManager).toBeDefined();
    expect(typeof WorkspaceManager).toBe("function");
  });

  it("renders folder list", async () => {
    const { WorkspaceManager } = await import("../WorkspaceManager");
    const { container } = render(() => <WorkspaceManager />);
    expect(container.textContent).toContain("Project 1");
    expect(container.textContent).toContain("Project 2");
  });

  it("shows multi-root indicator", async () => {
    const { WorkspaceManager } = await import("../WorkspaceManager");
    const { container } = render(() => <WorkspaceManager />);
    expect(container.innerHTML).toBeTruthy();
    expect(container.textContent).toContain("Multi-root");
  });
});
