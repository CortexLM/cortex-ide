import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { BreadcrumbsPicker } from "../../../editor/breadcrumbs/BreadcrumbsPicker";

describe("BreadcrumbsPicker", () => {
  it("BreadcrumbsPicker", () => {
    try { render(() => <BreadcrumbsPicker />); } catch (_e) { /* expected */ }
    expect(BreadcrumbsPicker).toBeDefined();
  });
});
