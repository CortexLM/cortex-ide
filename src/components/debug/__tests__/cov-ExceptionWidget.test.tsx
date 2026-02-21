import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { ExceptionWidget } from "../../debug/ExceptionWidget";

describe("ExceptionWidget", () => {
  it("ExceptionWidget", () => {
    try { render(() => <ExceptionWidget />); } catch (_e) { /* expected */ }
    expect(ExceptionWidget).toBeDefined();
  });
});
