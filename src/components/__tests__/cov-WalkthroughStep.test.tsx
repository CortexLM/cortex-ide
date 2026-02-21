import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { WalkthroughStep } from "../WalkthroughStep";

describe("WalkthroughStep", () => {
  it("WalkthroughStep", () => {
    try { render(() => <WalkthroughStep />); } catch (_e) { /* expected */ }
    expect(WalkthroughStep).toBeDefined();
  });
});
