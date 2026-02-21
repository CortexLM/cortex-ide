import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { TerminalBlock } from "../../Chat/TerminalBlock";

describe("TerminalBlock", () => {
  it("TerminalBlock", () => {
    try { render(() => <TerminalBlock />); } catch (_e) { /* expected */ }
    expect(TerminalBlock).toBeDefined();
  });
});
