export { EditorProvider, useEditor } from "./editor/EditorProvider";
export type { EditorState, EditorContextValue, MinimapSettings, BreadcrumbSymbolPath, RecentlyClosedEntry } from "./editor/editorTypes";

// Re-export types from split contexts for backwards compatibility
export type { CursorPosition, Selection, OpenFile } from "./editor/EditorFilesContext";
export type { SplitDirection, EditorGroup, EditorSplit, EditorLayout } from "./editor/EditorUIContext";
export type { GridCell, EditorGridState } from "./editor/editorTypes";
