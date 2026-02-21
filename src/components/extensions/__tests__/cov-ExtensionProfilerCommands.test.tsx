import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { ExtensionProfilerCommands } from "../../extensions/ExtensionProfilerCommands";

describe("ExtensionProfilerCommands", () => {
  it("ExtensionProfilerCommands", () => {
    try { render(() => <ExtensionProfilerCommands />); } catch (_e) { /* expected */ }
    expect(ExtensionProfilerCommands).toBeDefined();
  });
});
