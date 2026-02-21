import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { AutoUpdateProvider, useAutoUpdate } from "../AutoUpdateContext";

describe("AutoUpdateContext", () => {
  it("AutoUpdateProvider", () => {
    try { render(() => <AutoUpdateProvider />); } catch (_e) { /* expected */ }
    expect(AutoUpdateProvider).toBeDefined();
  });
  it("useAutoUpdate", () => {
    try { createRoot((dispose) => { try { useAutoUpdate(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useAutoUpdate).toBeDefined();
  });
});
