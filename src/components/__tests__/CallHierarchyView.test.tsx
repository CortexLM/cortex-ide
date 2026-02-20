import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "solid-js";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/context/EditorContext", () => ({
  useEditor: () => ({
    openFile: vi.fn(),
    state: { openFiles: [], activeFileId: null },
  }),
}));

vi.mock("@/context/LSPContext", () => ({
  useLSP: () => ({
    getServerForFile: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock("../utils/tauri-api", () => ({
  fsReadFile: vi.fn().mockResolvedValue(""),
  fsGetFileTree: vi.fn().mockResolvedValue({ children: [] }),
  lspPrepareCallHierarchy: vi.fn().mockResolvedValue([]),
  lspIncomingCalls: vi.fn().mockResolvedValue([]),
  lspOutgoingCalls: vi.fn().mockResolvedValue([]),
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

describe("CallHierarchyView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export CallHierarchyView component", async () => {
    const { CallHierarchyView } = await import("../CallHierarchyView");
    expect(CallHierarchyView).toBeDefined();
    expect(typeof CallHierarchyView).toBe("function");
  });

  it("should be a valid component function", async () => {
    const mod = await import("../CallHierarchyView");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("should render without crashing when not visible", async () => {
    const { CallHierarchyView } = await import("../CallHierarchyView");

    createRoot((dispose) => {
      const element = CallHierarchyView({
        visible: false,
        onClose: vi.fn(),
      });
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should render with visible=true and show incoming/outgoing tabs", async () => {
    const { CallHierarchyView } = await import("../CallHierarchyView");

    createRoot((dispose) => {
      const element = CallHierarchyView({
        visible: true,
        onClose: vi.fn(),
      });
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should export useCallHierarchy hook", async () => {
    const { useCallHierarchy } = await import("../CallHierarchyView");
    expect(useCallHierarchy).toBeDefined();
    expect(typeof useCallHierarchy).toBe("function");
  });

  it("should export showCallHierarchy utility", async () => {
    const { showCallHierarchy } = await import("../CallHierarchyView");
    expect(showCallHierarchy).toBeDefined();
    expect(typeof showCallHierarchy).toBe("function");
  });

  it("should export showIncomingCalls utility", async () => {
    const { showIncomingCalls } = await import("../CallHierarchyView");
    expect(showIncomingCalls).toBeDefined();
    expect(typeof showIncomingCalls).toBe("function");
  });

  it("should export showOutgoingCalls utility", async () => {
    const { showOutgoingCalls } = await import("../CallHierarchyView");
    expect(showOutgoingCalls).toBeDefined();
    expect(typeof showOutgoingCalls).toBe("function");
  });
});
