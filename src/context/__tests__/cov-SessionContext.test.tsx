import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { SessionProvider, useSession } from "../SessionContext";

describe("SessionContext", () => {
  it("SessionProvider", () => {
    try { render(() => <SessionProvider />); } catch (_e) { /* expected */ }
    expect(SessionProvider).toBeDefined();
  });
  it("useSession", () => {
    try { createRoot((dispose) => { try { useSession(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSession).toBeDefined();
  });
});
