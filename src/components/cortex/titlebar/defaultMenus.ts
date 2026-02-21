export interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
}

export const MENU_LABELS = [
  "File", "Edit", "Selection", "View", "Go",
  "Terminal", "Help",
];

const emit = (name: string) => () => window.dispatchEvent(new CustomEvent(name));

export const DEFAULT_MENUS: Record<string, MenuItem[]> = {
  File: [
    { label: "New File", shortcut: "⌘N", action: emit("file:new") },
    { label: "New Window", shortcut: "⌘⇧N", action: emit("window:new") },
    { separator: true, label: "" },
    { label: "Open File...", shortcut: "⌘O", action: emit("file:open") },
    { label: "Open Folder...", shortcut: "⌘K ⌘O", action: emit("folder:open") },
    { separator: true, label: "" },
    { label: "Save", shortcut: "⌘S", action: emit("file:save") },
    { label: "Save As...", shortcut: "⌘⇧S", action: emit("file:save-as") },
    { label: "Save All", shortcut: "⌘K S", action: emit("file:save-all") },
    { separator: true, label: "" },
    { label: "Close", shortcut: "⌘W", action: emit("file:close") },
    { label: "Close Folder", action: emit("folder:close") },
  ],
  Edit: [
    { label: "Undo", shortcut: "⌘Z", action: emit("edit:undo") },
    { label: "Redo", shortcut: "⌘⇧Z", action: emit("edit:redo") },
    { separator: true, label: "" },
    { label: "Cut", shortcut: "⌘X", action: emit("edit:cut") },
    { label: "Copy", shortcut: "⌘C", action: emit("edit:copy") },
    { label: "Paste", shortcut: "⌘V", action: emit("edit:paste") },
    { separator: true, label: "" },
    { label: "Find", shortcut: "⌘F", action: emit("edit:find") },
    { label: "Replace", shortcut: "⌘H", action: emit("edit:replace") },
  ],
  Selection: [
    { label: "Select All", shortcut: "⌘A", action: emit("selection:select-all") },
    { label: "Expand Selection", shortcut: "⇧⌥→", action: emit("selection:expand") },
    { label: "Shrink Selection", shortcut: "⇧⌥←", action: emit("selection:shrink") },
  ],
  View: [
    { label: "Command Palette...", shortcut: "⌘⇧P", action: emit("command-palette:open") },
    { label: "Quick Open...", shortcut: "⌘P", action: emit("quick-open:show") },
    { separator: true, label: "" },
    { label: "Explorer", shortcut: "⌘⇧E", action: emit("view:explorer") },
    { label: "Search", shortcut: "⌘⇧F", action: emit("view:search") },
    { label: "Terminal", shortcut: "⌘`", action: emit("terminal:toggle") },
  ],
  Go: [
    { label: "Go to File...", shortcut: "⌘P", action: emit("goto:file") },
    { label: "Go to Line...", shortcut: "⌘G", action: emit("goto:line") },
    { separator: true, label: "" },
    { label: "Go Back", shortcut: "⌘[", action: emit("goto:back") },
    { label: "Go Forward", shortcut: "⌘]", action: emit("goto:forward") },
  ],
  Terminal: [
    { label: "New Terminal", shortcut: "⌘⇧`", action: emit("terminal:new") },
    { label: "Split Terminal", action: emit("terminal:split") },
  ],
  Run: [
    { label: "Start Debugging", shortcut: "F5", action: emit("debug:start") },
    { label: "Run Without Debugging", shortcut: "⌃F5", action: emit("debug:run-no-debug") },
    { separator: true, label: "" },
    { label: "Stop Debugging", shortcut: "⇧F5", action: emit("debug:stop") },
    { label: "Restart Debugging", shortcut: "⇧⌘F5", action: emit("debug:restart") },
  ],
  Git: [
    { label: "Init Repository", action: emit("git:init") },
    { label: "Clone Repository...", action: emit("git:clone") },
    { separator: true, label: "" },
    { label: "Commit...", shortcut: "⌘⏎", action: emit("git:commit") },
    { label: "Push", action: emit("git:push") },
    { label: "Pull", action: emit("git:pull") },
  ],
  Developer: [
    { label: "Toggle Developer Tools", shortcut: "⌥⌘I", action: emit("dev:toggle-devtools") },
    { label: "Reload Window", shortcut: "⌘R", action: emit("dev:reload") },
  ],
  Help: [
    { label: "Welcome", action: emit("help:welcome") },
    { label: "Documentation", action: emit("help:docs") },
    { separator: true, label: "" },
    { label: "About", action: emit("help:about") },
  ],
};
