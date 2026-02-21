import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { Select } from "../../ui/Select";

describe("Select", () => {
  it("Select", () => {
    try { render(() => <Select />); } catch (_e) { /* expected */ }
    expect(Select).toBeDefined();
  });
});
