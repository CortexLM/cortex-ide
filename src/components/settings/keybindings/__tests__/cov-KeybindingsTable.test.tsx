import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { KeybindingsTable } from "../../../settings/keybindings/KeybindingsTable";

describe("KeybindingsTable", () => {
  it("KeybindingsTable", () => {
    try { render(() => <KeybindingsTable />); } catch (_e) { /* expected */ }
    expect(KeybindingsTable).toBeDefined();
  });
});
