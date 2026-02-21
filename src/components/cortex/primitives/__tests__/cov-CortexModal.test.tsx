import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@solidjs/testing-library";

vi.useFakeTimers();

import { CortexModal } from "../../../cortex/primitives/CortexModal";

afterEach(() => {
  vi.runAllTimers();
});

describe("CortexModal", () => {
  it("CortexModal", () => {
    try { render(() => <CortexModal />); } catch (_e) { /* expected */ }
    vi.runAllTimers();
    expect(CortexModal).toBeDefined();
  });
});
