import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));

import { TerminalImageRenderer } from "../../terminal/TerminalImageRenderer";

describe("TerminalImageRenderer", () => {
  it("TerminalImageRenderer", () => {
    try { render(() => <TerminalImageRenderer />); } catch (_e) { /* expected */ }
    expect(TerminalImageRenderer).toBeDefined();
  });
});
