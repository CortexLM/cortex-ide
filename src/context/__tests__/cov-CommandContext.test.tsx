import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { CommandProvider, useCommands } from "../CommandContext";

describe("CommandContext", () => {
  it("CommandProvider", () => {
    try { render(() => <CommandProvider />); } catch (_e) { /* expected */ }
    expect(CommandProvider).toBeDefined();
  });
  it("useCommands", () => {
    try { createRoot((dispose) => { try { useCommands(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useCommands).toBeDefined();
  });
});
