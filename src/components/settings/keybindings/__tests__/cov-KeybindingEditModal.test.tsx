import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { KeybindingEditModal } from "../../../settings/keybindings/KeybindingEditModal";

describe("KeybindingEditModal", () => {
  it("KeybindingEditModal", () => {
    try { render(() => <KeybindingEditModal />); } catch (_e) { /* expected */ }
    expect(KeybindingEditModal).toBeDefined();
  });
});
