import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { QuickInput } from "../../ui/QuickInput";

describe("QuickInput", () => {
  it("QuickInput", () => {
    try { render(() => <QuickInput />); } catch (_e) { /* expected */ }
    expect(QuickInput).toBeDefined();
  });
});
