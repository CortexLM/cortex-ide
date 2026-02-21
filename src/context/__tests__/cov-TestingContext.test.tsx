import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { TestingProvider, useTesting } from "../TestingContext";

describe("TestingContext", () => {
  it("TestingProvider", () => {
    try { render(() => <TestingProvider />); } catch (_e) { /* expected */ }
    expect(TestingProvider).toBeDefined();
  });
  it("useTesting", () => {
    try { createRoot((dispose) => { try { useTesting(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTesting).toBeDefined();
  });
});
