/**
 * DiffView Tests
 *
 * Tests for the DiffView component that displays file diffs
 * with unified/split view modes and hunk-level staging.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@/test/utils";
import { DiffView } from "../DiffView";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/utils/tauri-api", () => ({
  gitDiff: vi.fn().mockResolvedValue(""),
  gitStageHunk: vi.fn().mockResolvedValue(undefined),
  gitUnstageHunk: vi.fn().mockResolvedValue(undefined),
  gitRevertHunk: vi.fn().mockResolvedValue(undefined),
  fsReadFile: vi.fn().mockResolvedValue(""),
  fsWriteFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/utils/workspace", () => ({
  getProjectPath: vi.fn().mockReturnValue("/test/project"),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string; class?: string }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    if (props.class) el.className = props.class;
    return el;
  },
}));

vi.mock("@/utils/monacoManager", () => ({
  MonacoManager: {
    getInstance: () => ({
      ensureLoaded: vi.fn().mockResolvedValue({
        editor: {
          createDiffEditor: vi.fn().mockReturnValue({
            setModel: vi.fn(),
            dispose: vi.fn(),
            getModel: vi.fn().mockReturnValue(null),
            updateOptions: vi.fn(),
          }),
          createModel: vi.fn().mockReturnValue({ dispose: vi.fn(), onDidChangeContent: vi.fn(), getValue: vi.fn() }),
          getModel: vi.fn().mockReturnValue(null),
        },
        Uri: { parse: vi.fn().mockReturnValue({}) },
      }),
    }),
  },
}));

vi.mock("@/design-system/tokens", () => ({
  tokens: {
    colors: {
      surface: { canvas: "transparent", panel: "transparent" },
      text: { primary: "inherit", muted: "inherit" },
      border: { divider: "transparent" },
      semantic: { primary: "blue", success: "green", error: "red" },
      icon: { default: "inherit" },
    },
    spacing: { sm: "4px", md: "8px", lg: "12px" },
    radius: { sm: "4px", md: "8px" },
  },
}));

vi.mock("../DiffLine", () => ({
  getLinePrefix: vi.fn().mockReturnValue(" "),
  DiffLine: () => null,
  computeWordDiff: vi.fn(),
  getLineBackground: vi.fn(),
  getLineColor: vi.fn(),
}));

vi.mock("../DiffHunk", () => ({
  DiffHunk: () => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "diff-hunk");
    return el;
  },
}));

vi.mock("../DiffToolbar", () => ({
  DiffToolbar: () => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "diff-toolbar");
    return el;
  },
}));

describe("DiffView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(() => <DiffView />);
      expect(container).toBeTruthy();
    });

    it("should be a defined component", () => {
      expect(DiffView).toBeDefined();
      expect(typeof DiffView).toBe("function");
    });

    it("should accept file prop", () => {
      const { container } = render(() => <DiffView file="test.ts" />);
      expect(container).toBeTruthy();
    });

    it("should accept staged prop", () => {
      const { container } = render(() => <DiffView file="test.ts" staged={true} />);
      expect(container).toBeTruthy();
    });

    it("should accept onClose prop", () => {
      const onClose = vi.fn();
      const { container } = render(() => <DiffView onClose={onClose} />);
      expect(container).toBeTruthy();
    });

    it("should accept showLineNumbers prop", () => {
      const { container } = render(() => <DiffView showLineNumbers={true} />);
      expect(container).toBeTruthy();
    });

    it("should accept repoPath prop", () => {
      const { container } = render(() => <DiffView repoPath="/custom/path" />);
      expect(container).toBeTruthy();
    });
  });
});
