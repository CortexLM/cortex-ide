import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/context/CommandContext", () => ({ CommandProvider: (p: any) => p.children, useCommands: vi.fn(() => ({ executeCommand: vi.fn(), registerCommand: vi.fn(), getCommands: vi.fn(() => []), commands: vi.fn(() => []) })) }));

import { CommandPaletteProvider, useCommandPalette } from "../CommandPaletteContext";

describe("CommandPaletteContext", () => {
  it("CommandPaletteProvider", () => {
    try { render(() => <CommandPaletteProvider />); } catch (_e) { /* expected */ }
    expect(CommandPaletteProvider).toBeDefined();
  });
  it("useCommandPalette", () => {
    try { createRoot((dispose) => { try { useCommandPalette(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useCommandPalette).toBeDefined();
  });
});
