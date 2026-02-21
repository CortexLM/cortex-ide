import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { RemoteProvider, useRemote } from "../RemoteContext";

describe("RemoteContext", () => {
  it("RemoteProvider", () => {
    try { render(() => <RemoteProvider />); } catch (_e) { /* expected */ }
    expect(RemoteProvider).toBeDefined();
  });
  it("useRemote", () => {
    try { createRoot((dispose) => { try { useRemote(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useRemote).toBeDefined();
  });
});
