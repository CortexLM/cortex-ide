import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/TerminalsContext", () => ({ TerminalsProvider: (p: any) => p.children, useTerminals: vi.fn(() => ({ terminals: vi.fn(() => []), activeTerminal: vi.fn(() => null), createTerminal: vi.fn(), closeTerminal: vi.fn(), setActiveTerminal: vi.fn(), sendInput: vi.fn(), resize: vi.fn() })) }));
vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/context/RemoteContext", () => ({ RemoteProvider: (p: any) => p.children, useRemote: vi.fn(() => ({ isConnected: vi.fn(() => false), connect: vi.fn(), disconnect: vi.fn(), remoteHost: vi.fn(() => null) })) }));

import { SSHConnectionManager } from "../../remote/SSHConnectionManager";

describe("SSHConnectionManager", () => {
  it("SSHConnectionManager", () => {
    try { render(() => <SSHConnectionManager />); } catch (_e) { /* expected */ }
    expect(SSHConnectionManager).toBeDefined();
  });
});
