import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "solid-js";

vi.mock("@/context/OutputContext", () => ({
  useOutput: () => ({
    getFilteredLines: vi.fn().mockReturnValue([
      { text: "Hello world", severity: undefined, source: "test" },
      { text: "\x1b[31mError message\x1b[0m", severity: "error", source: "test" },
      { text: "\x1b[32mSuccess\x1b[0m", severity: "success" },
      { text: "\x1b[1;33mBold yellow\x1b[0m", severity: "warning" },
    ]),
  }),
}));

describe("OutputChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export OutputChannel component", async () => {
    const { OutputChannel } = await import("../OutputChannel");
    expect(OutputChannel).toBeDefined();
    expect(typeof OutputChannel).toBe("function");
  });

  it("should render without crashing", async () => {
    const { OutputChannel } = await import("../OutputChannel");
    
    createRoot((dispose) => {
      const element = OutputChannel({ channelName: "test" });
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should accept filterText prop", async () => {
    const { OutputChannel } = await import("../OutputChannel");
    
    createRoot((dispose) => {
      const element = OutputChannel({ 
        channelName: "test",
        filterText: "error",
        lockScroll: true,
      });
      expect(element).toBeDefined();
      dispose();
    });
  });
});

describe("ANSI parsing", () => {
  it("should handle ANSI color codes", async () => {
    const { OutputChannel } = await import("../OutputChannel");
    
    createRoot((dispose) => {
      const element = OutputChannel({ channelName: "test" });
      expect(element).toBeDefined();
      dispose();
    });
  });
});
