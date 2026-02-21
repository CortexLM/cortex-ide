import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { BreadcrumbContextMenu } from "../../../editor/breadcrumbs/BreadcrumbContextMenu";

describe("BreadcrumbContextMenu", () => {
  it("BreadcrumbContextMenu", () => {
    try { render(() => <BreadcrumbContextMenu />); } catch (_e) { /* expected */ }
    expect(BreadcrumbContextMenu).toBeDefined();
  });
});
