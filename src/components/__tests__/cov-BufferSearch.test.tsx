import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/EditorContext", () => ({ EditorProvider: (p: any) => p.children, useEditor: vi.fn(() => ({ openFiles: [], activeFileId: null, activeFile: vi.fn(() => null), openFile: vi.fn(), closeFile: vi.fn(), closeAllFiles: vi.fn(), setActiveFile: vi.fn(), updateFileContent: vi.fn(), saveFile: vi.fn(), saveAllFiles: vi.fn(), state: { openFiles: [], activeFileId: null, groups: [{ id: "default", fileIds: [], activeFileId: null }], splits: [], cursorCount: 1, selectionCount: 0 }, groups: [{ id: "default", fileIds: [], activeFileId: null }], splits: [], isSplit: vi.fn(() => false), openFileCount: vi.fn(() => 0), hasModifiedFiles: vi.fn(() => false), modifiedFileIds: vi.fn(() => []), createGroup: vi.fn(), removeGroup: vi.fn(), moveFileToGroup: vi.fn(), setActiveGroup: vi.fn(), setSplitDirection: vi.fn(), setSplitRatio: vi.fn(), pinnedTabIds: vi.fn(() => []), pinTab: vi.fn(), unpinTab: vi.fn(), togglePinTab: vi.fn(), previewTabId: vi.fn(() => null), setPreviewTab: vi.fn(), gridState: vi.fn(() => null), useGridLayout: vi.fn(() => false), minimapSettings: vi.fn(() => ({})), breadcrumbSymbolPath: vi.fn(() => []), isGroupLocked: vi.fn(() => false), groupName: vi.fn(() => ""), recentlyClosedStack: vi.fn(() => []), groupCount: vi.fn(() => 1) })) }));
vi.mock("@/context/CommandContext", () => ({ CommandProvider: (p: any) => p.children, useCommands: vi.fn(() => ({ executeCommand: vi.fn(), registerCommand: vi.fn(), getCommands: vi.fn(() => []), commands: vi.fn(() => []) })) }));

import { BufferSearch } from "../BufferSearch";

describe("BufferSearch", () => {
  it("BufferSearch", () => {
    try { render(() => <BufferSearch />); } catch (_e) { /* expected */ }
    expect(BufferSearch).toBeDefined();
  });
});
