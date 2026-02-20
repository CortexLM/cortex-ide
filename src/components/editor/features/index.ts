/**
 * Editor Features - Extracted hooks and components from CodeEditor.tsx
 */

export {
  createInlayHintsManager,
  getInlayHintsEditorOptions,
  type InlayHintSettings,
  type InlayHintsManager,
} from "./useInlayHints";

export {
  createCodeLensManager,
  getCodeLensEditorOptions,
  type CodeLensSettings,
  type CodeLensManager,
} from "./useCodeLens";

export {
  createFormatOnTypeManager,
  getFormatOnTypeEditorOptions,
  type FormatOnTypeSettings,
  type FormatOnTypeManager,
} from "./useFormatOnType";

export {
  createLinkedEditingManager,
  getLinkedEditingEditorOptions,
  getTagAtPosition,
  findOpeningTag,
  findClosingTag,
  type LinkedEditingSettings,
  type LinkedEditingManager,
} from "./useLinkedEditing";

export {
  SmartSelectManager,
  createSmartSelectManager,
  registerSmartSelectActions,
} from "./useSmartSelect";

export {
  createCoverageManager,
  getCoverageEditorStyles,
  type LineCoverageStatus,
  type LineCoverageData,
  type CoverageSettings,
  type CoverageManager,
} from "./useCoverage";

export { CallHierarchyPanel, type CallHierarchyDirection } from "./CallHierarchyPanel";
export type { CallHierarchyPanelProps } from "./CallHierarchyPanel";

export { TypeHierarchyPanel } from "./TypeHierarchyPanel";
export type { TypeHierarchyPanelProps } from "./TypeHierarchyPanel";
