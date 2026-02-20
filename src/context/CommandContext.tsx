import { createContext, useContext, createSignal, createMemo, JSX, onMount, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  category?: string;
  action: () => void;
  isExtension?: boolean;  // Flag for extension commands
}

interface CommandContextValue {
  commands: () => Command[];
  registerCommand: (command: Command) => void;
  unregisterCommand: (id: string) => void;
  executeCommand: (id: string) => void;
  
  showCommandPalette: () => boolean;
  setShowCommandPalette: (show: boolean) => void;
  showFileFinder: () => boolean;
  setShowFileFinder: (show: boolean) => void;
  showBufferSearch: () => boolean;
  setShowBufferSearch: (show: boolean) => void;
  showGoToLine: () => boolean;
  setShowGoToLine: (show: boolean) => void;
  showProjectSearch: () => boolean;
  setShowProjectSearch: (show: boolean) => void;
  showProjectSymbols: () => boolean;
  setShowProjectSymbols: (show: boolean) => void;
  showWorkspaceSymbolPicker: () => boolean;
  setShowWorkspaceSymbolPicker: (show: boolean) => void;
  showDocumentSymbolPicker: () => boolean;
  setShowDocumentSymbolPicker: (show: boolean) => void;
  showViewQuickAccess: () => boolean;
  setShowViewQuickAccess: (show: boolean) => void;
  showEmmetWrapDialog: () => boolean;
  setShowEmmetWrapDialog: (show: boolean) => void;
}

const CommandContext = createContext<CommandContextValue>();

export function CommandProvider(props: { children: JSX.Element }) {
  const [commands, setCommands] = createSignal<Command[]>([]);
  const [showCommandPalette, setShowCommandPalette] = createSignal(false);
  const [showFileFinder, setShowFileFinder] = createSignal(false);
  const [showBufferSearch, setShowBufferSearch] = createSignal(false);
  const [showGoToLine, setShowGoToLine] = createSignal(false);
  const [showProjectSearch, setShowProjectSearch] = createSignal(false);
  const [showProjectSymbols, setShowProjectSymbols] = createSignal(false);
  const [showWorkspaceSymbolPicker, setShowWorkspaceSymbolPicker] = createSignal(false);
  const [showDocumentSymbolPicker, setShowDocumentSymbolPicker] = createSignal(false);
  const [showViewQuickAccess, setShowViewQuickAccess] = createSignal(false);
  const [showEmmetWrapDialog, setShowEmmetWrapDialog] = createSignal(false);

  // Memoized Map for O(1) command lookup instead of O(n) find()
  const commandMap = createMemo(() => new Map(commands().map(c => [c.id, c])));

  const registerCommand = (command: Command) => {
    setCommands((prev) => [...prev.filter((c) => c.id !== command.id), command]);
  };

  const unregisterCommand = (id: string) => {
    setCommands((prev) => prev.filter((c) => c.id !== id));
  };

  const executeCommand = async (id: string) => {
    const command = commandMap().get(id);
    if (command) {
      if (command.isExtension) {
        // Execute extension command via Tauri
        try {
          // First try builtin command
          try {
            await invoke("vscode_execute_builtin_command", { command: id, args: [] });
            return;
          } catch (err) {
            console.debug("[Command] Builtin failed, trying extension host:", err);
          }
          await invoke("vscode_execute_command", { command: id, args: [] });
        } catch (e) {
          console.error(`Failed to execute extension command ${id}:`, e);
        }
      } else {
        command.action();
      }
    }
  };

  // Load extension commands from Tauri
  const loadExtensionCommands = async () => {
    try {
      const extensionCommands = await invoke<Array<{
        id: string;
        label: string;
        category: string | null;
        detail: string | null;
        icon: string | null;
      }>>("vscode_get_command_palette_items");

      // Convert to Command format and register
      for (const cmd of extensionCommands) {
        const command: Command = {
          id: cmd.id,
          label: cmd.label,
          category: cmd.category || "Extension",
          isExtension: true,
          action: async () => {
            try {
              await invoke("vscode_execute_builtin_command", { command: cmd.id, args: [] });
            } catch (err) {
              console.debug("[Command] Builtin failed:", err);
              await invoke("vscode_execute_command", { command: cmd.id, args: [] });
            }
          },
        };
        registerCommand(command);
      }
    } catch (err) {
      console.debug("[Command] Extension commands unavailable:", err);
    }
  };

  const closeAllModals = () => {
    setShowCommandPalette(false);
    setShowFileFinder(false);
    setShowBufferSearch(false);
    setShowGoToLine(false);
    setShowProjectSearch(false);
    setShowProjectSymbols(false);
    setShowWorkspaceSymbolPicker(false);
    setShowDocumentSymbolPicker(false);
    setShowViewQuickAccess(false);
    setShowEmmetWrapDialog(false);
  };

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        closeAllModals();
        setShowCommandPalette(true);
        return;
      }

      // Note: Ctrl+K is now a chord prefix handled by KeymapContext
      // It triggers chord mode and waits for a second key (e.g., Ctrl+K Ctrl+C)

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "p") {
        e.preventDefault();
        closeAllModals();
        setShowFileFinder(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "f" && !e.shiftKey) {
        e.preventDefault();
        closeAllModals();
        setShowBufferSearch(true);
        return;
      }

      // Find and Replace: Ctrl+H
      if ((e.ctrlKey || e.metaKey) && e.key === "h" && !e.shiftKey) {
        e.preventDefault();
        closeAllModals();
        // Dispatch event to open replace mode
        window.dispatchEvent(new CustomEvent("buffer-search:show-replace"));
        setShowBufferSearch(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        closeAllModals();
        setShowProjectSearch(true);
        return;
      }

      // Document Symbols: Ctrl+Shift+O (Go to Symbol in Editor)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "O") {
        e.preventDefault();
        closeAllModals();
        setShowDocumentSymbolPicker(true);
        return;
      }

      // Workspace Symbol Picker: Ctrl+T (Go to Symbol in Workspace)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "t") {
        e.preventDefault();
        closeAllModals();
        setShowWorkspaceSymbolPicker(true);
        return;
      }

      // View Quick Access: Ctrl+Q
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "q") {
        e.preventDefault();
        closeAllModals();
        setShowViewQuickAccess(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        e.preventDefault();
        closeAllModals();
        setShowGoToLine(true);
        return;
      }

      // Navigate Back: Alt+Left
      if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && e.key === "ArrowLeft") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("navigation:back"));
        return;
      }

      // Navigate Forward: Alt+Right
      if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && e.key === "ArrowRight") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("navigation:forward"));
        return;
      }

      // Show Incoming Calls: Shift+Alt+H
      if (e.shiftKey && e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("call-hierarchy:show", { detail: { direction: "incoming" } }));
        return;
      }

      // Show Outgoing Calls: Shift+Alt+G
      if (e.shiftKey && e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("call-hierarchy:show", { detail: { direction: "outgoing" } }));
        return;
      }

      // Focus Explorer: Ctrl+Shift+E (VS Code standard)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "E") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("layout:focus-explorer"));
        return;
      }

      // Recent Projects: Ctrl+Alt+R
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === "r") {
        e.preventDefault();
        closeAllModals();
        window.dispatchEvent(new CustomEvent("recent-projects:open"));
        return;
      }

      // Toggle Screencast Mode: Ctrl+Alt+K
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("screencast:toggle"));
        return;
      }

      // Toggle Panel: Ctrl+J (VS Code standard)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === "j") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("layout:toggle-panel"));
        return;
      }

      // Search Editor: Ctrl+Shift+J
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "J") {
        e.preventDefault();
        closeAllModals();
        window.dispatchEvent(new CustomEvent("search:open-editor"));
        return;
      }

      // Focus Debug Panel: Ctrl+Shift+D
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "D") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("layout:focus-debug"));
        return;
      }

      // Focus Source Control: Ctrl+Shift+G
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key === "G") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("layout:focus-view", { detail: { view: "scm" } }));
        return;
      }

      // Toggle Sidebar: Ctrl+B
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === "b") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("layout:toggle-sidebar"));
        return;
      }

      // Next Tab: Ctrl+Tab
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "Tab") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("editor:next-tab"));
        return;
      }

      // Previous Tab: Ctrl+Shift+Tab
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Tab") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("editor:prev-tab"));
        return;
      }

      // Replace in Files (project-wide): Ctrl+Shift+H
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "H") {
        e.preventDefault();
        closeAllModals();
        setShowProjectSearch(true);
        window.dispatchEvent(new CustomEvent("search:focus-replace"));
        return;
      }

      // Run Build Task: Ctrl+Shift+B
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "B") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("tasks:run-build"));
        return;
      }

      // Run Task: Ctrl+Shift+T
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "T") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("tasks:open-run-dialog"));
        return;
      }

      // Toggle Terminal: Ctrl+`
      if ((e.ctrlKey || e.metaKey) && e.key === "`" && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("terminal:toggle"));
        return;
      }

      // New Terminal: Ctrl+Shift+`
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "`") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("terminal:new"));
        return;
      }

      // Run Selection in Terminal: Ctrl+Shift+Enter
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("terminal:run-selection"));
        return;
      }

      // Emmet: Balance Inward - Ctrl+Shift+[
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "[" || e.code === "BracketLeft")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("emmet:balance-inward"));
        return;
      }

      // Emmet: Balance Outward - Ctrl+Shift+]
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "]" || e.code === "BracketRight")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("emmet:balance-outward"));
        return;
      }

      // Emmet: Wrap with Abbreviation - Ctrl+Shift+A
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "A") {
        e.preventDefault();
        closeAllModals();
        setShowEmmetWrapDialog(true);
        return;
      }

      if (e.key === "Escape") {
        closeAllModals();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  onMount(() => {
    const defaultCommands: Command[] = [
      {
        id: "command-palette",
        label: "Show Command Palette",
        shortcut: "Ctrl+Shift+P",
        category: "General",
        action: () => setShowCommandPalette(true),
      },
      {
        id: "file-finder",
        label: "Go to File",
        shortcut: "Ctrl+P",
        category: "General",
        action: () => setShowFileFinder(true),
      },
      {
        id: "buffer-search",
        label: "Find in File",
        shortcut: "Ctrl+F",
        category: "Search",
        action: () => setShowBufferSearch(true),
      },
      {
        id: "replace-in-file",
        label: "Replace in File",
        shortcut: "Ctrl+H",
        category: "Search",
        action: () => {
          window.dispatchEvent(new CustomEvent("buffer-search:show-replace"));
          setShowBufferSearch(true);
        },
      },
      {
        id: "project-search",
        label: "Find in Project",
        shortcut: "Ctrl+Shift+F",
        category: "Search",
        action: () => setShowProjectSearch(true),
      },
      {
        id: "go-to-line",
        label: "Go to Line",
        shortcut: "Ctrl+G",
        category: "Navigation",
        action: () => setShowGoToLine(true),
      },
      {
        id: "go-back",
        label: "Go Back",
        shortcut: "Alt+Left",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("navigation:back"));
        },
      },
      {
        id: "go-forward",
        label: "Go Forward",
        shortcut: "Alt+Right",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("navigation:forward"));
        },
      },
      {
        id: "document-symbols",
        label: "Go to Symbol in Editor",
        shortcut: "Ctrl+Shift+O",
        category: "Navigation",
        action: () => setShowDocumentSymbolPicker(true),
      },
      {
        id: "project-symbols",
        label: "Go to Symbol in Workspace",
        category: "Navigation",
        action: () => setShowProjectSymbols(true),
      },
      {
        id: "workspace-symbol-picker",
        label: "Go to Symbol in Workspace...",
        shortcut: "Ctrl+T",
        category: "Navigation",
        action: () => setShowWorkspaceSymbolPicker(true),
      },
      {
        id: "breadcrumbs.copyPath",
        label: "Copy Breadcrumbs Path",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("breadcrumbs:copy-path"));
        },
      },
      {
        id: "breadcrumbs.copyRelativePath",
        label: "Copy Breadcrumbs Relative Path",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("breadcrumbs:copy-relative-path"));
        },
      },
      {
        id: "breadcrumbs.revealInExplorer",
        label: "Reveal in File Explorer",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("breadcrumbs:reveal-in-explorer"));
        },
      },
      {
        id: "breadcrumbs.focus",
        label: "Focus Breadcrumbs",
        shortcut: "Ctrl+Shift+.",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("breadcrumbs:focus"));
        },
      },
      {
        id: "breadcrumbs.toggle",
        label: "Toggle Breadcrumbs",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("breadcrumbs:toggle"));
        },
      },
      // Peek commands for inline code navigation
      {
        id: "editor.action.peekDefinition",
        label: "Peek Definition",
        shortcut: "Alt+F12",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "peek-definition" } }));
        },
      },
      {
        id: "editor.action.referenceSearch.trigger",
        label: "Peek References",
        shortcut: "Shift+F12",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "peek-references" } }));
        },
      },
      {
        id: "editor.action.peekImplementation",
        label: "Peek Implementation",
        shortcut: "Ctrl+Shift+F12",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "peek-implementation" } }));
        },
      },
      {
        id: "editor.action.goToImplementation",
        label: "Go to Implementation",
        shortcut: "Ctrl+F12",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "go-to-implementation" } }));
        },
      },
      // Call Hierarchy commands
      {
        id: "editor.showIncomingCalls",
        label: "Show Incoming Calls",
        shortcut: "Shift+Alt+H",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("call-hierarchy:show", { detail: { direction: "incoming" } }));
        },
      },
      {
        id: "editor.showOutgoingCalls",
        label: "Show Outgoing Calls",
        shortcut: "Shift+Alt+G",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("call-hierarchy:show", { detail: { direction: "outgoing" } }));
        },
      },
      {
        id: "add-cursor-above",
        label: "Add Cursor Above",
        shortcut: "Ctrl+Alt+Up",
        category: "Multi-Cursor",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "add-cursor-above" } }));
        },
      },
      {
        id: "add-cursor-below",
        label: "Add Cursor Below",
        shortcut: "Ctrl+Alt+Down",
        category: "Multi-Cursor",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "add-cursor-below" } }));
        },
      },
      {
        id: "select-all-occurrences",
        label: "Select All Occurrences",
        shortcut: "Ctrl+Shift+L",
        category: "Multi-Cursor",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "select-all-occurrences" } }));
        },
      },
      {
        id: "add-next-occurrence",
        label: "Add Selection to Next Find Match",
        shortcut: "Ctrl+D",
        category: "Multi-Cursor",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "add-selection-to-next-find-match" } }));
        },
      },
      {
        id: "add-cursors-to-line-ends",
        label: "Add Cursors to Line Ends",
        shortcut: "Shift+Alt+I",
        category: "Multi-Cursor",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "add-cursors-to-line-ends" } }));
        },
      },
      {
        id: "undo-cursor",
        label: "Undo Last Cursor Operation",
        shortcut: "Ctrl+U",
        category: "Multi-Cursor",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "undo-cursor" } }));
        },
      },
      {
        id: "split-editor-right",
        label: "Split Editor Right",
        shortcut: "Ctrl+\\",
        category: "Editor Layout",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-split", { detail: { direction: "vertical" } }));
        },
      },
      {
        id: "split-editor-down",
        label: "Split Editor Down",
        shortcut: "Ctrl+K Ctrl+\\",
        category: "Editor Layout",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-split", { detail: { direction: "horizontal" } }));
        },
      },
      {
        id: "close-editor-group",
        label: "Close Editor Group",
        shortcut: "Ctrl+K W",
        category: "Editor Layout",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-close-group", {}));
        },
      },
      {
        id: "pin-tab",
        label: "Pin Tab",
        shortcut: "Ctrl+K Shift+Enter",
        category: "Editor Layout",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-pin-tab", {}));
        },
      },
      {
        id: "unpin-tab",
        label: "Unpin Tab",
        shortcut: "Ctrl+K Ctrl+Shift+Enter",
        category: "Editor Layout",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-unpin-tab", {}));
        },
      },
      {
        id: "toggle-pin-tab",
        label: "Toggle Pin Tab",
        category: "Editor Layout",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-toggle-pin-tab", {}));
        },
      },
      {
        id: "focus-next-group",
        label: "Focus Next Editor Group",
        shortcut: "Ctrl+K Ctrl+Right",
        category: "Editor Layout",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-focus-next-group", {}));
        },
      },
      {
        id: "focus-previous-group",
        label: "Focus Previous Editor Group",
        shortcut: "Ctrl+K Ctrl+Left",
        category: "Editor Layout",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-focus-previous-group", {}));
        },
      },
      {
        id: "unsplit-all",
        label: "Close All Splits",
        category: "Editor Layout",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-unsplit", {}));
        },
      },
      {
        id: "move-editor-to-next-group",
        label: "Move Editor to Next Group",
        shortcut: "Ctrl+Alt+Right",
        category: "Editor Layout",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-move-to-next-group", {}));
        },
      },
      {
        id: "toggle-grid-layout",
        label: "Toggle Grid Layout Mode",
        category: "Editor Layout",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-toggle-grid-layout", {}));
        },
      },
      {
        id: "create-2x2-layout",
        label: "Create 2x2 Grid Layout",
        category: "Editor Layout",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-create-2x2-layout", {}));
        },
      },
      {
        id: "create-3-column-layout",
        label: "Create 3 Column Layout",
        category: "Editor Layout",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-create-3-column-layout", {}));
        },
      },
      {
        id: "reset-grid-layout",
        label: "Reset Grid Layout",
        category: "Editor Layout",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-reset-grid-layout", {}));
        },
      },
      {
        id: "duplicate-selection",
        label: "Duplicate Selection",
        shortcut: "Ctrl+D",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "duplicate-selection" } }));
        },
      },
      {
        id: "move-line-up",
        label: "Move Line Up",
        shortcut: "Alt+Up",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "move-line-up" } }));
        },
      },
      {
        id: "move-line-down",
        label: "Move Line Down",
        shortcut: "Alt+Down",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "move-line-down" } }));
        },
      },
      {
        id: "copy-line-up",
        label: "Copy Line Up",
        shortcut: "Shift+Alt+Up",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "copy-line-up" } }));
        },
      },
      {
        id: "copy-line-down",
        label: "Copy Line Down",
        shortcut: "Shift+Alt+Down",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "copy-line-down" } }));
        },
      },
      {
        id: "select-line",
        label: "Select Line",
        shortcut: "Ctrl+L",
        category: "Selection",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "select-line" } }));
        },
      },
      {
        id: "expand-selection",
        label: "Expand Selection",
        shortcut: "Shift+Alt+Right",
        category: "Selection",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "expand-selection" } }));
        },
      },
      {
        id: "shrink-selection",
        label: "Shrink Selection",
        shortcut: "Shift+Alt+Left",
        category: "Selection",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "shrink-selection" } }));
        },
      },
      {
        id: "transform-uppercase",
        label: "Transform to Uppercase",
        category: "Transform",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "transform-to-uppercase" } }));
        },
      },
      {
        id: "transform-lowercase",
        label: "Transform to Lowercase",
        category: "Transform",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "transform-to-lowercase" } }));
        },
      },
      {
        id: "transform-titlecase",
        label: "Transform to Title Case",
        category: "Transform",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "transform-to-titlecase" } }));
        },
      },
      {
        id: "transform-snakecase",
        label: "Transform to Snake_case",
        category: "Transform",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "transform-to-snakecase" } }));
        },
      },
      {
        id: "transform-camelcase",
        label: "Transform to camelCase",
        category: "Transform",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "transform-to-camelcase" } }));
        },
      },
      {
        id: "transform-pascalcase",
        label: "Transform to PascalCase",
        category: "Transform",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "transform-to-pascalcase" } }));
        },
      },
      {
        id: "transform-kebabcase",
        label: "Transform to kebab-case",
        category: "Transform",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "transform-to-kebabcase" } }));
        },
      },
      {
        id: "transform-constantcase",
        label: "Transform to CONSTANT_CASE",
        category: "Transform",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "transform-to-constantcase" } }));
        },
      },
      // Comment commands
      {
        id: "toggle-line-comment",
        label: "Toggle Line Comment",
        shortcut: "Ctrl+/",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "toggle-line-comment" } }));
        },
      },
      {
        id: "toggle-block-comment",
        label: "Toggle Block Comment",
        shortcut: "Ctrl+Shift+/",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "toggle-block-comment" } }));
        },
      },
      // Chord-based comment commands (Ctrl+K Ctrl+C / Ctrl+K Ctrl+U)
      {
        id: "add-line-comment",
        label: "Add Line Comment",
        shortcut: "Ctrl+K Ctrl+C",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "add-line-comment" } }));
        },
      },
      {
        id: "remove-line-comment",
        label: "Remove Line Comment",
        shortcut: "Ctrl+K Ctrl+U",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "remove-line-comment" } }));
        },
      },
      {
        id: "save-without-formatting",
        label: "Save Without Formatting",
        shortcut: "Ctrl+K Ctrl+S",
        category: "File",
        action: () => {
          window.dispatchEvent(new CustomEvent("file:save-without-formatting"));
        },
      },
      // Formatting commands
      {
        id: "format-document",
        label: "Format Document",
        shortcut: "Shift+Alt+F",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-format-document"));
        },
      },
      {
        id: "indent-lines",
        label: "Indent Lines",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "indent-lines" } }));
        },
      },
      {
        id: "outdent-lines",
        label: "Outdent Lines",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "outdent-lines" } }));
        },
      },
      {
        id: "editor.action.joinLines",
        label: "Join Lines",
        shortcut: "Ctrl+Alt+J",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor:action", { 
            detail: { action: "editor.action.joinLines" } 
          }));
        },
      },
      // View commands
      {
        id: "toggle-sidebar-position",
        label: "View: Toggle Sidebar Position",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("sidebar:toggle-position"));
        },
      },
      {
        id: "toggle-word-wrap",
        label: "Toggle Word Wrap",
        shortcut: "Alt+Z",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-toggle-word-wrap"));
        },
      },
      {
        id: "toggle-minimap",
        label: "Toggle Minimap",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-toggle-minimap"));
        },
      },
      {
        id: "toggle-sticky-scroll",
        label: "Toggle Sticky Scroll",
        shortcut: "Ctrl+Shift+Y",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-toggle-sticky-scroll"));
        },
      },
      {
        id: "view-quick-access",
        label: "Open View",
        shortcut: "Ctrl+Q",
        category: "View",
        action: () => setShowViewQuickAccess(true),
      },
      // Layout commands
      {
        id: "toggle-panel",
        label: "Toggle Panel",
        shortcut: "Ctrl+J",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("layout:toggle-panel"));
        },
      },
      {
        id: "focus-explorer",
        label: "Focus Explorer",
        shortcut: "Ctrl+Shift+E",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("layout:focus-explorer"));
        },
      },
      {
        id: "focus-debug",
        label: "Focus Debug Panel",
        shortcut: "Ctrl+Shift+D",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("layout:focus-debug"));
        },
      },
      {
        id: "toggle-sidebar",
        label: "Toggle Sidebar",
        shortcut: "Ctrl+B",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("layout:toggle-sidebar"));
        },
      },
      {
        id: "focus-scm",
        label: "Focus Source Control",
        shortcut: "Ctrl+Shift+G",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("layout:focus-view", { detail: { view: "scm" } }));
        },
      },
      // File save commands
      {
        id: "save-file",
        label: "Save File",
        shortcut: "Ctrl+S",
        category: "File",
        action: () => {
          window.dispatchEvent(new CustomEvent("file:save"));
        },
      },
      {
        id: "save-all",
        label: "Save All",
        shortcut: "Ctrl+Shift+S",
        category: "File",
        action: () => {
          window.dispatchEvent(new CustomEvent("file:save-all"));
        },
      },
      // Tab Navigation
      {
        id: "next-tab",
        label: "Switch to Next Tab",
        shortcut: "Ctrl+Tab",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor:next-tab"));
        },
      },
      {
        id: "prev-tab",
        label: "Switch to Previous Tab",
        shortcut: "Ctrl+Shift+Tab",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor:prev-tab"));
        },
      },
      // Project-wide search and replace
      {
        id: "replace-in-files",
        label: "Replace in Files",
        shortcut: "Ctrl+Shift+H",
        category: "Search",
        action: () => {
          setShowProjectSearch(true);
          window.dispatchEvent(new CustomEvent("search:focus-replace"));
        },
      },
      // Search Editor - dedicated results view
      {
        id: "search.openSearchEditor",
        label: "Open Search Editor",
        shortcut: "Ctrl+Shift+J",
        category: "Search",
        action: () => {
          window.dispatchEvent(new CustomEvent("search:open-editor"));
        },
      },
      // Search in Open Editors
      {
        id: "search.searchInOpenEditors",
        label: "Search in Open Editors",
        category: "Search",
        action: () => {
          window.dispatchEvent(new CustomEvent("search:in-open-editors"));
        },
      },
      // Toggle Multiline Search
      {
        id: "search.toggleMultilineSearch",
        label: "Toggle Multiline Search",
        category: "Search",
        action: () => {
          window.dispatchEvent(new CustomEvent("search:toggle-multiline"));
        },
      },
      // Clear Search History
      {
        id: "search.clearHistory",
        label: "Clear Search History",
        category: "Search",
        action: () => {
          localStorage.removeItem("cortex_search_history");
          localStorage.removeItem("cortex_include_history");
          localStorage.removeItem("cortex_exclude_history");
          window.dispatchEvent(new CustomEvent("notification", {
            detail: { type: "success", message: "Search history cleared" }
          }));
        },
      },
      // Recent Projects
      {
        id: "recent-projects",
        label: "Open Recent Project...",
        shortcut: "Ctrl+Alt+R",
        category: "File",
        action: () => {
          window.dispatchEvent(new CustomEvent("recent-projects:open"));
        },
      },
      // Task commands
      {
        id: "run-task",
        label: "Run Task...",
        shortcut: "Ctrl+Shift+T",
        category: "Tasks",
        action: () => {
          window.dispatchEvent(new CustomEvent("tasks:open-run-dialog"));
        },
      },
      {
        id: "run-build-task",
        label: "Run Build Task",
        shortcut: "Ctrl+Shift+B",
        category: "Tasks",
        action: () => {
          window.dispatchEvent(new CustomEvent("tasks:run-build"));
        },
      },
      {
        id: "run-test-task",
        label: "Run Test Task",
        shortcut: "Ctrl+Shift+Y",
        category: "Tasks",
        action: () => {
          window.dispatchEvent(new CustomEvent("tasks:run-test"));
        },
      },
      {
        id: "show-tasks-panel",
        label: "Show Tasks Panel",
        category: "Tasks",
        action: () => {
          window.dispatchEvent(new CustomEvent("tasks:open-panel"));
        },
      },
{
        id: "configure-task",
        label: "Configure Task...",
        category: "Tasks",
        action: () => {
          window.dispatchEvent(new CustomEvent("tasks:open-config-editor"));
        },
      },
      {
        id: "edit-tasks-json",
        label: "Edit tasks.json",
        category: "Tasks",
        action: () => {
          window.dispatchEvent(new CustomEvent("tasks:open-json-editor"));
        },
      },
      {
        id: "refresh-tasks",
        label: "Refresh Tasks",
        category: "Tasks",
        action: () => {
          window.dispatchEvent(new CustomEvent("tasks:refresh"));
        },
      },
      // Terminal commands
      {
        id: "toggle-terminal",
        label: "Toggle Terminal Panel",
        shortcut: "Ctrl+`",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:toggle"));
        },
      },
      {
        id: "new-terminal",
        label: "New Terminal",
        shortcut: "Ctrl+Shift+`",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:new"));
        },
      },
      {
        id: "clear-terminal",
        label: "Clear Terminal",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:clear"));
        },
      },
      {
        id: "kill-terminal",
        label: "Kill Terminal Process",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:kill"));
        },
      },
      {
        id: "terminal-go-to-prev-command",
        label: "Terminal: Go to Previous Command",
        shortcut: "Ctrl+Up (in terminal)",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:goToPrevCommand"));
        },
      },
      {
        id: "terminal-go-to-next-command",
        label: "Terminal: Go to Next Command",
        shortcut: "Ctrl+Down (in terminal)",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:goToNextCommand"));
        },
      },
      {
        id: "terminal.selectAll",
        label: "Terminal: Select All",
        shortcut: "Ctrl+A (in terminal)",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:select-all"));
        },
      },
      // Sort commands
      {
        id: "sort-lines-ascending",
        label: "Sort Lines Ascending",
        category: "Sort",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "sort-lines-ascending" } }));
        },
      },
      {
        id: "sort-lines-descending",
        label: "Sort Lines Descending",
        category: "Sort",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "sort-lines-descending" } }));
        },
      },
      {
        id: "sort-lines-ascending-case-insensitive",
        label: "Sort Lines Ascending (Case Insensitive)",
        category: "Sort",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "sort-lines-ascending-case-insensitive" } }));
        },
      },
      {
        id: "sort-lines-descending-case-insensitive",
        label: "Sort Lines Descending (Case Insensitive)",
        category: "Sort",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "sort-lines-descending-case-insensitive" } }));
        },
      },
      {
        id: "sort-lines-natural",
        label: "Sort Lines Ascending (Natural)",
        category: "Sort",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "sort-lines-natural" } }));
        },
      },
      {
        id: "sort-lines-by-length",
        label: "Sort Lines by Length",
        category: "Sort",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "sort-lines-by-length" } }));
        },
      },
      {
        id: "reverse-lines",
        label: "Reverse Lines",
        category: "Sort",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "reverse-lines" } }));
        },
      },
      {
        id: "shuffle-lines",
        label: "Shuffle Lines",
        category: "Sort",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "shuffle-lines" } }));
        },
      },
      {
        id: "remove-duplicate-lines",
        label: "Remove Duplicate Lines",
        category: "Sort",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "remove-duplicate-lines" } }));
        },
      },
      // Emmet commands
      {
        id: "emmet-balance-inward",
        label: "Emmet: Balance Inward",
        shortcut: "Ctrl+Shift+[",
        category: "Emmet",
        action: () => {
          window.dispatchEvent(new CustomEvent("emmet:balance-inward"));
        },
      },
      {
        id: "emmet-balance-outward",
        label: "Emmet: Balance Outward",
        shortcut: "Ctrl+Shift+]",
        category: "Emmet",
        action: () => {
          window.dispatchEvent(new CustomEvent("emmet:balance-outward"));
        },
      },
      {
        id: "emmet-wrap-with-abbreviation",
        label: "Emmet: Wrap with Abbreviation",
        shortcut: "Ctrl+Shift+A",
        category: "Emmet",
        action: () => {
          closeAllModals();
          setShowEmmetWrapDialog(true);
        },
      },
      // AI Sub-Agent commands
      {
        id: "subagent-manager",
        label: "Sub-Agents: Open Manager",
        category: "AI",
        action: () => {
          window.dispatchEvent(new CustomEvent("subagent:open-manager"));
        },
      },
      {
        id: "subagent-create",
        label: "Sub-Agents: Create New Agent",
        category: "AI",
        action: () => {
          window.dispatchEvent(new CustomEvent("subagent:create-new"));
        },
      },
      {
        id: "subagent-code",
        label: "Sub-Agents: Use Code Agent",
        category: "AI",
        action: () => {
          window.dispatchEvent(new CustomEvent("subagent:select", { detail: { type: "code" } }));
        },
      },
      {
        id: "subagent-research",
        label: "Sub-Agents: Use Research Agent",
        category: "AI",
        action: () => {
          window.dispatchEvent(new CustomEvent("subagent:select", { detail: { type: "research" } }));
        },
      },
      {
        id: "subagent-refactor",
        label: "Sub-Agents: Use Refactor Agent",
        category: "AI",
        action: () => {
          window.dispatchEvent(new CustomEvent("subagent:select", { detail: { type: "refactor" } }));
        },
      },
      {
        id: "subagent-export",
        label: "Sub-Agents: Export Custom Agents",
        category: "AI",
        action: () => {
          window.dispatchEvent(new CustomEvent("subagent:export"));
        },
      },
      {
        id: "subagent-import",
        label: "Sub-Agents: Import Agents",
        category: "AI",
        action: () => {
          window.dispatchEvent(new CustomEvent("subagent:import"));
        },
      },
      // Git Blame commands
      {
        id: "toggle-inline-blame",
        label: "Toggle Inline Git Blame",
        shortcut: "Ctrl+Alt+B",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("inline-blame:toggle"));
        },
      },
      {
        id: "inline-blame-current-line",
        label: "Inline Blame: Show Current Line Only",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("inline-blame:mode-changed", { detail: { mode: "currentLine" } }));
        },
      },
      {
        id: "inline-blame-all-lines",
        label: "Inline Blame: Show All Lines",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("inline-blame:mode-changed", { detail: { mode: "allLines" } }));
        },
      },
      {
        id: "inline-blame-off",
        label: "Inline Blame: Turn Off",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("inline-blame:mode-changed", { detail: { mode: "off" } }));
        },
      },
      // Git diff navigation commands
      {
        id: "editor.action.dirtydiff.next",
        label: "Go to Next Change",
        shortcut: "Alt+F3",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:go-to-next-change"));
        },
      },
      {
        id: "editor.action.dirtydiff.previous",
        label: "Go to Previous Change",
        shortcut: "Shift+Alt+F3",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:go-to-prev-change"));
        },
      },
      // Git incoming/outgoing commands
      {
        id: "git.showIncomingChanges",
        label: "Show Incoming Changes",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:show-incoming"));
        },
      },
      {
        id: "git.showOutgoingChanges",
        label: "Show Outgoing Changes",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:show-outgoing"));
        },
      },
      {
        id: "git.fetchAndShowChanges",
        label: "Fetch and Show Changes",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:fetch-and-show"));
        },
      },
      {
        id: "git.sync",
        label: "Sync (Pull then Push)",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:sync"));
        },
      },
      // Git Worktree commands
      {
        id: "git.worktree.list",
        label: "List Worktrees",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:worktree-list"));
        },
      },
      {
        id: "git.worktree.add",
        label: "Add Worktree...",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:worktree-add"));
        },
      },
      {
        id: "git.worktree.remove",
        label: "Remove Worktree...",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:worktree-remove"));
        },
      },
      // Git LFS commands
      {
        id: "git.lfs.status",
        label: "LFS: Show Status",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:lfs-status"));
        },
      },
      {
        id: "git.lfs.track",
        label: "LFS: Track Pattern...",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:lfs-track"));
        },
      },
      {
        id: "git.lfs.fetch",
        label: "LFS: Fetch Files",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:lfs-fetch"));
        },
      },
      {
        id: "git.lfs.pull",
        label: "LFS: Pull Files",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:lfs-pull"));
        },
      },
      {
        id: "git.lfs.push",
        label: "LFS: Push Files",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:lfs-push"));
        },
      },
      // Git Tags commands
      {
        id: "git.tags.list",
        label: "List Tags",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:tags-list"));
        },
      },
      {
        id: "git.tags.create",
        label: "Create Tag...",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:tags-create"));
        },
      },
      // Git Clone commands
      {
        id: "git.clone",
        label: "Clone Repository...",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:clone"));
        },
      },
      {
        id: "git.cloneRecursive",
        label: "Clone Repository (with submodules)...",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:clone-recursive"));
        },
      },
      // Git Merge commands
      {
        id: "git.merge",
        label: "Merge Branch...",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:merge"));
        },
      },
      {
        id: "git.mergeAbort",
        label: "Abort Merge",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:merge-abort"));
        },
      },
      // Git Branch Publishing commands
      {
        id: "git.publishBranch",
        label: "Publish Branch...",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:publish-branch"));
        },
      },
      {
        id: "git.setUpstream",
        label: "Set Upstream Branch...",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:set-upstream"));
        },
      },
      // Git Stash commands
      {
        id: "git.stashShowDiff",
        label: "Show Stash Diff...",
        category: "Git",
        action: () => {
          window.dispatchEvent(new CustomEvent("git:stash-show-diff"));
        },
      },
      // Terminal Auto-Reply commands
      {
        id: "terminal.autoReply.configure",
        label: "Configure Auto-Replies",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:configure-auto-replies"));
        },
      },
      {
        id: "terminal.autoReply.toggle",
        label: "Toggle Auto-Reply",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:toggle-auto-reply"));
        },
      },
      // Terminal Run commands
      {
        id: "terminal.runSelectedText",
        label: "Run Selected Text in Active Terminal",
        shortcut: "Ctrl+Shift+Enter",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:run-selection"));
        },
      },
      {
        id: "terminal.runActiveFile",
        label: "Run Active File in Terminal",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:run-active-file"));
        },
      },
      {
        id: "terminal.rename",
        label: "Rename Terminal",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:show-rename-dialog"));
        },
      },
      {
        id: "terminal.setColor",
        label: "Set Terminal Tab Color",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:show-color-picker"));
        },
      },
      {
        id: "terminal.splitTerminal",
        label: "Split Terminal",
        shortcut: "Ctrl+Shift+5",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:split"));
        },
      },
      {
        id: "terminal.focus",
        label: "Focus Terminal",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:focus"));
        },
      },
      {
        id: "terminal.scrollToBottom",
        label: "Scroll to Bottom",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:scroll-to-bottom"));
        },
      },
      {
        id: "terminal.scrollToTop",
        label: "Scroll to Top",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:scroll-to-top"));
        },
      },
      // Extension Bisect commands
      {
        id: "extension.bisect.start",
        label: "Start Extension Bisect",
        category: "Extensions",
        action: () => {
          window.dispatchEvent(new CustomEvent("extensions:bisect-start"));
        },
      },
      {
        id: "extension.bisect.stop",
        label: "Stop Extension Bisect",
        category: "Extensions",
        action: () => {
          window.dispatchEvent(new CustomEvent("extensions:bisect-stop"));
        },
      },
      // Extension Profiler commands
      {
        id: "extension.showRunningExtensions",
        label: "Show Running Extensions",
        category: "Developer",
        action: () => {
          window.dispatchEvent(new CustomEvent("extensions:show-running"));
        },
      },
      {
        id: "extension.showProfiler",
        label: "Show Extension Profiler",
        category: "Developer",
        action: () => {
          window.dispatchEvent(new CustomEvent("extensions:show-profiler"));
        },
      },
      // Bracket navigation commands
      {
        id: "editor.action.jumpToBracket",
        label: "Go to Bracket",
        shortcut: "Ctrl+Shift+\\",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "jump-to-bracket" } }));
        },
      },
      {
        id: "editor.action.selectToBracket",
        label: "Select to Bracket",
        shortcut: "Ctrl+Shift+Alt+\\",
        category: "Selection",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "select-to-bracket" } }));
        },
      },
      // File operations
      {
        id: "file.undo-operation",
        label: "Undo File Operation",
        shortcut: "Ctrl+Z",
        category: "File",
        action: () => {
          // Dispatch event to trigger undo - handled by FileOperationsContext
          window.dispatchEvent(new CustomEvent("file-operation:undo"));
        },
      },
      // Folding commands
      {
        id: "editor.foldAll",
        label: "Fold All",
        shortcut: "Ctrl+Shift+[",
        category: "Folding",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "fold-all" } }));
        },
      },
      {
        id: "editor.unfoldAll",
        label: "Unfold All",
        shortcut: "Ctrl+Shift+]",
        category: "Folding",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "unfold-all" } }));
        },
      },
      {
        id: "editor.toggleFold",
        label: "Toggle Fold",
        shortcut: "Ctrl+[",
        category: "Folding",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "toggle-fold" } }));
        },
      },
      {
        id: "editor.foldLevel1",
        label: "Fold Level 1",
        shortcut: "Ctrl+1",
        category: "Folding",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "fold-level-1" } }));
        },
      },
      {
        id: "editor.foldLevel2",
        label: "Fold Level 2",
        shortcut: "Ctrl+2",
        category: "Folding",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "fold-level-2" } }));
        },
      },
      {
        id: "editor.foldLevel3",
        label: "Fold Level 3",
        shortcut: "Ctrl+3",
        category: "Folding",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "fold-level-3" } }));
        },
      },
      {
        id: "editor.foldLevel4",
        label: "Fold Level 4",
        shortcut: "Ctrl+4",
        category: "Folding",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "fold-level-4" } }));
        },
      },
      {
        id: "editor.foldLevel5",
        label: "Fold Level 5",
        shortcut: "Ctrl+5",
        category: "Folding",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "fold-level-5" } }));
        },
      },
      {
        id: "editor.foldLevel6",
        label: "Fold Level 6",
        shortcut: "Ctrl+6",
        category: "Folding",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "fold-level-6" } }));
        },
      },
      {
        id: "editor.foldLevel7",
        label: "Fold Level 7",
        shortcut: "Ctrl+7",
        category: "Folding",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "fold-level-7" } }));
        },
      },
      {
        id: "editor.foldAllBlockComments",
        label: "Fold All Block Comments",
        category: "Folding",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "fold-all-block-comments" } }));
        },
      },
      {
        id: "editor.foldAllMarkerRegions",
        label: "Fold All Regions",
        category: "Folding",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "fold-all-regions" } }));
        },
      },
      {
        id: "editor.unfoldAllMarkerRegions",
        label: "Unfold All Regions",
        category: "Folding",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "unfold-all-regions" } }));
        },
      },
      {
        id: "editor.foldRecursively",
        label: "Fold Recursively",
        category: "Folding",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "fold-recursively" } }));
        },
      },
      {
        id: "editor.unfoldRecursively",
        label: "Unfold Recursively",
        category: "Folding",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "unfold-recursively" } }));
        },
      },
      // Bookmarks commands
      {
        id: "bookmarks.toggle",
        label: "Toggle Bookmark",
        shortcut: "Ctrl+Alt+K",
        category: "Bookmarks",
        action: () => {
          window.dispatchEvent(new CustomEvent("bookmarks:toggle"));
        },
      },
      {
        id: "bookmarks.next",
        label: "Go to Next Bookmark",
        shortcut: "Ctrl+Alt+L",
        category: "Bookmarks",
        action: () => {
          window.dispatchEvent(new CustomEvent("bookmarks:next"));
        },
      },
      {
        id: "bookmarks.prev",
        label: "Go to Previous Bookmark",
        shortcut: "Ctrl+Alt+J",
        category: "Bookmarks",
        action: () => {
          window.dispatchEvent(new CustomEvent("bookmarks:prev"));
        },
      },
      {
        id: "bookmarks.list",
        label: "List All Bookmarks",
        category: "Bookmarks",
        action: () => {
          window.dispatchEvent(new CustomEvent("bookmarks:show-panel"));
        },
      },
      {
        id: "bookmarks.clearAll",
        label: "Clear All Bookmarks",
        category: "Bookmarks",
        action: () => {
          if (confirm("Clear all bookmarks?")) {
            window.dispatchEvent(new CustomEvent("bookmarks:clear-all"));
          }
        },
      },
      // Screencast Mode commands
      {
        id: "toggle-screencast-mode",
        label: "Toggle Screencast Mode",
        shortcut: "Ctrl+Alt+K",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("screencast:toggle"));
        },
      },
      // Settings commands
      {
        id: "workbench.action.openSettings",
        label: "Open Settings",
        shortcut: "Ctrl+,",
        category: "Preferences",
        action: () => {
          window.dispatchEvent(new CustomEvent("settings:open-tab"));
        },
      },
      {
        id: "workbench.action.openSettingsJson",
        label: "Open Settings (JSON)",
        category: "Preferences",
        action: () => {
          window.dispatchEvent(new CustomEvent("settings:open-tab"));
        },
      },
{
        id: "workbench.action.openDefaultSettings",
        label: "Open Default Settings (JSON)",
        category: "Preferences",
        action: () => {
          window.dispatchEvent(new CustomEvent("settings:open-tab"));
        },
      },
      {
        id: "workbench.action.openGlobalKeybindings",
        label: "Preferences: Open Keyboard Shortcuts",
        shortcut: "Ctrl+K Ctrl+S",
        category: "Preferences",
        action: () => {
          window.dispatchEvent(new CustomEvent("keyboard-shortcuts:show"));
        },
      },
      {
        id: "workbench.action.toggleCommandCenter",
        label: "Toggle Command Center",
        category: "Preferences",
        action: () => {
          window.dispatchEvent(new CustomEvent("settings:toggle", {
            detail: { section: "theme", key: "commandCenterEnabled" }
          }));
        },
      },
      // Extensions commands
      {
        id: "workbench.extensions.showRecommendedExtensions",
        label: "Extensions: Show Recommended Extensions",
        category: "Extensions",
        action: () => {
          window.dispatchEvent(new CustomEvent("extensions:show-recommendations"));
        },
      },
      // Extension Bisect commands (Help menu)
      {
        id: "workbench.action.startExtensionBisect",
        label: "Help: Start Extension Bisect",
        category: "Help",
        action: () => {
          window.dispatchEvent(new CustomEvent("extension-bisect:open"));
        },
      },
      {
        id: "workbench.action.stopExtensionBisect",
        label: "Help: Stop Extension Bisect",
        category: "Help",
        action: () => {
          window.dispatchEvent(new CustomEvent("extension-bisect:cancel"));
        },
      },
      // Auxiliary Bar (Secondary Sidebar) commands
      {
        id: "workbench.action.toggleAuxiliaryBar",
        label: "Toggle Secondary Sidebar",
        shortcut: "Ctrl+Alt+B",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("layout:toggle-auxiliary-bar"));
        },
      },
      {
        id: "workbench.action.focusAuxiliaryBar",
        label: "Focus Secondary Sidebar",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("layout:focus-auxiliary-bar"));
        },
      },
      {
        id: "workbench.action.moveViewToSecondarySidebar",
        label: "Move View to Secondary Sidebar",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("layout:move-view-to-auxiliary"));
        },
      },
      {
        id: "workbench.action.moveViewToPrimarySidebar",
        label: "Move View to Primary Sidebar",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("layout:move-view-to-primary"));
        },
      },
      {
        id: "workbench.action.showOutlineInAuxiliaryBar",
        label: "Show Outline in Secondary Sidebar",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("layout:show-auxiliary-view", { 
            detail: { viewId: "outline" } 
          }));
        },
      },
      {
        id: "workbench.action.showTimelineInAuxiliaryBar",
        label: "Show Timeline in Secondary Sidebar",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("layout:show-auxiliary-view", { 
            detail: { viewId: "timeline" } 
          }));
        },
      },
      {
        id: "workbench.action.showChatInAuxiliaryBar",
        label: "Show Chat in Secondary Sidebar",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("layout:show-auxiliary-view", { 
            detail: { viewId: "chat" } 
          }));
        },
      },
      // =========================================================================
      // Zen Mode Commands
      // =========================================================================
      {
        id: "workbench.action.toggleZenMode",
        label: "Toggle Zen Mode",
        shortcut: "Ctrl+K Z",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("zenmode:toggle"));
        },
      },
      {
        id: "workbench.action.exitZenMode",
        label: "Exit Zen Mode",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("zenmode:exit"));
        },
      },
      // =========================================================================
      // Centered Layout Commands
      // =========================================================================
      {
        id: "workbench.action.toggleCenteredLayout",
        label: "Toggle Centered Layout",
        shortcut: "Ctrl+K Ctrl+C",
        category: "View",
        action: () => {
          window.dispatchEvent(new CustomEvent("centered-layout:toggle"));
        },
      },
      // =========================================================================
      // Debug Commands
      // =========================================================================
      {
        id: "workbench.action.debug.start",
        label: "Start Debugging",
        shortcut: "F5",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:start"));
        },
      },
      {
        id: "workbench.action.debug.run",
        label: "Run Without Debugging",
        shortcut: "Ctrl+F5",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:run-without-debugging"));
        },
      },
      {
        id: "workbench.action.debug.stop",
        label: "Stop Debugging",
        shortcut: "Shift+F5",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:stop"));
        },
      },
      {
        id: "workbench.action.debug.restart",
        label: "Restart Debugging",
        shortcut: "Ctrl+Shift+F5",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:restart"));
        },
      },
      {
        id: "workbench.action.debug.continue",
        label: "Continue",
        shortcut: "F5",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:continue"));
        },
      },
      {
        id: "workbench.action.debug.pause",
        label: "Pause",
        shortcut: "F6",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:pause"));
        },
      },
      {
        id: "workbench.action.debug.stepOver",
        label: "Step Over",
        shortcut: "F10",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:step-over"));
        },
      },
      {
        id: "workbench.action.debug.stepInto",
        label: "Step Into",
        shortcut: "F11",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:step-into"));
        },
      },
      {
        id: "workbench.action.debug.stepOut",
        label: "Step Out",
        shortcut: "Shift+F11",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:step-out"));
        },
      },
      {
        id: "editor.debug.action.toggleBreakpoint",
        label: "Toggle Breakpoint",
        shortcut: "F9",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:toggle-breakpoint"));
        },
      },
      {
        id: "editor.debug.action.conditionalBreakpoint",
        label: "Add Conditional Breakpoint...",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:add-conditional-breakpoint"));
        },
      },
      {
        id: "editor.debug.action.addLogpoint",
        label: "Add Logpoint...",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:add-logpoint"));
        },
      },
      {
        id: "workbench.debug.action.addFunctionBreakpoint",
        label: "Add Function Breakpoint...",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:add-function-breakpoint"));
        },
      },
      {
        id: "workbench.debug.action.addDataBreakpoint",
        label: "Add Data Breakpoint...",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:add-data-breakpoint"));
        },
      },
      {
        id: "workbench.debug.action.enableAllBreakpoints",
        label: "Enable All Breakpoints",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:enable-all-breakpoints"));
        },
      },
      {
        id: "workbench.debug.action.disableAllBreakpoints",
        label: "Disable All Breakpoints",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:disable-all-breakpoints"));
        },
      },
      {
        id: "workbench.debug.action.removeAllBreakpoints",
        label: "Remove All Breakpoints",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:remove-all-breakpoints"));
        },
      },
      {
        id: "workbench.action.debug.configure",
        label: "Add Configuration...",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:add-configuration"));
        },
      },
      {
        id: "workbench.action.debug.openLaunchJson",
        label: "Open launch.json",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:open-launch-json"));
        },
      },
      {
        id: "workbench.debug.action.focusCallStack",
        label: "Focus Call Stack",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:focus-callstack"));
        },
      },
      {
        id: "workbench.debug.action.focusVariables",
        label: "Focus Variables",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:focus-variables"));
        },
      },
      {
        id: "workbench.debug.action.focusWatch",
        label: "Focus Watch",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:focus-watch"));
        },
      },
      {
        id: "workbench.debug.action.focusBreakpoints",
        label: "Focus Breakpoints",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:focus-breakpoints"));
        },
      },
      {
        id: "workbench.debug.action.toggleRepl",
        label: "Toggle Debug Console",
        shortcut: "Ctrl+Shift+Y",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:toggle-console"));
        },
      },
      {
        id: "workbench.debug.action.selectAndStart",
        label: "Select and Start Debugging",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:select-and-start"));
        },
      },
      {
        id: "editor.debug.action.runToCursor",
        label: "Run to Cursor",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:run-to-cursor"));
        },
      },
      {
        id: "editor.debug.action.showDebugHover",
        label: "Show Debug Hover",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:show-hover"));
        },
      },
      {
        id: "workbench.debug.action.showDisassemblyView",
        label: "Open Disassembly View",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:show-disassembly"));
        },
      },
      {
        id: "workbench.debug.action.showMemoryView",
        label: "Open Memory View",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:show-memory"));
        },
      },
      // =========================================================================
      // Transpose Commands
      // =========================================================================
      {
        id: "transpose-characters",
        label: "Transpose Characters",
        shortcut: "Ctrl+T",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "transpose-characters" } }));
        },
      },
      // =========================================================================
      // In-Place Replace Commands
      // =========================================================================
      {
        id: "in-place-replace-up",
        label: "Replace with Previous Value",
        shortcut: "Ctrl+Shift+,",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "in-place-replace-up" } }));
        },
      },
      {
        id: "in-place-replace-down",
        label: "Replace with Next Value",
        shortcut: "Ctrl+Shift+.",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "in-place-replace-down" } }));
        },
      },
      // =========================================================================
      // Delete Word Part Commands
      // =========================================================================
      {
        id: "delete-word-part-left",
        label: "Delete Word Part Left",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "delete-word-part-left" } }));
        },
      },
      {
        id: "delete-word-part-right",
        label: "Delete Word Part Right",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "delete-word-part-right" } }));
        },
      },
      // =========================================================================
      // Linked Editing Commands
      // =========================================================================
      {
        id: "toggle-linked-editing",
        label: "Toggle Linked Editing",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "toggle-linked-editing" } }));
        },
      },
      // =========================================================================
      // Hover and Suggestions Commands
      // =========================================================================
      {
        id: "show-hover",
        label: "Show Hover",
        shortcut: "Ctrl+K Ctrl+I",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "show-hover" } }));
        },
      },
      {
        id: "trigger-suggest",
        label: "Trigger Suggest",
        shortcut: "Ctrl+Space",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "trigger-suggest" } }));
        },
      },
      {
        id: "trigger-parameter-hints",
        label: "Trigger Parameter Hints",
        shortcut: "Ctrl+Shift+Space",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "trigger-parameter-hints" } }));
        },
      },
      // =========================================================================
      // Smart Select Commands
      // =========================================================================
      {
        id: "smart-select-expand",
        label: "Expand Selection (Smart)",
        shortcut: "Shift+Alt+Right",
        category: "Selection",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "smart-select-expand" } }));
        },
      },
      {
        id: "smart-select-shrink",
        label: "Shrink Selection (Smart)",
        shortcut: "Shift+Alt+Left",
        category: "Selection",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "smart-select-shrink" } }));
        },
      },
      // =========================================================================
      // Quick Fix and Refactoring Commands
      // =========================================================================
      {
        id: "quick-fix",
        label: "Quick Fix",
        shortcut: "Ctrl+.",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "quick-fix" } }));
        },
      },
      {
        id: "refactor",
        label: "Refactor",
        shortcut: "Ctrl+Shift+R",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "refactor" } }));
        },
      },
      {
        id: "source-action",
        label: "Source Action",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "source-action" } }));
        },
      },
      // =========================================================================
      // Symbol Commands
      // =========================================================================
      {
        id: "rename-symbol",
        label: "Rename Symbol",
        shortcut: "F2",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "rename-symbol" } }));
        },
      },
      {
        id: "go-to-type-definition",
        label: "Go to Type Definition",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "go-to-type-definition" } }));
        },
      },
      {
        id: "find-all-references",
        label: "Find All References",
        shortcut: "Alt+F12",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "find-all-references" } }));
        },
      },
      // =========================================================================
      // Hierarchy Commands
      // =========================================================================
      {
        id: "show-call-hierarchy",
        label: "Show Call Hierarchy",
        shortcut: "Shift+Alt+H",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "show-call-hierarchy" } }));
        },
      },
      {
        id: "show-type-hierarchy",
        label: "Show Type Hierarchy",
        category: "Navigation",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "show-type-hierarchy" } }));
        },
      },
      // =========================================================================
      // Import Management Commands
      // =========================================================================
      {
        id: "organize-imports",
        label: "Organize Imports",
        shortcut: "Shift+Alt+O",
        category: "Source",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "organize-imports" } }));
        },
      },
      {
        id: "sort-imports",
        label: "Sort Imports",
        category: "Source",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "sort-imports" } }));
        },
      },
      {
        id: "remove-unused-imports",
        label: "Remove Unused Imports",
        category: "Source",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "remove-unused-imports" } }));
        },
      },
      {
        id: "add-missing-imports",
        label: "Add Missing Imports",
        category: "Source",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "add-missing-imports" } }));
        },
      },
      // =========================================================================
      // Column Selection Mode
      // =========================================================================
      {
        id: "toggle-column-selection",
        label: "Toggle Column Selection Mode",
        shortcut: "Ctrl+Shift+C",
        category: "Selection",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "toggle-column-selection" } }));
        },
      },
      // =========================================================================
      // Testing Commands
      // =========================================================================
      {
        id: "testing.runAll",
        label: "Run All Tests",
        shortcut: "Ctrl+; A",
        category: "Testing",
        action: () => {
          window.dispatchEvent(new CustomEvent("testing:run-all"));
        },
      },
      {
        id: "testing.runFile",
        label: "Run Tests in Current File",
        shortcut: "Ctrl+; F",
        category: "Testing",
        action: () => {
          window.dispatchEvent(new CustomEvent("testing:run-file"));
        },
      },
      {
        id: "testing.runAtCursor",
        label: "Run Test at Cursor",
        shortcut: "Ctrl+; C",
        category: "Testing",
        action: () => {
          window.dispatchEvent(new CustomEvent("testing:run-at-cursor"));
        },
      },
      {
        id: "testing.debugAtCursor",
        label: "Debug Test at Cursor",
        shortcut: "Ctrl+; D",
        category: "Testing",
        action: () => {
          window.dispatchEvent(new CustomEvent("testing:debug-at-cursor"));
        },
      },
      {
        id: "testing.rerunFailed",
        label: "Re-run Failed Tests",
        shortcut: "Ctrl+; E",
        category: "Testing",
        action: () => {
          window.dispatchEvent(new CustomEvent("testing:run-failed"));
        },
      },
      {
        id: "testing.toggleWatchMode",
        label: "Toggle Test Watch Mode",
        shortcut: "Ctrl+; W",
        category: "Testing",
        action: () => {
          window.dispatchEvent(new CustomEvent("testing:toggle-watch"));
        },
      },
      {
        id: "testing.runWithCoverage",
        label: "Run Tests with Coverage",
        shortcut: "Ctrl+; Shift+C",
        category: "Testing",
        action: () => {
          window.dispatchEvent(new CustomEvent("testing:run-coverage"));
        },
      },
      {
        id: "testing.showCoverage",
        label: "Show Code Coverage",
        category: "Testing",
        action: () => {
          window.dispatchEvent(new CustomEvent("testing:show-coverage"));
        },
      },
      {
        id: "testing.hideCoverage",
        label: "Hide Code Coverage",
        category: "Testing",
        action: () => {
          window.dispatchEvent(new CustomEvent("testing:hide-coverage"));
        },
      },
      {
        id: "testing.toggleCoverage",
        label: "Toggle Code Coverage Overlay",
        shortcut: "Ctrl+; V",
        category: "Testing",
        action: () => {
          window.dispatchEvent(new CustomEvent("testing:toggle-coverage"));
        },
      },
      {
        id: "testing.goToTest",
        label: "Go to Test",
        shortcut: "Ctrl+; G",
        category: "Testing",
        action: () => {
          window.dispatchEvent(new CustomEvent("testing:go-to-test"));
        },
      },
      {
        id: "testing.cancel",
        label: "Cancel Running Tests",
        shortcut: "Ctrl+; X",
        category: "Testing",
        action: () => {
          window.dispatchEvent(new CustomEvent("testing:stop"));
        },
      },
      {
        id: "testing.refreshTests",
        label: "Refresh Test Explorer",
        shortcut: "Ctrl+; R",
        category: "Testing",
        action: () => {
          window.dispatchEvent(new CustomEvent("testing:refresh"));
        },
      },
      {
        id: "testing.focusExplorer",
        label: "Focus Test Explorer",
        shortcut: "Ctrl+Shift+; T",
        category: "Testing",
        action: () => {
          window.dispatchEvent(new CustomEvent("testing:focus-explorer"));
        },
      },
      {
        id: "testing.showOutput",
        label: "Show Test Output",
        category: "Testing",
        action: () => {
          window.dispatchEvent(new CustomEvent("testing:show-output"));
        },
      },
      {
        id: "testing.clearResults",
        label: "Clear Test Results",
        category: "Testing",
        action: () => {
          window.dispatchEvent(new CustomEvent("testing:clear-results"));
        },
      },
      // =========================================================================
      // VS Code Standard Command Aliases
      // =========================================================================
      // Find and Replace aliases (VS Code standard IDs)
      {
        id: "editor.action.find",
        label: "Find",
        shortcut: "Ctrl+F",
        category: "Search",
        action: () => setShowBufferSearch(true),
      },
      {
        id: "editor.action.replace",
        label: "Replace",
        shortcut: "Ctrl+H",
        category: "Search",
        action: () => {
          window.dispatchEvent(new CustomEvent("buffer-search:show-replace"));
          setShowBufferSearch(true);
        },
      },
      {
        id: "editor.action.selectAllOccurrences",
        label: "Select All Occurrences of Find Match",
        shortcut: "Ctrl+Shift+L",
        category: "Selection",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "select-all-occurrences" } }));
        },
      },
      {
        id: "editor.action.addSelectionToNextFindMatch",
        label: "Add Selection To Next Find Match",
        shortcut: "Ctrl+D",
        category: "Selection",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "add-selection-to-next-find-match" } }));
        },
      },
      {
        id: "editor.action.rename",
        label: "Rename Symbol",
        shortcut: "F2",
        category: "Refactor",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "rename-symbol" } }));
        },
      },
      {
        id: "editor.action.triggerParameterHints",
        label: "Trigger Parameter Hints",
        shortcut: "Ctrl+Shift+Space",
        category: "Edit",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "trigger-parameter-hints" } }));
        },
      },
      {
        id: "editor.action.quickFix",
        label: "Quick Fix...",
        shortcut: "Ctrl+.",
        category: "Refactor",
        action: () => {
          window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "quick-fix" } }));
        },
      },
      // Keybindings command
      {
        id: "workbench.action.openKeybindings",
        label: "Open Keyboard Shortcuts",
        shortcut: "Ctrl+K Ctrl+S",
        category: "Preferences",
        action: () => {
          window.dispatchEvent(new CustomEvent("keyboard-shortcuts:show"));
        },
      },
      {
        id: "workbench.action.openKeybindingsJson",
        label: "Open Keyboard Shortcuts (JSON)",
        category: "Preferences",
        action: () => {
          window.dispatchEvent(new CustomEvent("keybindings:open", {
            detail: { jsonView: true }
          }));
        },
      },
      // Debug breakpoint commands (VS Code standard IDs)
      {
        id: "debug.addBreakpoint",
        label: "Add Breakpoint",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:add-breakpoint"));
        },
      },
      {
        id: "debug.toggleBreakpoint",
        label: "Toggle Breakpoint",
        shortcut: "F9",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:toggle-breakpoint"));
        },
      },
      {
        id: "debug.removeBreakpoint",
        label: "Remove Breakpoint",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:remove-breakpoint"));
        },
      },
      {
        id: "debug.editBreakpoint",
        label: "Edit Breakpoint...",
        category: "Debug",
        action: () => {
          window.dispatchEvent(new CustomEvent("debug:edit-breakpoint"));
        },
      },
      // Terminal recent command
      {
        id: "terminal.runRecentCommand",
        label: "Run Recent Command...",
        shortcut: "Ctrl+Alt+R",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:run-recent-command"));
        },
      },
      {
        id: "terminal.showCommandHistory",
        label: "Show Command History",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:show-command-history"));
        },
      },
      // Search editor alias (VS Code standard ID)
      {
        id: "search.action.openSearchEditor",
        label: "Open Search Editor",
        shortcut: "Ctrl+Shift+J",
        category: "Search",
        action: () => {
          window.dispatchEvent(new CustomEvent("search:open-editor"));
        },
      },
      {
        id: "search.action.openNewEditor",
        label: "Open New Search Editor",
        category: "Search",
        action: () => {
          window.dispatchEvent(new CustomEvent("search:open-new-editor"));
        },
      },
      {
        id: "search.action.openNewEditorToSide",
        label: "Open New Search Editor to the Side",
        category: "Search",
        action: () => {
          window.dispatchEvent(new CustomEvent("search:open-editor-to-side"));
        },
      },
    ];

    defaultCommands.forEach(registerCommand);

    // Load extension commands
    loadExtensionCommands();
  });

  // Set up event listeners for extension command changes
  // Store unlisten functions at component scope for proper cleanup
  let unlistenRegister: UnlistenFn | null = null;
  let unlistenUnregister: UnlistenFn | null = null;
  let unlistenClear: UnlistenFn | null = null;
  let isCleanedUp = false;

  // Register cleanup synchronously before async setup
  onCleanup(() => {
    isCleanedUp = true;
    unlistenRegister?.();
    unlistenUnregister?.();
    unlistenClear?.();
    unlistenRegister = null;
    unlistenUnregister = null;
    unlistenClear = null;
  });

  onMount(() => {
    const setupListeners = async () => {
      // Check if already cleaned up before setting up listeners
      if (isCleanedUp) return;

      // Listen for command registration
      const registerUnlisten = await listen<{
        id: string;
        title: string | null;
        category: string | null;
      }>("vscode:command-registered", (event) => {
        const cmd = event.payload;
        if (cmd.title) {
          const command: Command = {
            id: cmd.id,
            label: cmd.title,
            category: cmd.category || "Extension",
            isExtension: true,
            action: async () => {
              try {
                await invoke("vscode_execute_builtin_command", { command: cmd.id, args: [] });
              } catch (err) {
                console.debug("[Command] Builtin failed:", err);
                await invoke("vscode_execute_command", { command: cmd.id, args: [] });
              }
            },
          };
          registerCommand(command);
        }
      });

      // Check again after each await in case cleanup ran during await
      if (isCleanedUp) {
        registerUnlisten();
        return;
      }
      unlistenRegister = registerUnlisten;

      // Listen for command unregistration
      const unregisterUnlisten = await listen<string>("vscode:command-unregistered", (event) => {
        unregisterCommand(event.payload);
      });

      if (isCleanedUp) {
        unregisterUnlisten();
        return;
      }
      unlistenUnregister = unregisterUnlisten;

      // Listen for extension commands cleared
      const clearUnlisten = await listen<string>("vscode:extension-commands-cleared", () => {
        // Remove all extension commands and reload
        setCommands(prev => prev.filter(c => !c.isExtension));
        loadExtensionCommands();
      });

      if (isCleanedUp) {
        clearUnlisten();
        return;
      }
      unlistenClear = clearUnlisten;
    };

    setupListeners();
  });

  const value: CommandContextValue = {
    commands,
    registerCommand,
    unregisterCommand,
    executeCommand,
    showCommandPalette,
    setShowCommandPalette,
    showFileFinder,
    setShowFileFinder,
    showBufferSearch,
    setShowBufferSearch,
    showGoToLine,
    setShowGoToLine,
    showProjectSearch,
    setShowProjectSearch,
    showProjectSymbols,
    setShowProjectSymbols,
    showWorkspaceSymbolPicker,
    setShowWorkspaceSymbolPicker,
    showDocumentSymbolPicker,
    setShowDocumentSymbolPicker,
    showViewQuickAccess,
    setShowViewQuickAccess,
    showEmmetWrapDialog,
    setShowEmmetWrapDialog,
  };

  return (
    <CommandContext.Provider value={value}>
      {props.children}
    </CommandContext.Provider>
  );
}

export function useCommands() {
  const context = useContext(CommandContext);
  if (!context) {
    throw new Error("useCommands must be used within a CommandProvider");
  }
  return context;
}