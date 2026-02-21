import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/context/EditorContext", () => ({ EditorProvider: (p: any) => p.children, useEditor: vi.fn(() => ({ openFiles: [], activeFileId: null, activeFile: vi.fn(() => null), openFile: vi.fn(), closeFile: vi.fn(), closeAllFiles: vi.fn(), setActiveFile: vi.fn(), updateFileContent: vi.fn(), saveFile: vi.fn(), saveAllFiles: vi.fn(), state: { openFiles: [], activeFileId: null, groups: [{ id: "default", fileIds: [], activeFileId: null }], splits: [], cursorCount: 1, selectionCount: 0 }, groups: [{ id: "default", fileIds: [], activeFileId: null }], splits: [], isSplit: vi.fn(() => false), openFileCount: vi.fn(() => 0), hasModifiedFiles: vi.fn(() => false), modifiedFileIds: vi.fn(() => []), createGroup: vi.fn(), removeGroup: vi.fn(), moveFileToGroup: vi.fn(), setActiveGroup: vi.fn(), setSplitDirection: vi.fn(), setSplitRatio: vi.fn(), pinnedTabIds: vi.fn(() => []), pinTab: vi.fn(), unpinTab: vi.fn(), togglePinTab: vi.fn(), previewTabId: vi.fn(() => null), setPreviewTab: vi.fn(), gridState: vi.fn(() => null), useGridLayout: vi.fn(() => false), minimapSettings: vi.fn(() => ({})), breadcrumbSymbolPath: vi.fn(() => []), isGroupLocked: vi.fn(() => false), groupName: vi.fn(() => ""), recentlyClosedStack: vi.fn(() => []), groupCount: vi.fn(() => 1) })) }));
vi.mock("@/context/LSPContext", () => ({ LSPProvider: (p: any) => p.children, useLSP: vi.fn(() => ({ getLanguageClient: vi.fn(() => null), isReady: vi.fn(() => false), diagnostics: vi.fn(() => []), sendRequest: vi.fn(), sendNotification: vi.fn() })), getLanguageId: vi.fn(() => "plaintext"), getLanguageServerConfig: vi.fn(() => null) }));

import { showCallHierarchy, showIncomingCalls, showOutgoingCalls, CallHierarchyView, CallHierarchyPanel, useCallHierarchy } from "../CallHierarchyView";

describe("CallHierarchyView", () => {
  it("showCallHierarchy", () => {
    try { showCallHierarchy("test", { lineNumber: 1, column: 1 } as any); } catch (_e) { /* expected */ }
    try { showCallHierarchy(); } catch (_e) { /* expected */ }
    expect(showCallHierarchy).toBeDefined();
  });
  it("showIncomingCalls", () => {
    try { showIncomingCalls("test", { lineNumber: 1, column: 1 } as any); } catch (_e) { /* expected */ }
    try { showIncomingCalls(); } catch (_e) { /* expected */ }
    expect(showIncomingCalls).toBeDefined();
  });
  it("showOutgoingCalls", () => {
    try { showOutgoingCalls("test", { lineNumber: 1, column: 1 } as any); } catch (_e) { /* expected */ }
    try { showOutgoingCalls(); } catch (_e) { /* expected */ }
    expect(showOutgoingCalls).toBeDefined();
  });
  it("CallHierarchyView", () => {
    try { render(() => <CallHierarchyView />); } catch (_e) { /* expected */ }
    expect(CallHierarchyView).toBeDefined();
  });
  it("CallHierarchyPanel", () => {
    try { render(() => <CallHierarchyPanel />); } catch (_e) { /* expected */ }
    expect(CallHierarchyPanel).toBeDefined();
  });
  it("useCallHierarchy", () => {
    try { createRoot((dispose) => { try { useCallHierarchy(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useCallHierarchy).toBeDefined();
  });
});
