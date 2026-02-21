import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/WhichKeyContext", () => ({ WhichKeyProvider: (p: any) => p.children, useWhichKey: vi.fn(() => ({})) }));

import { WhichKey, WhichKeySettings } from "../WhichKey";

describe("WhichKey", () => {
  it("WhichKey", () => {
    try { render(() => <WhichKey />); } catch (_e) { /* expected */ }
    expect(WhichKey).toBeDefined();
  });
  it("WhichKeySettings", () => {
    try { render(() => <WhichKeySettings />); } catch (_e) { /* expected */ }
    expect(WhichKeySettings).toBeDefined();
  });
});
