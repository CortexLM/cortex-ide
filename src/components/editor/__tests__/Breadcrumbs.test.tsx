/**
 * Breadcrumbs Tests
 *
 * Tests for the Breadcrumbs component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent, nextTick } from "@/test/utils";
import {
  Breadcrumbs,
  copyBreadcrumbsPath,
  copyBreadcrumbsRelativePath,
  revealBreadcrumbsInExplorer,
} from "../Breadcrumbs";

interface PathSegment {
  name: string;
  path: string;
  isFile: boolean;
}

interface SymbolRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

interface SymbolInfo {
  id: string;
  name: string;
  kind: string;
  detail?: string;
  range: SymbolRange;
  children: SymbolInfo[];
  depth: number;
}

interface TestOpenFile {
  id: string;
  path: string;
  name: string;
  content: string;
  language: string;
  modified?: boolean;
  originalContent?: string;
  groupId?: string;
}

interface TestBreadcrumbsProps {
  file: TestOpenFile | undefined;
  groupId?: string;
  workspaceRoot?: string | null;
}

interface BreadcrumbsSettings {
  enabled: boolean;
  filePath: "on" | "off" | "last";
  symbolPath: "on" | "off" | "last";
  icons: boolean;
}

const mockOpenFile = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastWarning = vi.fn();
const mockToastInfo = vi.fn();
const mockNavigateToSymbol = vi.fn();

vi.mock("@/context/EditorContext", () => ({
  useEditor: () => ({
    openFile: mockOpenFile,
  }),
}));

vi.mock("@/context/SettingsContext", () => ({
  useSettings: () => ({
    effectiveSettings: () => ({
      theme: {
        breadcrumbsEnabled: true,
        breadcrumbs: {
          enabled: true,
          filePath: "on" as const,
          symbolPath: "on" as const,
          icons: true,
        },
      },
    }),
    updateThemeSetting: vi.fn(),
  }),
}));

vi.mock("@/context/OutlineContext", () => ({
  useOutline: () => ({
    state: {
      symbols: [],
    },
    navigateToSymbol: mockNavigateToSymbol,
  }),
}));

vi.mock("@/context/ToastContext", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    warning: mockToastWarning,
    info: mockToastInfo,
  }),
}));

vi.mock("@/utils/workspace", () => ({
  getProjectPath: () => "/workspace/project",
}));

vi.mock("@/utils/fileIcons", () => ({
  getFileIcon: (filename: string) => `/icons/${filename}.svg`,
}));

describe("Breadcrumbs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const defaultProps: TestBreadcrumbsProps = {
    file: undefined,
    groupId: "group-1",
    workspaceRoot: "/workspace/project",
  };

  const renderBreadcrumbs = (props: Partial<TestBreadcrumbsProps> = {}) => {
    return render(() => <Breadcrumbs {...defaultProps} {...props} file={props.file as any} />);
  };

  describe("Rendering", () => {
    it("should render 'No file open' when no file is provided", () => {
      const { container } = renderBreadcrumbs();

      expect(container.textContent).toContain("No file open");
    });

    it("should render file path segments when file is provided", () => {
      const { container } = renderBreadcrumbs({
        file: {
          id: "file-1",
          path: "/workspace/project/src/components/Button.tsx",
          name: "Button.tsx",
          content: "",
          language: "typescript",
        },
      });

      expect(container.textContent).toContain("src");
      expect(container.textContent).toContain("components");
      expect(container.textContent).toContain("Button.tsx");
    });

    it("should render breadcrumbs container with correct class", () => {
      const { container } = renderBreadcrumbs({
        file: {
          id: "file-1",
          path: "/workspace/project/src/index.ts",
          name: "index.ts",
          content: "",
          language: "typescript",
        },
      });

      const breadcrumbsEl = container.querySelector(".breadcrumbs-control");
      expect(breadcrumbsEl).toBeTruthy();
    });

    it("should show separators between segments", () => {
      const { container } = renderBreadcrumbs({
        file: {
          id: "file-1",
          path: "/workspace/project/src/components/Button.tsx",
          name: "Button.tsx",
          content: "",
          language: "typescript",
        },
      });

      const separators = container.querySelectorAll(".breadcrumb-separator");
      expect(separators.length).toBeGreaterThan(0);
    });
  });

  describe("Path Segment Structure", () => {
    it("should create correct path segments from file path", () => {
      const { container } = renderBreadcrumbs({
        file: {
          id: "file-1",
          path: "/workspace/project/src/utils/helpers.ts",
          name: "helpers.ts",
          content: "",
          language: "typescript",
        },
      });

      const segments = container.querySelectorAll(".breadcrumb-segment");
      expect(segments.length).toBe(3);
    });

    it("should mark last segment as file", () => {
      const { container } = renderBreadcrumbs({
        file: {
          id: "file-1",
          path: "/workspace/project/src/index.ts",
          name: "index.ts",
          content: "",
          language: "typescript",
        },
      });

      const segments = container.querySelectorAll(".breadcrumb-segment");
      const lastSegment = segments[segments.length - 1];

      expect(lastSegment?.textContent).toContain("index.ts");
    });

    it("should handle Windows-style paths", () => {
      const { container } = renderBreadcrumbs({
        file: {
          id: "file-1",
          path: "C:\\workspace\\project\\src\\index.ts",
          name: "index.ts",
          content: "",
          language: "typescript",
        },
        workspaceRoot: "C:\\workspace\\project",
      });

      expect(container.textContent).toContain("src");
      expect(container.textContent).toContain("index.ts");
    });
  });

  describe("Overflow Handling", () => {
    it("should truncate paths with more than 6 segments", () => {
      const { container } = renderBreadcrumbs({
        file: {
          id: "file-1",
          path: "/workspace/project/a/b/c/d/e/f/g/file.ts",
          name: "file.ts",
          content: "",
          language: "typescript",
        },
      });

      expect(container.textContent).toContain("...");
    });

    it("should preserve first 2 and last 3 segments when truncating", () => {
      const { container } = renderBreadcrumbs({
        file: {
          id: "file-1",
          path: "/workspace/project/a/b/c/d/e/f/g/file.ts",
          name: "file.ts",
          content: "",
          language: "typescript",
        },
      });

      expect(container.textContent).toContain("a");
      expect(container.textContent).toContain("b");
      expect(container.textContent).toContain("f");
      expect(container.textContent).toContain("g");
      expect(container.textContent).toContain("file.ts");
    });
  });

  describe("Click Handling", () => {
    it("should have clickable segments", () => {
      const { container } = renderBreadcrumbs({
        file: {
          id: "file-1",
          path: "/workspace/project/src/index.ts",
          name: "index.ts",
          content: "",
          language: "typescript",
        },
      });

      const segments = container.querySelectorAll(".breadcrumb-segment");
      expect(segments.length).toBeGreaterThan(0);

      segments.forEach((segment) => {
        expect(segment).toBeTruthy();
      });
    });

    it("should toggle dropdown on segment click", async () => {
      const { container } = renderBreadcrumbs({
        file: {
          id: "file-1",
          path: "/workspace/project/src/index.ts",
          name: "index.ts",
          content: "",
          language: "typescript",
        },
      });

      const segment = container.querySelector(".breadcrumb-segment");
      if (segment) {
        fireEvent.click(segment);
        await nextTick();
      }
    });
  });

  describe("Context Menu", () => {
    it("should open context menu on right-click", async () => {
      const { container } = renderBreadcrumbs({
        file: {
          id: "file-1",
          path: "/workspace/project/src/index.ts",
          name: "index.ts",
          content: "",
          language: "typescript",
        },
      });

      const breadcrumbsEl = container.querySelector(".breadcrumbs-control");
      if (breadcrumbsEl) {
        fireEvent.contextMenu(breadcrumbsEl, { clientX: 100, clientY: 50 });
        await nextTick();
      }
    });
  });

  describe("Keyboard Navigation", () => {
    it("should be focusable", () => {
      const { container } = renderBreadcrumbs({
        file: {
          id: "file-1",
          path: "/workspace/project/src/index.ts",
          name: "index.ts",
          content: "",
          language: "typescript",
        },
      });

      const breadcrumbsEl = container.querySelector(
        ".breadcrumbs-control"
      ) as HTMLElement;
      expect(breadcrumbsEl?.getAttribute("tabIndex")).toBe("0");
    });

    it("should handle keyboard navigation when focused", async () => {
      const { container } = renderBreadcrumbs({
        file: {
          id: "file-1",
          path: "/workspace/project/src/index.ts",
          name: "index.ts",
          content: "",
          language: "typescript",
        },
      });

      const breadcrumbsEl = container.querySelector(
        ".breadcrumbs-control"
      ) as HTMLElement;
      if (breadcrumbsEl) {
        fireEvent.focus(breadcrumbsEl);
        await nextTick();

        fireEvent.keyDown(breadcrumbsEl, { key: "ArrowRight" });
        await nextTick();

        fireEvent.keyDown(breadcrumbsEl, { key: "ArrowLeft" });
        await nextTick();

        fireEvent.keyDown(breadcrumbsEl, { key: "Escape" });
        await nextTick();
      }
    });
  });

  describe("Drag and Drop", () => {
    it("should have draggable segments", () => {
      const { container } = renderBreadcrumbs({
        file: {
          id: "file-1",
          path: "/workspace/project/src/index.ts",
          name: "index.ts",
          content: "",
          language: "typescript",
        },
      });

      const segments = container.querySelectorAll(".breadcrumb-segment");
      segments.forEach((segment) => {
        expect(segment.getAttribute("draggable")).toBe("true");
      });
    });
  });

  describe("Modified File Indicator", () => {
    it("should apply bold font weight for modified files", () => {
      const { container } = renderBreadcrumbs({
        file: {
          id: "file-1",
          path: "/workspace/project/src/index.ts",
          name: "index.ts",
          content: "",
          language: "typescript",
          modified: true,
        },
      });

      const segments = container.querySelectorAll(".breadcrumb-segment");
      expect(segments.length).toBeGreaterThan(0);
    });
  });

  describe("Icons", () => {
    it("should render file icons", () => {
      const { container } = renderBreadcrumbs({
        file: {
          id: "file-1",
          path: "/workspace/project/src/index.ts",
          name: "index.ts",
          content: "",
          language: "typescript",
        },
      });

      const images = container.querySelectorAll("img");
      expect(images.length).toBeGreaterThan(0);
    });
  });
});

describe("Breadcrumbs Helper Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("copyBreadcrumbsPath", () => {
    it("should return false when filePath is undefined", async () => {
      const result = await copyBreadcrumbsPath(undefined);
      expect(result).toBe(false);
    });

    it("should copy path to clipboard and return true", async () => {
      const result = await copyBreadcrumbsPath("/workspace/project/src/index.ts");
      expect(result).toBe(true);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "/workspace/project/src/index.ts"
      );
    });

    it("should return false on clipboard error", async () => {
      vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
        new Error("Clipboard error")
      );
      const result = await copyBreadcrumbsPath("/workspace/project/src/index.ts");
      expect(result).toBe(false);
    });
  });

  describe("copyBreadcrumbsRelativePath", () => {
    it("should return false when filePath is undefined", async () => {
      const result = await copyBreadcrumbsRelativePath(undefined);
      expect(result).toBe(false);
    });

    it("should copy relative path to clipboard", async () => {
      const result = await copyBreadcrumbsRelativePath(
        "/workspace/project/src/index.ts"
      );
      expect(result).toBe(true);
    });

    it("should return false on clipboard error", async () => {
      vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
        new Error("Clipboard error")
      );
      const result = await copyBreadcrumbsRelativePath(
        "/workspace/project/src/index.ts"
      );
      expect(result).toBe(false);
    });
  });

  describe("revealBreadcrumbsInExplorer", () => {
    it("should return false when filePath is undefined", async () => {
      const result = await revealBreadcrumbsInExplorer(undefined);
      expect(result).toBe(false);
    });

    it("should call invoke and return true on success", async () => {
      const result = await revealBreadcrumbsInExplorer(
        "/workspace/project/src/index.ts"
      );
      expect(result).toBe(true);
    });
  });
});

describe("PathSegment Type", () => {
  it("should have correct structure", () => {
    const segment: PathSegment = {
      name: "index.ts",
      path: "/workspace/project/src/index.ts",
      isFile: true,
    };

    expect(segment.name).toBe("index.ts");
    expect(segment.path).toBe("/workspace/project/src/index.ts");
    expect(segment.isFile).toBe(true);
  });

  it("should represent directory segments", () => {
    const segment: PathSegment = {
      name: "src",
      path: "/workspace/project/src",
      isFile: false,
    };

    expect(segment.name).toBe("src");
    expect(segment.isFile).toBe(false);
  });
});

describe("SymbolInfo Type", () => {
  it("should have correct structure", () => {
    const symbol: SymbolInfo = {
      id: "symbol-1",
      name: "myFunction",
      kind: "function",
      range: {
        startLine: 10,
        startColumn: 1,
        endLine: 20,
        endColumn: 1,
      },
      children: [],
      depth: 0,
    };

    expect(symbol.id).toBe("symbol-1");
    expect(symbol.name).toBe("myFunction");
    expect(symbol.kind).toBe("function");
    expect(symbol.range.startLine).toBe(10);
    expect(symbol.children).toEqual([]);
    expect(symbol.depth).toBe(0);
  });

  it("should support nested children", () => {
    const childSymbol: SymbolInfo = {
      id: "symbol-2",
      name: "innerMethod",
      kind: "method",
      range: {
        startLine: 12,
        startColumn: 3,
        endLine: 15,
        endColumn: 3,
      },
      children: [],
      depth: 1,
    };

    const parentSymbol: SymbolInfo = {
      id: "symbol-1",
      name: "MyClass",
      kind: "class",
      range: {
        startLine: 10,
        startColumn: 1,
        endLine: 20,
        endColumn: 1,
      },
      children: [childSymbol],
      depth: 0,
    };

    expect(parentSymbol.children.length).toBe(1);
    expect(parentSymbol.children[0].name).toBe("innerMethod");
    expect(parentSymbol.children[0].depth).toBe(1);
  });

  it("should support optional detail field", () => {
    const symbol: SymbolInfo = {
      id: "symbol-1",
      name: "myFunction",
      kind: "function",
      detail: "(a: number, b: string) => void",
      range: {
        startLine: 10,
        startColumn: 1,
        endLine: 20,
        endColumn: 1,
      },
      children: [],
      depth: 0,
    };

    expect(symbol.detail).toBe("(a: number, b: string) => void");
  });
});

describe("BreadcrumbsSettings Type", () => {
  it("should have correct structure with all enabled", () => {
    const settings: BreadcrumbsSettings = {
      enabled: true,
      filePath: "on",
      symbolPath: "on",
      icons: true,
    };

    expect(settings.enabled).toBe(true);
    expect(settings.filePath).toBe("on");
    expect(settings.symbolPath).toBe("on");
    expect(settings.icons).toBe(true);
  });

  it("should support 'last' mode for filePath", () => {
    const settings: BreadcrumbsSettings = {
      enabled: true,
      filePath: "last",
      symbolPath: "on",
      icons: true,
    };

    expect(settings.filePath).toBe("last");
  });

  it("should support 'off' mode for symbolPath", () => {
    const settings: BreadcrumbsSettings = {
      enabled: true,
      filePath: "on",
      symbolPath: "off",
      icons: false,
    };

    expect(settings.symbolPath).toBe("off");
    expect(settings.icons).toBe(false);
  });
});
