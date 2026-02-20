import type { CommandBinding } from "./types";

// ============================================================================
// Default Bindings Part 2: Selection, Editor Layout, View, File, Tasks, Debug
// ============================================================================

export const BINDINGS_PART2: Omit<CommandBinding, "customKeybinding">[] = [
  // Selection
  {
    commandId: "select-line",
    label: "Select Line",
    category: "Selection",
    defaultKeybinding: { keystrokes: [{ key: "l", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "expand-selection",
    label: "Expand Selection",
    category: "Selection",
    defaultKeybinding: { keystrokes: [{ key: "ArrowRight", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
  },
  {
    commandId: "shrink-selection",
    label: "Shrink Selection",
    category: "Selection",
    defaultKeybinding: { keystrokes: [{ key: "ArrowLeft", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
  },
  // Editor Layout
  {
    commandId: "split-editor-right",
    label: "Split Editor Right",
    category: "Editor Layout",
    defaultKeybinding: { keystrokes: [{ key: "\\", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "split-editor-down",
    label: "Split Editor Down",
    category: "Editor Layout",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "\\", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
  },
  {
    commandId: "close-editor",
    label: "Close Editor",
    category: "Editor Layout",
    defaultKeybinding: { keystrokes: [{ key: "w", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "close-all-editors",
    label: "Close All Editors",
    category: "Editor Layout",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "w", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
  },
  {
    commandId: "pin-tab",
    label: "Pin Tab",
    category: "Editor Layout",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "Enter", modifiers: { ctrl: false, alt: false, shift: true, meta: false } },
    ] },
  },
  {
    commandId: "unpin-tab",
    label: "Unpin Tab",
    category: "Editor Layout",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "Enter", modifiers: { ctrl: true, alt: false, shift: true, meta: false } },
    ] },
  },
  {
    commandId: "focus-next-group",
    label: "Focus Next Editor Group",
    category: "Editor Layout",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "ArrowRight", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
  },
  {
    commandId: "focus-previous-group",
    label: "Focus Previous Editor Group",
    category: "Editor Layout",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "ArrowLeft", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
  },
  // View
  {
    commandId: "toggle-sidebar",
    label: "Toggle Sidebar",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "b", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "toggle-terminal",
    label: "Toggle Terminal",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "`", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "toggle-problems",
    label: "Toggle Problems Panel",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "m", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "zoom-in",
    label: "Zoom In",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "=", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "zoom-out",
    label: "Zoom Out",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "-", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  // File
  {
    commandId: "new-file",
    label: "New File",
    category: "File",
    defaultKeybinding: { keystrokes: [{ key: "n", modifiers: { ctrl: true, alt: true, shift: false, meta: false } }] },
  },
  {
    commandId: "save-file",
    label: "Save File",
    category: "File",
    defaultKeybinding: { keystrokes: [{ key: "s", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "save-all",
    label: "Save All",
    category: "File",
    defaultKeybinding: { keystrokes: [{ key: "s", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  // Tasks
  {
    commandId: "run-task",
    label: "Run Task...",
    category: "Tasks",
    defaultKeybinding: { keystrokes: [{ key: "t", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "run-build-task",
    label: "Run Build Task",
    category: "Tasks",
    defaultKeybinding: { keystrokes: [{ key: "b", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "run-test-task",
    label: "Run Test Task",
    category: "Tasks",
    defaultKeybinding: { keystrokes: [{ key: "y", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  // Debug
  {
    commandId: "start-debugging",
    label: "Start Debugging",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F5", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "stop-debugging",
    label: "Stop Debugging",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F5", modifiers: { ctrl: false, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "toggle-breakpoint",
    label: "Toggle Breakpoint",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F9", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "step-over",
    label: "Step Over",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F10", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }] },
    when: "debuggingActive",
  },
  {
    commandId: "step-into",
    label: "Step Into",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F11", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "step-out",
    label: "Step Out",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F11", modifiers: { ctrl: false, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "continue",
    label: "Continue",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F5", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "jump-to-cursor",
    label: "Jump to Cursor (Set Next Statement)",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F10", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
    when: "debuggingActive && editorTextFocus",
  },
  {
    commandId: "step-into-targets",
    label: "Step Into Target...",
    category: "Debug",
    defaultKeybinding: null,
    when: "debuggingActive",
  },
  {
    commandId: "restart-frame",
    label: "Restart Frame",
    category: "Debug",
    defaultKeybinding: null,
    when: "debuggingActive",
  },
];
