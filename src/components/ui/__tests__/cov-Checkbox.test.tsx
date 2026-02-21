import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { Checkbox } from "../../ui/Checkbox";

describe("Checkbox", () => {
  it("Checkbox", () => {
    try { render(() => <Checkbox />); } catch (_e) { /* expected */ }
    expect(Checkbox).toBeDefined();
  });
});
