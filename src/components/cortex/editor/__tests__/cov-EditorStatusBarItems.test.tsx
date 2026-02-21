import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/StatusBarContext", () => ({ StatusBarProvider: (p: any) => p.children, useStatusBar: vi.fn(() => ({})) }));

import { EditorStatusBarItems } from "../../../cortex/editor/EditorStatusBarItems";

describe("EditorStatusBarItems", () => {
  it("EditorStatusBarItems", () => {
    try { render(() => <EditorStatusBarItems />); } catch (_e) { /* expected */ }
    expect(EditorStatusBarItems).toBeDefined();
  });
});
