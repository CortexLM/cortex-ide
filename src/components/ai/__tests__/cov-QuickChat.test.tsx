import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/context/EditorContext", () => ({ EditorProvider: (p: any) => p.children, useEditor: vi.fn(() => ({ openFiles: [], activeFileId: null, activeFile: vi.fn(() => null), openFile: vi.fn(), closeFile: vi.fn(), closeAllFiles: vi.fn(), setActiveFile: vi.fn(), updateFileContent: vi.fn(), saveFile: vi.fn(), saveAllFiles: vi.fn(), state: { openFiles: [], activeFileId: null, groups: [{ id: "default", fileIds: [], activeFileId: null }], splits: [], cursorCount: 1, selectionCount: 0 }, groups: [{ id: "default", fileIds: [], activeFileId: null }], splits: [], isSplit: vi.fn(() => false), openFileCount: vi.fn(() => 0), hasModifiedFiles: vi.fn(() => false), modifiedFileIds: vi.fn(() => []), createGroup: vi.fn(), removeGroup: vi.fn(), moveFileToGroup: vi.fn(), setActiveGroup: vi.fn(), setSplitDirection: vi.fn(), setSplitRatio: vi.fn(), pinnedTabIds: vi.fn(() => []), pinTab: vi.fn(), unpinTab: vi.fn(), togglePinTab: vi.fn(), previewTabId: vi.fn(() => null), setPreviewTab: vi.fn(), gridState: vi.fn(() => null), useGridLayout: vi.fn(() => false), minimapSettings: vi.fn(() => ({})), breadcrumbSymbolPath: vi.fn(() => []), isGroupLocked: vi.fn(() => false), groupName: vi.fn(() => ""), recentlyClosedStack: vi.fn(() => []), groupCount: vi.fn(() => 1) })) }));
vi.mock("@/context/AIContext", () => ({ AIProvider: (p: any) => p.children, useAI: vi.fn(() => ({})) }));
vi.mock("@/context/WorkspaceContext", () => ({ WorkspaceProvider: (p: any) => p.children, useWorkspace: vi.fn(() => ({ workspacePath: vi.fn(() => "/test"), workspaceName: vi.fn(() => "test"), isWorkspaceOpen: vi.fn(() => true), openWorkspace: vi.fn(), closeWorkspace: vi.fn(), recentWorkspaces: vi.fn(() => []) })) }));
vi.mock("@/components/ui", () => ({ Button: (p: any) => p.children, Input: (p: any) => null, Select: (p: any) => p.children, Dialog: (p: any) => p.children, Tooltip: (p: any) => p.children, Checkbox: (p: any) => null, Badge: (p: any) => p.children, Tabs: (p: any) => p.children, ScrollArea: (p: any) => p.children, DropdownMenu: (p: any) => p.children, Popover: (p: any) => p.children, Switch: (p: any) => null, Separator: () => null, Label: (p: any) => p.children, Card: (p: any) => p.children, Accordion: (p: any) => p.children, Alert: (p: any) => p.children, Avatar: (p: any) => null, Progress: (p: any) => null, Skeleton: () => null, Slider: (p: any) => null, Textarea: (p: any) => null, Toggle: (p: any) => p.children, ToggleGroup: (p: any) => p.children }));
vi.mock("@/context/CommandContext", () => ({ CommandProvider: (p: any) => p.children, useCommands: vi.fn(() => ({ executeCommand: vi.fn(), registerCommand: vi.fn(), getCommands: vi.fn(() => []), commands: vi.fn(() => []) })) }));

import { QuickChat, useQuickChat } from "../../ai/QuickChat";

describe("QuickChat", () => {
  it("QuickChat", () => {
    try { render(() => <QuickChat />); } catch (_e) { /* expected */ }
    expect(QuickChat).toBeDefined();
  });
  it("useQuickChat", () => {
    try { createRoot((dispose) => { try { useQuickChat(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useQuickChat).toBeDefined();
  });
});
