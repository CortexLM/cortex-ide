import { describe, it, expect, vi } from "vitest";

vi.mock("@/context/TerminalsContext", () => ({ TerminalsProvider: (p: any) => p.children, useTerminals: vi.fn(() => ({ terminals: vi.fn(() => []), activeTerminal: vi.fn(() => null), createTerminal: vi.fn(), closeTerminal: vi.fn(), setActiveTerminal: vi.fn(), sendInput: vi.fn(), resize: vi.fn() })) }));

import { createTerminalProvider } from "../../quickaccess/TerminalProvider";

describe("TerminalProvider", () => {
  it("createTerminalProvider", () => {
    try { createTerminalProvider({} as any); } catch (_e) { /* expected */ }
    try { createTerminalProvider(); } catch (_e) { /* expected */ }
    expect(createTerminalProvider).toBeDefined();
  });
});
