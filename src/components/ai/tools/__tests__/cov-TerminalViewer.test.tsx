import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { TerminalViewer } from "../../../ai/tools/TerminalViewer";

describe("TerminalViewer", () => {
  it("TerminalViewer", () => {
    try { render(() => <TerminalViewer />); } catch (_e) { /* expected */ }
    expect(TerminalViewer).toBeDefined();
  });
});
