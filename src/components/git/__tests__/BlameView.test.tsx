/**
 * BlameView Tests
 *
 * Tests for the BlameView component that displays git blame annotations
 * with heatmap visualization and commit details.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@/test/utils";
import { BlameView } from "../BlameView";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/utils/tauri-api", () => ({
  gitBlame: vi.fn().mockResolvedValue([]),
  gitBlameWithHeatmap: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/utils/workspace", () => ({
  getProjectPath: vi.fn().mockReturnValue("/test/project"),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string; class?: string; style?: Record<string, string> }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    if (props.class) el.className = props.class;
    return el;
  },
}));

describe("BlameView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(() => <BlameView filePath="src/test.ts" />);
      expect(container).toBeTruthy();
    });

    it("should be a defined component", () => {
      expect(BlameView).toBeDefined();
      expect(typeof BlameView).toBe("function");
    });

    it("should accept filePath prop", () => {
      const { container } = render(() => <BlameView filePath="src/index.ts" />);
      expect(container).toBeTruthy();
    });

    it("should accept onNavigateToCommit prop", () => {
      const onNavigateToCommit = vi.fn();
      const { container } = render(() => (
        <BlameView filePath="src/test.ts" onNavigateToCommit={onNavigateToCommit} />
      ));
      expect(container).toBeTruthy();
    });

    it("should display Git Blame header", () => {
      const { container } = render(() => <BlameView filePath="src/test.ts" />);
      expect(container.textContent).toContain("Git Blame");
    });

    it("should display the file path", () => {
      const { container } = render(() => <BlameView filePath="src/test.ts" />);
      expect(container.textContent).toContain("src/test.ts");
    });
  });
});
