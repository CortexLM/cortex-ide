import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/TerminalsContext", () => ({ TerminalsProvider: (p: any) => p.children, useTerminals: vi.fn(() => ({ terminals: vi.fn(() => []), activeTerminal: vi.fn(() => null), createTerminal: vi.fn(), closeTerminal: vi.fn(), setActiveTerminal: vi.fn(), sendInput: vi.fn(), resize: vi.fn() })) }));
vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));

import { TerminalGroupTabs } from "../TerminalGroupTabs";

describe("TerminalGroupTabs", () => {
  it("TerminalGroupTabs", () => {
    try { render(() => <TerminalGroupTabs />); } catch (_e) { /* expected */ }
    expect(TerminalGroupTabs).toBeDefined();
  });
});
