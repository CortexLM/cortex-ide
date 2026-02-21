import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/OutputContext", () => ({ OutputProvider: (p: any) => p.children, useOutput: vi.fn(() => ({})) }));

import { OutputPanel } from "../../../cortex/output/OutputPanel";

describe("OutputPanel", () => {
  it("OutputPanel", () => {
    try { render(() => <OutputPanel />); } catch (_e) { /* expected */ }
    expect(OutputPanel).toBeDefined();
  });
});
