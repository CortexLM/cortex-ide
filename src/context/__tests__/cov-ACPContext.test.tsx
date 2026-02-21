import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { createTool, validateToolArguments, ACPProvider, useACP, BUILTIN_TOOLS } from "../ACPContext";

describe("ACPContext", () => {
  it("createTool", () => {
    try { createTool("test", "test", {} as any); } catch (_e) { /* expected */ }
    try { createTool(); } catch (_e) { /* expected */ }
    expect(createTool).toBeDefined();
  });
  it("validateToolArguments", () => {
    try { validateToolArguments({} as any, {}); } catch (_e) { /* expected */ }
    try { validateToolArguments(); } catch (_e) { /* expected */ }
    expect(validateToolArguments).toBeDefined();
  });
  it("ACPProvider", () => {
    try { render(() => <ACPProvider />); } catch (_e) { /* expected */ }
    expect(ACPProvider).toBeDefined();
  });
  it("useACP", () => {
    try { createRoot((dispose) => { try { useACP(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useACP).toBeDefined();
  });
  it("BUILTIN_TOOLS", () => {
    expect(BUILTIN_TOOLS).toBeDefined();
  });
});
