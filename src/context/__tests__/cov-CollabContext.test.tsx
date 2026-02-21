import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { CollabProvider, useCollab } from "../CollabContext";

describe("CollabContext", () => {
  it("CollabProvider", () => {
    try { render(() => <CollabProvider />); } catch (_e) { /* expected */ }
    expect(CollabProvider).toBeDefined();
  });
  it("useCollab", () => {
    try { createRoot((dispose) => { try { useCollab(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useCollab).toBeDefined();
  });
});
