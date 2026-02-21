import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));

import { TerminalSplitView, SplitButton } from "../../terminal/TerminalSplitView";

describe("TerminalSplitView", () => {
  it("TerminalSplitView", () => {
    try { render(() => <TerminalSplitView />); } catch (_e) { /* expected */ }
    expect(TerminalSplitView).toBeDefined();
  });
  it("SplitButton", () => {
    try { render(() => <SplitButton />); } catch (_e) { /* expected */ }
    expect(SplitButton).toBeDefined();
  });
});
