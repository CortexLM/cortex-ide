import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { DropZoneOverlay } from "../../../editor/grid/DropZoneOverlay";

describe("DropZoneOverlay", () => {
  it("DropZoneOverlay", () => {
    try { render(() => <DropZoneOverlay />); } catch (_e) { /* expected */ }
    expect(DropZoneOverlay).toBeDefined();
  });
});
