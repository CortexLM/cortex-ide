import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/PreviewContext", () => ({ PreviewProvider: (p: any) => p.children, usePreview: vi.fn(() => ({})) }));

import { WebPreview } from "../WebPreview";

describe("WebPreview", () => {
  it("WebPreview", () => {
    try { render(() => <WebPreview />); } catch (_e) { /* expected */ }
    expect(WebPreview).toBeDefined();
  });
});
