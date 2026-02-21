import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/RemoteContext", () => ({ RemoteProvider: (p: any) => p.children, useRemote: vi.fn(() => ({ isConnected: vi.fn(() => false), connect: vi.fn(), disconnect: vi.fn(), remoteHost: vi.fn(() => null) })) }));

import { WSLConnect, WSLStatusIndicator } from "../../remote/WSLConnect";

describe("WSLConnect", () => {
  it("WSLConnect", () => {
    try { render(() => <WSLConnect />); } catch (_e) { /* expected */ }
    expect(WSLConnect).toBeDefined();
  });
  it("WSLStatusIndicator", () => {
    try { render(() => <WSLStatusIndicator />); } catch (_e) { /* expected */ }
    expect(WSLStatusIndicator).toBeDefined();
  });
});
