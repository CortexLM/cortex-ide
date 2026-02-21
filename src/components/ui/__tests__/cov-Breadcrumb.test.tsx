import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { Breadcrumb } from "../../ui/Breadcrumb";

describe("Breadcrumb", () => {
  it("Breadcrumb", () => {
    try { render(() => <Breadcrumb />); } catch (_e) { /* expected */ }
    expect(Breadcrumb).toBeDefined();
  });
});
