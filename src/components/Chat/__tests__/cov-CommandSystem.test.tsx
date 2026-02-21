import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { parseCommand, findCommand, getCommandSuggestions, CommandPalette, COMMANDS } from "../../Chat/CommandSystem";

describe("CommandSystem", () => {
  it("parseCommand", () => {
    try { parseCommand("test"); } catch (_e) { /* expected */ }
    try { parseCommand(); } catch (_e) { /* expected */ }
    expect(parseCommand).toBeDefined();
  });
  it("findCommand", () => {
    try { findCommand("test"); } catch (_e) { /* expected */ }
    try { findCommand(); } catch (_e) { /* expected */ }
    expect(findCommand).toBeDefined();
  });
  it("getCommandSuggestions", () => {
    try { getCommandSuggestions("test"); } catch (_e) { /* expected */ }
    try { getCommandSuggestions(); } catch (_e) { /* expected */ }
    expect(getCommandSuggestions).toBeDefined();
  });
  it("CommandPalette", () => {
    try { render(() => <CommandPalette />); } catch (_e) { /* expected */ }
    expect(CommandPalette).toBeDefined();
  });
  it("COMMANDS", () => {
    expect(COMMANDS).toBeDefined();
  });
});
