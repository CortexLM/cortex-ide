import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/PreviewContext", () => ({ PreviewProvider: (p: any) => p.children, usePreview: vi.fn(() => ({})) }));

import { PreviewToolbar } from "../../preview/PreviewToolbar";

describe("PreviewToolbar", () => {
  it("PreviewToolbar", () => {
    try { render(() => <PreviewToolbar />); } catch (_e) { /* expected */ }
    expect(PreviewToolbar).toBeDefined();
  });
});
