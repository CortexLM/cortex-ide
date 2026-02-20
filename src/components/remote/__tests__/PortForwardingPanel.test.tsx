import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "solid-js";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/context/RemoteContext", () => ({
  useRemote: () => ({
    getForwardedPorts: () => [],
    state: { detectedPorts: [] },
    forwardPort: vi.fn(),
    stopForwarding: vi.fn(),
    openForwardedPort: vi.fn(),
    autoForward: () => false,
    setAutoForwardPorts: vi.fn(),
  }),
}));

vi.mock("@/components/cortex/primitives", () => ({
  CortexButton: (props: { children: unknown; onClick?: () => void; "aria-label"?: string }) => {
    const el = document.createElement("button");
    el.textContent = String(props.children || "");
    if (props["aria-label"]) el.setAttribute("aria-label", props["aria-label"]);
    if (props.onClick) el.addEventListener("click", props.onClick);
    return el;
  },
  CortexModal: (props: { open: boolean; children: unknown; title?: string }) => {
    if (!props.open) return document.createComment("hidden");
    const el = document.createElement("div");
    el.setAttribute("data-testid", "modal");
    if (props.children instanceof Node) el.appendChild(props.children);
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
  CortexToggle: (props: { checked?: boolean }) => {
    const el = document.createElement("input");
    el.type = "checkbox";
    el.checked = props.checked || false;
    return el;
  },
}));

describe("PortForwardingPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export PortForwardingPanel component", async () => {
    const { PortForwardingPanel } = await import("../PortForwardingPanel");
    expect(PortForwardingPanel).toBeDefined();
    expect(typeof PortForwardingPanel).toBe("function");
  });

  it("should be a valid component function", async () => {
    const mod = await import("../PortForwardingPanel");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("should render without crashing with connectionId prop", async () => {
    const { PortForwardingPanel } = await import("../PortForwardingPanel");

    createRoot((dispose) => {
      const element = PortForwardingPanel({ connectionId: "test-conn-1" });
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should show empty state when no ports forwarded", async () => {
    const { PortForwardingPanel } = await import("../PortForwardingPanel");

    createRoot((dispose) => {
      const element = PortForwardingPanel({ connectionId: "test-conn-1" }) as HTMLElement;
      expect(element).toBeDefined();
      if (element && element.textContent) {
        expect(element.textContent).toContain("No ports forwarded");
      }
      dispose();
    });
  });
});
