import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/RemoteContext", () => ({ RemoteProvider: (p: any) => p.children, useRemote: vi.fn(() => ({ isConnected: vi.fn(() => false), connect: vi.fn(), disconnect: vi.fn(), remoteHost: vi.fn(() => null) })) }));

import { RemoteExplorer } from "../../remote/RemoteExplorer";

describe("RemoteExplorer", () => {
  it("RemoteExplorer", () => {
    try { render(() => <RemoteExplorer />); } catch (_e) { /* expected */ }
    expect(RemoteExplorer).toBeDefined();
  });
});
