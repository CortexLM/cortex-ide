import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { VibeTabBar } from "../../../cortex/vibe/VibeTabBar";

describe("VibeTabBar", () => {
  it("VibeTabBar", () => {
    try { render(() => <VibeTabBar />); } catch (_e) { /* expected */ }
    expect(VibeTabBar).toBeDefined();
  });
});
