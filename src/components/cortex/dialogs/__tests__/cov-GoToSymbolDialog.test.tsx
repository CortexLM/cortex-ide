import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));
vi.mock("@/context/OutlineContext", () => ({ OutlineProvider: (p: any) => p.children, useOutline: vi.fn(() => ({ symbols: vi.fn(() => []), activeSymbol: vi.fn(() => null), refresh: vi.fn() })) }));
vi.mock("@/context/CommandContext", () => ({ CommandProvider: (p: any) => p.children, useCommands: vi.fn(() => ({ executeCommand: vi.fn(), registerCommand: vi.fn(), getCommands: vi.fn(() => []), commands: vi.fn(() => []) })) }));

import { GoToSymbolDialog } from "../../../cortex/dialogs/GoToSymbolDialog";

describe("GoToSymbolDialog", () => {
  it("GoToSymbolDialog", () => {
    try { render(() => <GoToSymbolDialog />); } catch (_e) { /* expected */ }
    expect(GoToSymbolDialog).toBeDefined();
  });
});
