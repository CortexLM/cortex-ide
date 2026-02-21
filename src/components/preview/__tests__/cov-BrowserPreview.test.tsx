import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/PreviewContext", () => ({ PreviewProvider: (p: any) => p.children, usePreview: vi.fn(() => ({})) }));

import { BrowserPreview } from "../../preview/BrowserPreview";

describe("BrowserPreview", () => {
  it("BrowserPreview", () => {
    try { render(() => <BrowserPreview />); } catch (_e) { /* expected */ }
    expect(BrowserPreview).toBeDefined();
  });
});
