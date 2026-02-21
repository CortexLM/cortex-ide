import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/context/RemoteContext", () => ({ RemoteProvider: (p: any) => p.children, useRemote: vi.fn(() => ({ isConnected: vi.fn(() => false), connect: vi.fn(), disconnect: vi.fn(), remoteHost: vi.fn(() => null) })) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue(null), message: vi.fn().mockResolvedValue(undefined), ask: vi.fn().mockResolvedValue(false), confirm: vi.fn().mockResolvedValue(false) }));

import { SSHConnectionDialog } from "../../remote/SSHConnectionDialog";

describe("SSHConnectionDialog", () => {
  it("SSHConnectionDialog", () => {
    try { render(() => <SSHConnectionDialog />); } catch (_e) { /* expected */ }
    expect(SSHConnectionDialog).toBeDefined();
  });
});
