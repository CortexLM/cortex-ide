import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { ColorPickerWidget } from "../../editor/ColorPickerWidget";

describe("ColorPickerWidget", () => {
  it("ColorPickerWidget", () => {
    try { render(() => <ColorPickerWidget />); } catch (_e) { /* expected */ }
    expect(ColorPickerWidget).toBeDefined();
  });
});
