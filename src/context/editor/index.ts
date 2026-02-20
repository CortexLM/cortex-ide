export {
  EditorFilesProvider,
  useEditorFiles,
  type OpenFile,
  type CursorPosition,
  type Selection,
  type EditorFilesContextValue,
} from "./EditorFilesContext";

export {
  EditorUIProvider,
  useEditorUI,
  type SplitDirection,
  type EditorGroup,
  type EditorSplit,
  type EditorLayout,
  type EditorUIContextValue,
} from "./EditorUIContext";

export {
  EditorCursorProvider,
  useEditorCursor,
  type CursorInfo,
  type SelectionInfo,
  type EditorCursorContextValue,
} from "./EditorCursorContext";

export { EditorProvider, useEditor } from "./EditorProvider";
export type { EditorState, EditorContextValue, GridCell, EditorGridState, MinimapSettings, BreadcrumbSymbolPath, RecentlyClosedEntry } from "./editorTypes";
export { detectLanguage, generateId } from "./languageDetection";

export {
  TabsProvider,
  useTabs,
  type TabGroup,
  type TabLRUEntry,
  type TabsState,
  type TabsContextValue,
} from "./TabsProvider";

export { EditorFeaturesProvider, useEditorFeatures } from "./EditorFeaturesProvider";
export type { EditorFeaturesState, EditorFeaturesContextValue } from "./EditorFeaturesProvider";
