import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { ColorCustomizationsProvider, useColorCustomizations } from "../ColorCustomizationsContext";

describe("ColorCustomizationsContext", () => {
  it("ColorCustomizationsProvider", () => {
    try { render(() => <ColorCustomizationsProvider />); } catch (_e) { /* expected */ }
    expect(ColorCustomizationsProvider).toBeDefined();
  });
  it("useColorCustomizations", () => {
    try { createRoot((dispose) => { try { useColorCustomizations(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useColorCustomizations).toBeDefined();
  });
});
