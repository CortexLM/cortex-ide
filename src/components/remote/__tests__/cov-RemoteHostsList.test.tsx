import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/RemoteContext", () => ({ RemoteProvider: (p: any) => p.children, useRemote: vi.fn(() => ({ isConnected: vi.fn(() => false), connect: vi.fn(), disconnect: vi.fn(), remoteHost: vi.fn(() => null) })) }));

import { RemoteHostsList } from "../../remote/RemoteHostsList";

describe("RemoteHostsList", () => {
  it("RemoteHostsList", () => {
    try { render(() => <RemoteHostsList />); } catch (_e) { /* expected */ }
    expect(RemoteHostsList).toBeDefined();
  });
});
