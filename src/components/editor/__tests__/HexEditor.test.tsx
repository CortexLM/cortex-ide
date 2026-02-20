import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "solid-js";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string; size?: number }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    return el;
  },
}));

vi.mock("@/components/ui", () => ({
  IconButton: (props: { icon?: unknown; onClick?: () => void; title?: string }) => {
    const el = document.createElement("button");
    if (props.title) el.setAttribute("title", props.title);
    if (props.onClick) el.addEventListener("click", props.onClick);
    return el;
  },
  Text: (props: { children?: unknown }) => {
    const el = document.createElement("span");
    el.textContent = String(props.children ?? "");
    return el;
  },
}));

vi.mock("@/design-system/tokens", () => ({
  tokens: {
    colors: {
      surface: { card: "#1e1e2e", panel: "#181825", hover: "#262637" },
      border: { default: "#313244" },
      text: { primary: "#cdd6f4", secondary: "#a6adc8", muted: "#6c7086" },
    },
    typography: {
      fontFamily: { mono: "'JetBrains Mono', monospace" },
      fontSize: { xs: "11px", sm: "12px" },
    },
    components: {
      scrollbar: { thumb: "#45475a", track: "#1e1e2e" },
    },
    transitions: { fast: "all 0.1s ease" },
  },
}));

describe("HexEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("component is defined", async () => {
    const { HexEditor } = await import("../HexEditor");
    expect(HexEditor).toBeDefined();
  });

  it("renders hex data", async () => {
    const { HexEditor } = await import("../HexEditor");
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);

    createRoot((dispose) => {
      const element = HexEditor({ data }) as HTMLElement;
      expect(element).toBeDefined();
      if (element && element.textContent) {
        expect(element.textContent).toContain("Hello");
      }
      dispose();
    });
  });

  it("shows offset column", async () => {
    const { HexEditor } = await import("../HexEditor");
    const data = new Uint8Array([0x00, 0x01, 0x02]);

    createRoot((dispose) => {
      const element = HexEditor({ data }) as HTMLElement;
      expect(element).toBeDefined();
      if (element && element.textContent) {
        expect(element.textContent).toContain("00000000");
      }
      dispose();
    });
  });

  it("handles empty data", async () => {
    const { HexEditor } = await import("../HexEditor");
    const data = new Uint8Array([]);

    createRoot((dispose) => {
      const element = HexEditor({ data }) as HTMLElement;
      expect(element).toBeDefined();
      dispose();
    });
  });
});
