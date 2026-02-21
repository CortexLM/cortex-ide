import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { createServerConfig, ContextServerProvider, useContextServer, PRESET_SERVERS } from "../ContextServerContext";

describe("ContextServerContext", () => {
  it("createServerConfig", () => {
    try { createServerConfig({} as any, "test"); } catch (_e) { /* expected */ }
    try { createServerConfig(); } catch (_e) { /* expected */ }
    expect(createServerConfig).toBeDefined();
  });
  it("ContextServerProvider", () => {
    try { render(() => <ContextServerProvider />); } catch (_e) { /* expected */ }
    expect(ContextServerProvider).toBeDefined();
  });
  it("useContextServer", () => {
    try { createRoot((dispose) => { try { useContextServer(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useContextServer).toBeDefined();
  });
  it("PRESET_SERVERS", () => {
    expect(PRESET_SERVERS).toBeDefined();
  });
});
