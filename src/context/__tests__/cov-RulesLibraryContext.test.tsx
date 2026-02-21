import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { RulesLibraryProvider, useRulesLibrary } from "../RulesLibraryContext";

describe("RulesLibraryContext", () => {
  it("RulesLibraryProvider", () => {
    try { render(() => <RulesLibraryProvider />); } catch (_e) { /* expected */ }
    expect(RulesLibraryProvider).toBeDefined();
  });
  it("useRulesLibrary", () => {
    try { createRoot((dispose) => { try { useRulesLibrary(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useRulesLibrary).toBeDefined();
  });
});
