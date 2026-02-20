import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "solid-js";

vi.mock("@/context/OutputContext", () => ({
  useOutput: () => ({
    state: { activeChannel: "main" },
    getChannelNames: vi.fn().mockReturnValue(["main", "debug", "errors"]),
    getChannelLogLevel: vi.fn().mockReturnValue("info"),
    getLogLevel: vi.fn().mockReturnValue("info"),
    setActiveChannel: vi.fn(),
    setChannelLogLevel: vi.fn(),
    setLogLevel: vi.fn(),
    clear: vi.fn(),
    getFilteredLines: vi.fn().mockReturnValue([]),
  }),
  LOG_LEVELS: ["trace", "debug", "info", "warn", "error", "off"],
  LOG_LEVEL_LABELS: {
    trace: "Trace",
    debug: "Debug",
    info: "Info",
    warn: "Warning",
    error: "Error",
    off: "Off",
  },
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    return el;
  },
}));

describe("OutputPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export OutputPanel component", async () => {
    const { OutputPanel } = await import("../OutputPanel");
    expect(OutputPanel).toBeDefined();
    expect(typeof OutputPanel).toBe("function");
  });

  it("should render without crashing", async () => {
    const { OutputPanel } = await import("../OutputPanel");
    
    createRoot((dispose) => {
      const element = OutputPanel({});
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should accept onClose prop", async () => {
    const { OutputPanel } = await import("../OutputPanel");
    const onClose = vi.fn();
    
    createRoot((dispose) => {
      const element = OutputPanel({ onClose });
      expect(element).toBeDefined();
      dispose();
    });
  });
});
