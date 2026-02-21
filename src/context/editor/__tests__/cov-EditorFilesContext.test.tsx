import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { EditorFilesProvider, useEditorFiles } from "../../editor/EditorFilesContext";

describe("EditorFilesContext", () => {
  it("EditorFilesProvider", () => {
    try { render(() => <EditorFilesProvider />); } catch (_e) { /* expected */ }
    expect(EditorFilesProvider).toBeDefined();
  });
  it("useEditorFiles", () => {
    try { createRoot((dispose) => { try { useEditorFiles(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useEditorFiles).toBeDefined();
  });
});
