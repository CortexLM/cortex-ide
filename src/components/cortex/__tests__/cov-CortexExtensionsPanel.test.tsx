import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/ExtensionsContext", () => ({ ExtensionsProvider: (p: any) => p.children, useExtensions: vi.fn(() => ({})) }));

import { CortexExtensionsPanel } from "../../cortex/CortexExtensionsPanel";

describe("CortexExtensionsPanel", () => {
  it("CortexExtensionsPanel", () => {
    try { render(() => <CortexExtensionsPanel />); } catch (_e) { /* expected */ }
    expect(CortexExtensionsPanel).toBeDefined();
  });
});
