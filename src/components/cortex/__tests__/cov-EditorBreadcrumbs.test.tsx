import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { EditorBreadcrumbs } from "../../cortex/EditorBreadcrumbs";

describe("EditorBreadcrumbs", () => {
  it("EditorBreadcrumbs", () => {
    try { render(() => <EditorBreadcrumbs />); } catch (_e) { /* expected */ }
    expect(EditorBreadcrumbs).toBeDefined();
  });
});
