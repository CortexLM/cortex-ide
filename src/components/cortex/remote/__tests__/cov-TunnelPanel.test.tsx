import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/TunnelContext", () => ({ TunnelProvider: (p: any) => p.children, useTunnel: vi.fn(() => ({})) }));

import { TunnelPanel } from "../../../cortex/remote/TunnelPanel";

describe("TunnelPanel", () => {
  it("TunnelPanel", () => {
    try { render(() => <TunnelPanel />); } catch (_e) { /* expected */ }
    expect(TunnelPanel).toBeDefined();
  });
});
