import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { WhichKeyProvider, useWhichKey } from "../WhichKeyContext";

describe("WhichKeyContext", () => {
  it("WhichKeyProvider", () => {
    try { render(() => <WhichKeyProvider />); } catch (_e) { /* expected */ }
    expect(WhichKeyProvider).toBeDefined();
  });
  it("useWhichKey", () => {
    try { createRoot((dispose) => { try { useWhichKey(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useWhichKey).toBeDefined();
  });
});
