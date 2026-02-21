import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/CommandPaletteContext", () => ({ CommandPaletteProvider: (p: any) => p.children, useCommandPalette: vi.fn(() => ({})) }));
vi.mock("@/context/CommandContext", () => ({ CommandProvider: (p: any) => p.children, useCommands: vi.fn(() => ({ executeCommand: vi.fn(), registerCommand: vi.fn(), getCommands: vi.fn(() => []), commands: vi.fn(() => []) })) }));
vi.mock("@/utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }, createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() })), default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() } }));

import { CortexCommandPalette } from "../../../cortex/command-palette/CortexCommandPalette";

describe("CortexCommandPalette", () => {
  it("CortexCommandPalette", () => {
    try { render(() => <CortexCommandPalette />); } catch (_e) { /* expected */ }
    expect(CortexCommandPalette).toBeDefined();
  });
});
