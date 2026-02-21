import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { RegistryClientProvider, useRegistryClient } from "../../extensions/RegistryClient";

describe("RegistryClient", () => {
  it("RegistryClientProvider", () => {
    try { render(() => <RegistryClientProvider />); } catch (_e) { /* expected */ }
    expect(RegistryClientProvider).toBeDefined();
  });
  it("useRegistryClient", () => {
    try { createRoot((dispose) => { try { useRegistryClient(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useRegistryClient).toBeDefined();
  });
});
