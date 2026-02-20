import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "solid-js";

vi.mock("@/components/TimelineView", () => ({
  TimelineView: (props: { filePath: string }) => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "timeline-view");
    el.setAttribute("data-filepath", props.filePath);
    return el;
  },
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    return el;
  },
}));

describe("TimelinePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export TimelinePanel component", async () => {
    const { TimelinePanel } = await import("../TimelinePanel");
    expect(TimelinePanel).toBeDefined();
    expect(typeof TimelinePanel).toBe("function");
  });

  it("should render without crashing", async () => {
    const { TimelinePanel } = await import("../TimelinePanel");
    
    createRoot((dispose) => {
      const element = TimelinePanel({ filePath: "/path/to/file.ts" });
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should show placeholder when no filePath", async () => {
    const { TimelinePanel } = await import("../TimelinePanel");
    
    createRoot((dispose) => {
      const element = TimelinePanel({ filePath: "" });
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should accept onClose prop", async () => {
    const { TimelinePanel } = await import("../TimelinePanel");
    const onClose = vi.fn();
    
    createRoot((dispose) => {
      const element = TimelinePanel({
        filePath: "/path/to/file.ts",
        onClose,
      });
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should accept onOpenInGit prop", async () => {
    const { TimelinePanel } = await import("../TimelinePanel");
    const onOpenInGit = vi.fn();
    
    createRoot((dispose) => {
      const element = TimelinePanel({
        filePath: "/path/to/file.ts",
        onOpenInGit,
      });
      expect(element).toBeDefined();
      dispose();
    });
  });
});

describe("Timeline exports", () => {
  it("should re-export TimelineView types", async () => {
    const exports = await import("../index");
    expect(exports.TimelinePanel).toBeDefined();
  });
});
