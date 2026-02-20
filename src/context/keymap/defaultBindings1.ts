import type { CommandBinding } from "./types";

// ============================================================================
// Default Bindings Part 1: General, Search, Navigation, Edit, Multi-Cursor
// ============================================================================

export const BINDINGS_PART1: Omit<CommandBinding, "customKeybinding">[] = [
  // General
  {
    commandId: "command-palette",
    label: "Show Command Palette",
    category: "General",
    defaultKeybinding: { keystrokes: [{ key: "p", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "file-finder",
    label: "Go to File",
    category: "General",
    defaultKeybinding: { keystrokes: [{ key: "p", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "settings",
    label: "Open Settings",
    category: "General",
    defaultKeybinding: { keystrokes: [{ key: ",", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "new-session",
    label: "New Session",
    category: "General",
    defaultKeybinding: { keystrokes: [{ key: "n", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  // Search
  {
    commandId: "buffer-search",
    label: "Find in File",
    category: "Search",
    defaultKeybinding: { keystrokes: [{ key: "f", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "project-search",
    label: "Find in Project",
    category: "Search",
    defaultKeybinding: { keystrokes: [{ key: "f", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "replace-in-file",
    label: "Replace in File",
    category: "Search",
    defaultKeybinding: { keystrokes: [{ key: "h", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  // Navigation
  {
    commandId: "go-to-line",
    label: "Go to Line",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "g", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "go-to-definition",
    label: "Go to Definition",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "F12", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "go-to-references",
    label: "Go to References",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "F12", modifiers: { ctrl: false, alt: false, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "go-back",
    label: "Go Back",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "-", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "go-forward",
    label: "Go Forward",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "-", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  // Edit
  {
    commandId: "undo",
    label: "Undo",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "z", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "redo",
    label: "Redo",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "z", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "cut",
    label: "Cut",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "x", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "copy",
    label: "Copy",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "c", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "paste",
    label: "Paste",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "v", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "select-all",
    label: "Select All",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "a", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "duplicate-selection",
    label: "Duplicate Selection",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "d", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "move-line-up",
    label: "Move Line Up",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "ArrowUp", modifiers: { ctrl: false, alt: true, shift: false, meta: false } }] },
    when: "editorTextFocus && !suggestWidgetVisible",
  },
  {
    commandId: "move-line-down",
    label: "Move Line Down",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "ArrowDown", modifiers: { ctrl: false, alt: true, shift: false, meta: false } }] },
    when: "editorTextFocus && !suggestWidgetVisible",
  },
  {
    commandId: "copy-line-up",
    label: "Copy Line Up",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "ArrowUp", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
  },
  {
    commandId: "copy-line-down",
    label: "Copy Line Down",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "ArrowDown", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
  },
  {
    commandId: "comment-line",
    label: "Toggle Line Comment",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "/", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  // Chord-based comment commands (Ctrl+K Ctrl+C / Ctrl+K Ctrl+U)
  {
    commandId: "add-line-comment",
    label: "Add Line Comment",
    category: "Edit",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "c", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
  },
  {
    commandId: "remove-line-comment",
    label: "Remove Line Comment",
    category: "Edit",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "u", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
  },
  {
    commandId: "save-without-formatting",
    label: "Save Without Formatting",
    category: "File",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "s", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
  },
  {
    commandId: "indent",
    label: "Indent Line",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "]", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "outdent",
    label: "Outdent Line",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "[", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  // Multi-Cursor
  {
    commandId: "add-cursor-above",
    label: "Add Cursor Above",
    category: "Multi-Cursor",
    defaultKeybinding: { keystrokes: [{ key: "ArrowUp", modifiers: { ctrl: true, alt: true, shift: false, meta: false } }] },
  },
  {
    commandId: "add-cursor-below",
    label: "Add Cursor Below",
    category: "Multi-Cursor",
    defaultKeybinding: { keystrokes: [{ key: "ArrowDown", modifiers: { ctrl: true, alt: true, shift: false, meta: false } }] },
  },
  {
    commandId: "select-all-occurrences",
    label: "Select All Occurrences",
    category: "Multi-Cursor",
    defaultKeybinding: { keystrokes: [{ key: "l", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "add-next-occurrence",
    label: "Add Selection to Next Find Match",
    category: "Multi-Cursor",
    defaultKeybinding: { keystrokes: [{ key: "d", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "add-cursors-to-line-ends",
    label: "Add Cursors to Line Ends",
    category: "Multi-Cursor",
    defaultKeybinding: { keystrokes: [{ key: "i", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
  },
];
