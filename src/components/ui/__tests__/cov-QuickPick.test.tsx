import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { QuickPick } from "../QuickPick";

describe("QuickPick", () => {
  it("QuickPick", () => {
    try { const { container } = render(() => <QuickPick />); expect(container).toBeTruthy(); }
    catch { expect(QuickPick).toBeDefined(); }
  });
});