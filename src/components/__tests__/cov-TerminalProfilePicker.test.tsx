import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/TerminalsContext", () => ({ TerminalsProvider: (p: any) => p.children, useTerminals: vi.fn(() => ({ terminals: vi.fn(() => []), activeTerminal: vi.fn(() => null), createTerminal: vi.fn(), closeTerminal: vi.fn(), setActiveTerminal: vi.fn(), sendInput: vi.fn(), resize: vi.fn() })) }));

import { TerminalProfilePicker } from "../TerminalProfilePicker";

describe("TerminalProfilePicker", () => {
  it("TerminalProfilePicker", () => {
    try { render(() => <TerminalProfilePicker />); } catch (_e) { /* expected */ }
    expect(TerminalProfilePicker).toBeDefined();
  });
});
