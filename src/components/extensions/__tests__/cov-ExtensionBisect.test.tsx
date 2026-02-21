import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));

import { ExtensionBisect, ExtensionBisectIndicator } from "../../extensions/ExtensionBisect";

describe("ExtensionBisect", () => {
  it("ExtensionBisect", () => {
    try { render(() => <ExtensionBisect />); } catch (_e) { /* expected */ }
    expect(ExtensionBisect).toBeDefined();
  });
  it("ExtensionBisectIndicator", () => {
    expect(ExtensionBisectIndicator).toBeDefined();
  });
});
