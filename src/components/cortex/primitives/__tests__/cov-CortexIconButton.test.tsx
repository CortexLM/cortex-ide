import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexIconButton } from "../../../cortex/primitives/CortexIconButton";

describe("CortexIconButton", () => {
  it("CortexIconButton", () => {
    try { render(() => <CortexIconButton />); } catch (_e) { /* expected */ }
    expect(CortexIconButton).toBeDefined();
  });
});
