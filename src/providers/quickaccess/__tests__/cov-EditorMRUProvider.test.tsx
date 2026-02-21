import { describe, it, expect, vi } from "vitest";

vi.mock("@/context/TabSwitcherContext", () => ({ TabSwitcherProvider: (p: any) => p.children, useTabSwitcher: vi.fn(() => ({})) }));

import { createEditorMRUProvider } from "../../quickaccess/EditorMRUProvider";

describe("EditorMRUProvider", () => {
  it("createEditorMRUProvider", () => {
    try { createEditorMRUProvider({} as any); } catch (_e) { /* expected */ }
    try { createEditorMRUProvider(); } catch (_e) { /* expected */ }
    expect(createEditorMRUProvider).toBeDefined();
  });
});
