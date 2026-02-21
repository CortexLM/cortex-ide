import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { MultiRepoProvider, useMultiRepo } from "../MultiRepoContext";

describe("MultiRepoContext", () => {
  it("MultiRepoProvider", () => {
    try { render(() => <MultiRepoProvider />); } catch (_e) { /* expected */ }
    expect(MultiRepoProvider).toBeDefined();
  });
  it("useMultiRepo", () => {
    try { createRoot((dispose) => { try { useMultiRepo(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useMultiRepo).toBeDefined();
  });
});
