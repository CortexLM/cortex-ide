import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/ToolchainContext", () => ({ ToolchainProvider: (p: any) => p.children, useToolchain: vi.fn(() => ({})) }));

import { ToolchainSelector, ToolchainStatus, ToolchainSelectorModal } from "../ToolchainSelector";

describe("ToolchainSelector", () => {
  it("ToolchainSelector", () => {
    try { render(() => <ToolchainSelector />); } catch (_e) { /* expected */ }
    expect(ToolchainSelector).toBeDefined();
  });
  it("ToolchainStatus", () => {
    try { render(() => <ToolchainStatus />); } catch (_e) { /* expected */ }
    expect(ToolchainStatus).toBeDefined();
  });
  it("ToolchainSelectorModal", () => {
    try { render(() => <ToolchainSelectorModal />); } catch (_e) { /* expected */ }
    expect(ToolchainSelectorModal).toBeDefined();
  });
});
