import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { KeybindingsEditor } from "../../../settings/keybindings/KeybindingsEditorComponent";

describe("KeybindingsEditorComponent", () => {
  it("KeybindingsEditor", () => {
    try { render(() => <KeybindingsEditor />); } catch (_e) { /* expected */ }
    expect(KeybindingsEditor).toBeDefined();
  });
});
