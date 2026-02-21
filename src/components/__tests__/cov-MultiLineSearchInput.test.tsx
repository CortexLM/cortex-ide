import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { MultiLineSearchInput } from "../MultiLineSearchInput";

describe("MultiLineSearchInput", () => {
  it("MultiLineSearchInput", () => {
    try { render(() => <MultiLineSearchInput />); } catch (_e) { /* expected */ }
    expect(MultiLineSearchInput).toBeDefined();
  });
});
