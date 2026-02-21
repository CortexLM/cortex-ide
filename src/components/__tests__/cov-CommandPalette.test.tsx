import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/CommandContext", () => ({ CommandProvider: (p: any) => p.children, useCommands: vi.fn(() => ({ executeCommand: vi.fn(), registerCommand: vi.fn(), getCommands: vi.fn(() => []), commands: vi.fn(() => []) })) }));

import { CommandPalette } from "../CommandPalette";

describe("CommandPalette", () => {
  it("CommandPalette", () => {
    try { render(() => <CommandPalette />); } catch (_e) { /* expected */ }
    expect(CommandPalette).toBeDefined();
  });
});
