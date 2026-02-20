export { KeymapEditor } from "./KeymapEditor";
export { EditorSettingsPanel } from "./EditorSettingsPanel";
export { TerminalSettingsPanel } from "./TerminalSettingsPanel";
export { FilesSettingsPanel } from "./FilesSettingsPanel";
export { NetworkSettingsPanel } from "./NetworkSettingsPanel";
export { GitSettingsPanel } from "./GitSettingsPanel";
export { SettingsSyncPanel } from "./SettingsSyncPanel";
export { ThemeCustomizer } from "./ThemeCustomizer";
export { ThemePreview } from "./ThemePreview";
export { ProfileManager, ProfileQuickSwitch, registerProfileCommands } from "./ProfileManager";
export { ProductIconThemeSelector } from "./ProductIconThemeSelector";
export { ProductIconSelector } from "./ProductIconSelector";
export { IconThemeSelector } from "./IconThemeSelector";
export { ThemeSelector } from "./ThemeSelector";
export { WhenClauseEditor } from "./WhenClauseEditor";
export { JsonSettingsEditor } from "./JsonSettingsEditor";
export { DefaultSettingsView } from "./DefaultSettingsView";
export { WorkbenchSettingsPanel } from "./WorkbenchSettingsPanel";
export { SettingsEditor } from "./SettingsEditor";
export type { SettingsEditorProps } from "./SettingsEditor";
export * from "./FormComponents";

// When Clause Editor for Keybindings
export {
  WhenClauseInput,
  WhenClauseDisplay,
  WhenClauseRecordButton,
  validateWhenClause,
  parseWhenClause,
  CONTEXT_KEY_CATEGORIES,
  ALL_CONTEXT_KEYS,
  CONTEXT_KEY_NAMES,
  WHEN_OPERATORS,
  type WhenExpression,
  type WhenClause,
  type ContextKeyCategory,
  type ContextKeyInfo,
  type WhenClauseInputProps,
  type WhenClauseDisplayProps,
  type WhenClauseRecordButtonProps,
} from "./WhenClauseInput";

// Semantic Token Customization Editor
export {
  SemanticTokenEditor,
  SemanticTokenQuickPanel,
  type SemanticTokenEditorProps,
  type SemanticTokenQuickPanelProps,
} from "./SemanticTokenEditor";

// Workbench Color Customizations (VS Code workbench.colorCustomizations)
export { WorkbenchColorCustomizations } from "./WorkbenchColorCustomizations";

// Editor Token Color Customizations (VS Code editor.tokenColorCustomizations)
export { EditorTokenColorCustomizations } from "./EditorTokenColorCustomizations";
