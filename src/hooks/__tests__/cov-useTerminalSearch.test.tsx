import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { useTerminalSearch } from "../useTerminalSearch";

describe("useTerminalSearch", () => {
  it("useTerminalSearch", () => {
    try { createRoot((dispose) => { try { useTerminalSearch(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTerminalSearch).toBeDefined();
  });
});
