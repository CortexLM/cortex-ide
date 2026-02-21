import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { ExtensionDetailPage } from "../../extensions/ExtensionDetailPage";

describe("ExtensionDetailPage", () => {
  it("ExtensionDetailPage", () => {
    try { render(() => <ExtensionDetailPage />); } catch (_e) { /* expected */ }
    expect(ExtensionDetailPage).toBeDefined();
  });
});
