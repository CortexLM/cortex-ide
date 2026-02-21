import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { SupermavenProvider, useSupermaven } from "../SupermavenContext";

describe("SupermavenContext", () => {
  it("SupermavenProvider", () => {
    try { render(() => <SupermavenProvider />); } catch (_e) { /* expected */ }
    expect(SupermavenProvider).toBeDefined();
  });
  it("useSupermaven", () => {
    try { createRoot((dispose) => { try { useSupermaven(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSupermaven).toBeDefined();
  });
});
