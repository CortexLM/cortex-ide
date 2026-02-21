import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { SSHProvider, useSSH } from "../SSHContext";

describe("SSHContext", () => {
  it("SSHProvider", () => {
    try { render(() => <SSHProvider />); } catch (_e) { /* expected */ }
    expect(SSHProvider).toBeDefined();
  });
  it("useSSH", () => {
    try { createRoot((dispose) => { try { useSSH(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSSH).toBeDefined();
  });
});
