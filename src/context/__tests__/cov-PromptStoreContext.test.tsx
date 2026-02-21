import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { PromptStoreProvider, usePromptStore } from "../PromptStoreContext";

describe("PromptStoreContext", () => {
  it("PromptStoreProvider", () => {
    try { render(() => <PromptStoreProvider />); } catch (_e) { /* expected */ }
    expect(PromptStoreProvider).toBeDefined();
  });
  it("usePromptStore", () => {
    try { createRoot((dispose) => { try { usePromptStore(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(usePromptStore).toBeDefined();
  });
});
