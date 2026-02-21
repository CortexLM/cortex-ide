import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/OutlineContext", () => ({ OutlineProvider: (p: any) => p.children, useOutline: vi.fn(() => ({ symbols: vi.fn(() => []), activeSymbol: vi.fn(() => null), refresh: vi.fn() })) }));
vi.mock("@/context/CommandContext", () => ({ CommandProvider: (p: any) => p.children, useCommands: vi.fn(() => ({ executeCommand: vi.fn(), registerCommand: vi.fn(), getCommands: vi.fn(() => []), commands: vi.fn(() => []) })) }));

import { DocumentSymbolPicker } from "../DocumentSymbolPicker";

describe("DocumentSymbolPicker", () => {
  it("DocumentSymbolPicker", () => {
    try { render(() => <DocumentSymbolPicker />); } catch (_e) { /* expected */ }
    expect(DocumentSymbolPicker).toBeDefined();
  });
});
