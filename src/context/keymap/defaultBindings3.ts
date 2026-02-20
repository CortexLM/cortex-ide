import type { CommandBinding } from "./types";

// ============================================================================
// Default Bindings Part 3: Transform, Git, Layout, Tab Nav, editor actions
// ============================================================================

export const BINDINGS_PART3: Omit<CommandBinding, "customKeybinding">[] = [
  // Transform
  {
    commandId: "transform-uppercase",
    label: "Transform to Uppercase",
    category: "Transform",
    defaultKeybinding: null,
  },
  {
    commandId: "transform-lowercase",
    label: "Transform to Lowercase",
    category: "Transform",
    defaultKeybinding: null,
  },
  {
    commandId: "transform-titlecase",
    label: "Transform to Title Case",
    category: "Transform",
    defaultKeybinding: null,
  },
  // Git
  {
    commandId: "git-commit",
    label: "Git: Commit",
    category: "Git",
    defaultKeybinding: null,
  },
  {
    commandId: "git-push",
    label: "Git: Push",
    category: "Git",
    defaultKeybinding: null,
  },
  {
    commandId: "git-pull",
    label: "Git: Pull",
    category: "Git",
    defaultKeybinding: null,
  },
  {
    commandId: "git-stage-all",
    label: "Git: Stage All Changes",
    category: "Git",
    defaultKeybinding: null,
  },
  // Layout commands
  {
    commandId: "toggle-panel",
    label: "Toggle Panel",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "j", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "focus-explorer",
    label: "Focus Explorer",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "e", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "focus-debug",
    label: "Focus Debug Panel",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "d", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "focus-scm",
    label: "Focus Source Control",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "g", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  // Tab Navigation
  {
    commandId: "next-tab",
    label: "Switch to Next Tab",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "Tab", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "prev-tab",
    label: "Switch to Previous Tab",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "Tab", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  // Project-wide Replace
  {
    commandId: "replace-in-files",
    label: "Replace in Files",
    category: "Search",
    defaultKeybinding: { keystrokes: [{ key: "h", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  // Recent Projects (moved from Ctrl+Shift+E to Ctrl+Alt+R)
  {
    commandId: "recent-projects",
    label: "Open Recent Project",
    category: "File",
    defaultKeybinding: { keystrokes: [{ key: "r", modifiers: { ctrl: true, alt: true, shift: false, meta: false } }] },
  },
  // Join Lines (moved from Ctrl+J to Ctrl+Shift+J)
  {
    commandId: "join-lines",
    label: "Join Lines",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "j", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  // Transpose commands
  {
    commandId: "transpose-characters",
    label: "Transpose Characters",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "t", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  // In-place replace commands
  {
    commandId: "in-place-replace-up",
    label: "Replace with Previous Value",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: ",", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "in-place-replace-down",
    label: "Replace with Next Value",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: ".", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  // Delete word part commands
  {
    commandId: "delete-word-part-left",
    label: "Delete Word Part Left",
    category: "Edit",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  {
    commandId: "delete-word-part-right",
    label: "Delete Word Part Right",
    category: "Edit",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  // Linked editing
  {
    commandId: "toggle-linked-editing",
    label: "Toggle Linked Editing",
    category: "Edit",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  // Hover and suggestions
  {
    commandId: "show-hover",
    label: "Show Hover",
    category: "Edit",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "i", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
    when: "editorTextFocus",
  },
  {
    commandId: "trigger-suggest",
    label: "Trigger Suggest",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: " ", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "trigger-parameter-hints",
    label: "Trigger Parameter Hints",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: " ", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  // Smart select
  {
    commandId: "smart-select-expand",
    label: "Expand Selection (Smart)",
    category: "Selection",
    defaultKeybinding: { keystrokes: [{ key: "ArrowRight", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "smart-select-shrink",
    label: "Shrink Selection (Smart)",
    category: "Selection",
    defaultKeybinding: { keystrokes: [{ key: "ArrowLeft", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  // Quick fix and refactoring
  {
    commandId: "quick-fix",
    label: "Quick Fix",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: ".", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "refactor",
    label: "Refactor",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "r", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "source-action",
    label: "Source Action",
    category: "Edit",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  // Rename symbol
  {
    commandId: "rename-symbol",
    label: "Rename Symbol",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "F2", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  // Go to type definition
  {
    commandId: "go-to-type-definition",
    label: "Go to Type Definition",
    category: "Navigation",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  // Find references
  {
    commandId: "find-all-references",
    label: "Find All References",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "F12", modifiers: { ctrl: false, alt: true, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  // Call hierarchy
  {
    commandId: "show-call-hierarchy",
    label: "Show Call Hierarchy",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "h", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  // Type hierarchy
  {
    commandId: "show-type-hierarchy",
    label: "Show Type Hierarchy",
    category: "Navigation",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  // Imports management
  {
    commandId: "organize-imports",
    label: "Organize Imports",
    category: "Source",
    defaultKeybinding: { keystrokes: [{ key: "o", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "sort-imports",
    label: "Sort Imports",
    category: "Source",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  {
    commandId: "remove-unused-imports",
    label: "Remove Unused Imports",
    category: "Source",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  {
    commandId: "add-missing-imports",
    label: "Add Missing Imports",
    category: "Source",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  // Column selection mode
  {
    commandId: "toggle-column-selection",
    label: "Toggle Column Selection Mode",
    category: "Selection",
    defaultKeybinding: { keystrokes: [{ key: "c", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
];
