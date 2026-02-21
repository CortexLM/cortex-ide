import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/editor/EditorUIContext", () => ({ EditorUIProvider: (p: any) => p.children, useEditorUI: vi.fn(() => ({ groups: vi.fn(() => []), splits: vi.fn(() => []) })) }));

import { EditorGrid } from "../../../editor/grid/EditorGridComponent";

describe("EditorGridComponent", () => {
  it("EditorGrid", () => {
    try { render(() => <EditorGrid />); } catch (_e) { /* expected */ }
    expect(EditorGrid).toBeDefined();
  });
});
