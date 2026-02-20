import type { CommandBinding } from "./types";

// ============================================================================
// Default Bindings Part 5: Editor layout, appearance, breadcrumbs,
// minimap, and theme commands
// ============================================================================

const ctrl = { ctrl: true, alt: false, shift: false, meta: false };
const ctrlShift = { ctrl: true, alt: false, shift: true, meta: false };
const ctrlAlt = { ctrl: true, alt: true, shift: false, meta: false };

export const BINDINGS_PART5: Omit<CommandBinding, "customKeybinding">[] = [
  // Editor group layout
  {
    commandId: "editor.maximizeGroup",
    label: "Maximize Editor Group",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "m", modifiers: ctrl },
    ] },
    when: "editorFocus",
  },
  {
    commandId: "editor.restoreGroup",
    label: "Restore Editor Group Size",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "u", modifiers: ctrl },
    ] },
    when: "editorFocus",
  },
  {
    commandId: "editor.equalizeGroups",
    label: "Equalize Editor Group Sizes",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "=", modifiers: ctrl },
    ] },
  },
  // Layout presets
  {
    commandId: "editor.applyPreset2x2",
    label: "Apply 2x2 Grid Layout",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "4", modifiers: ctrl },
    ] },
  },
  {
    commandId: "editor.applyPreset3x1",
    label: "Apply 3 Columns Layout",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "3", modifiers: ctrl },
    ] },
  },
  {
    commandId: "editor.applyPreset1x3",
    label: "Apply 3 Rows Layout",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "r", modifiers: ctrlShift },
    ] },
  },
  {
    commandId: "editor.applyPreset2x1",
    label: "Apply 2 Columns Layout",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "2", modifiers: ctrl },
    ] },
  },
  // Group management
  {
    commandId: "editor.lockGroup",
    label: "Lock Editor Group",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "l", modifiers: ctrl },
    ] },
    when: "editorFocus",
  },
  {
    commandId: "editor.unlockGroup",
    label: "Unlock Editor Group",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "l", modifiers: ctrlShift },
    ] },
    when: "editorFocus",
  },
  {
    commandId: "editor.nameGroup",
    label: "Name Editor Group",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "n", modifiers: ctrl },
    ] },
    when: "editorFocus",
  },
  {
    commandId: "editor.reopenClosedEditor",
    label: "Reopen Closed Editor",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "t", modifiers: ctrlShift },
    ] },
  },
  // Minimap
  {
    commandId: "editor.toggleMinimap",
    label: "Toggle Minimap",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "z", modifiers: ctrl },
    ] },
  },
  // Theme
  {
    commandId: "theme.toggleHighContrast",
    label: "Toggle High Contrast Theme",
    category: "Preferences",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "h", modifiers: ctrl },
    ] },
  },
  // Breadcrumbs
  {
    commandId: "breadcrumbs.focus",
    label: "Focus Breadcrumbs",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: ".", modifiers: ctrlShift },
    ] },
  },
  {
    commandId: "breadcrumbs.toggle",
    label: "Toggle Breadcrumbs",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "b", modifiers: ctrl },
    ] },
  },
  {
    commandId: "breadcrumbs.copyPath",
    label: "Copy Breadcrumb Path",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "p", modifiers: ctrlAlt },
    ] },
  },
  {
    commandId: "breadcrumbs.copyRelativePath",
    label: "Copy Breadcrumb Relative Path",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "p", modifiers: ctrlShift },
    ] },
  },
  {
    commandId: "breadcrumbs.revealInExplorer",
    label: "Reveal Breadcrumb in Explorer",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "e", modifiers: ctrlShift },
    ] },
  },
  // Split editor
  {
    commandId: "workbench.action.splitEditorRight",
    label: "Split Editor Right",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "\\", modifiers: ctrl },
    ] },
  },
  {
    commandId: "workbench.action.splitEditorDown",
    label: "Split Editor Down",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "\\", modifiers: ctrl },
    ] },
  },
  // Search
  {
    commandId: "workbench.action.search",
    label: "Search in Files",
    category: "Search",
    defaultKeybinding: { keystrokes: [
      { key: "f", modifiers: ctrlShift },
    ] },
  },
  {
    commandId: "workbench.action.replaceInFiles",
    label: "Replace in Files",
    category: "Search",
    defaultKeybinding: { keystrokes: [
      { key: "h", modifiers: ctrlShift },
    ] },
  },
  // Settings
  {
    commandId: "workbench.action.openSettings",
    label: "Open Settings",
    category: "Preferences",
    defaultKeybinding: { keystrokes: [
      { key: ",", modifiers: ctrl },
    ] },
  },
  {
    commandId: "workbench.action.openKeybindings",
    label: "Open Keyboard Shortcuts",
    category: "Preferences",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "s", modifiers: ctrl },
    ] },
  },
  // Workbench layout
  {
    commandId: "workbench.action.toggleSidebar",
    label: "Toggle Sidebar",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "b", modifiers: ctrl },
    ] },
  },
  {
    commandId: "workbench.action.togglePanel",
    label: "Toggle Panel",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "j", modifiers: ctrl },
    ] },
  },
  // Close editors
  {
    commandId: "workbench.action.closeEditor",
    label: "Close Editor",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "w", modifiers: ctrl },
    ] },
  },
  {
    commandId: "workbench.action.closeAllEditors",
    label: "Close All Editors",
    category: "View",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: ctrl },
      { key: "w", modifiers: ctrl },
    ] },
  },
];
