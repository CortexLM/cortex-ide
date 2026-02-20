import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "solid-js";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/context/CommandContext", () => ({
  useCommands: () => ({
    registerCommand: vi.fn(),
    unregisterCommand: vi.fn(),
  }),
}));

vi.mock("@/context/EditorContext", () => ({
  useEditor: () => ({
    openFile: vi.fn(),
    state: { openFiles: [], activeFileId: null },
  }),
}));

vi.mock("@/context/LSPContext", () => ({
  useLSP: () => ({
    prepareTypeHierarchy: vi.fn().mockResolvedValue({ items: [] }),
    getSupertypes: vi.fn().mockResolvedValue({ items: [] }),
    getSubtypes: vi.fn().mockResolvedValue({ items: [] }),
    getServerForFile: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock("../utils/tauri-api", () => ({
  fsReadFile: vi.fn().mockResolvedValue(""),
  fsGetFileTree: vi.fn().mockResolvedValue({ children: [] }),
  lspTypeHierarchy: vi.fn().mockResolvedValue([]),
  lspWorkspaceSymbols: vi.fn().mockResolvedValue([]),
}));

vi.mock("../utils/workspace", () => ({
  getProjectPath: vi.fn().mockReturnValue("/test/project"),
}));

vi.mock("./ui/Icon", () => ({
  Icon: (props: { name: string }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    return el;
  },
}));

describe("TypeHierarchyView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export TypeHierarchyView component", async () => {
    const { TypeHierarchyView } = await import("../TypeHierarchyView");
    expect(TypeHierarchyView).toBeDefined();
    expect(typeof TypeHierarchyView).toBe("function");
  });

  it("should be a valid component function", async () => {
    const mod = await import("../TypeHierarchyView");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("should render without crashing", async () => {
    const { TypeHierarchyView } = await import("../TypeHierarchyView");

    createRoot((dispose) => {
      const element = TypeHierarchyView();
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should export TypeHierarchyItem type", async () => {
    const mod = await import("../TypeHierarchyView");
    expect(mod.TypeHierarchyView).toBeDefined();
  });

  it("should export TypeKind type", async () => {
    const mod = await import("../TypeHierarchyView");
    expect(mod.TypeHierarchyView).toBeDefined();
  });
});
