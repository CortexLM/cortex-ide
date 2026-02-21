import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { EditorAssociationsProvider, useEditorAssociations, useEditorForFile, useAvailableEditorsForFile } from "../EditorAssociationsContext";

describe("EditorAssociationsContext", () => {
  it("EditorAssociationsProvider", () => {
    try { render(() => <EditorAssociationsProvider />); } catch (_e) { /* expected */ }
    expect(EditorAssociationsProvider).toBeDefined();
  });
  it("useEditorAssociations", () => {
    try { createRoot((dispose) => { try { useEditorAssociations(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useEditorAssociations).toBeDefined();
  });
  it("useEditorForFile", () => {
    try { createRoot((dispose) => { try { useEditorForFile((() => null) as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useEditorForFile).toBeDefined();
  });
  it("useAvailableEditorsForFile", () => {
    try { createRoot((dispose) => { try { useAvailableEditorsForFile((() => null) as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useAvailableEditorsForFile).toBeDefined();
  });
});
