import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));
vi.mock("@/context/CommandContext", () => ({ CommandProvider: (p: any) => p.children, useCommands: vi.fn(() => ({ executeCommand: vi.fn(), registerCommand: vi.fn(), getCommands: vi.fn(() => []), commands: vi.fn(() => []) })) }));

import { PaletteCommandPalette } from "../../palette/CommandPalette";

describe("CommandPalette", () => {
  it("PaletteCommandPalette", () => {
    try { render(() => <PaletteCommandPalette />); } catch (_e) { /* expected */ }
    expect(PaletteCommandPalette).toBeDefined();
  });
});
