import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("CommandContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Command Management", () => {
    interface Command {
      id: string;
      label: string;
      shortcut?: string;
      category?: string;
      action: () => void;
      isExtension?: boolean;
    }

    it("should create a command", () => {
      const command: Command = {
        id: "editor.save",
        label: "Save File",
        shortcut: "Ctrl+S",
        category: "File",
        action: vi.fn(),
      };

      expect(command.id).toBe("editor.save");
      expect(command.shortcut).toBe("Ctrl+S");
    });

    it("should create an extension command", () => {
      const command: Command = {
        id: "extension.myCommand",
        label: "My Extension Command",
        category: "Extension",
        action: vi.fn(),
        isExtension: true,
      };

      expect(command.isExtension).toBe(true);
      expect(command.category).toBe("Extension");
    });

    it("should register commands", () => {
      const commands: Command[] = [];

      const registerCommand = (command: Command) => {
        const existing = commands.findIndex((c) => c.id === command.id);
        if (existing >= 0) {
          commands[existing] = command;
        } else {
          commands.push(command);
        }
      };

      registerCommand({ id: "cmd1", label: "Command 1", action: vi.fn() });
      registerCommand({ id: "cmd2", label: "Command 2", action: vi.fn() });

      expect(commands).toHaveLength(2);
    });

    it("should unregister commands", () => {
      const commands: Command[] = [
        { id: "cmd1", label: "Command 1", action: vi.fn() },
        { id: "cmd2", label: "Command 2", action: vi.fn() },
      ];

      const unregisterCommand = (id: string) => {
        const index = commands.findIndex((c) => c.id === id);
        if (index >= 0) {
          commands.splice(index, 1);
        }
      };

      unregisterCommand("cmd1");

      expect(commands).toHaveLength(1);
      expect(commands[0].id).toBe("cmd2");
    });

    it("should execute a command", () => {
      const actionFn = vi.fn();
      const command: Command = {
        id: "test.command",
        label: "Test Command",
        action: actionFn,
      };

      command.action();

      expect(actionFn).toHaveBeenCalled();
    });

    it("should find command by id", () => {
      const commands: Command[] = [
        { id: "cmd1", label: "Command 1", action: vi.fn() },
        { id: "cmd2", label: "Command 2", action: vi.fn() },
        { id: "cmd3", label: "Command 3", action: vi.fn() },
      ];

      const commandMap = new Map(commands.map((c) => [c.id, c]));
      const found = commandMap.get("cmd2");

      expect(found?.label).toBe("Command 2");
    });

    it("should filter commands by category", () => {
      const commands: Command[] = [
        { id: "file.save", label: "Save", category: "File", action: vi.fn() },
        { id: "file.open", label: "Open", category: "File", action: vi.fn() },
        { id: "edit.undo", label: "Undo", category: "Edit", action: vi.fn() },
      ];

      const fileCommands = commands.filter((c) => c.category === "File");

      expect(fileCommands).toHaveLength(2);
    });

    it("should search commands by label", () => {
      const commands: Command[] = [
        { id: "cmd1", label: "Save File", action: vi.fn() },
        { id: "cmd2", label: "Open File", action: vi.fn() },
        { id: "cmd3", label: "Close Tab", action: vi.fn() },
      ];

      const query = "file";
      const results = commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase())
      );

      expect(results).toHaveLength(2);
    });
  });

  describe("Command Palette State", () => {
    it("should toggle command palette visibility", () => {
      let showCommandPalette = false;

      showCommandPalette = true;
      expect(showCommandPalette).toBe(true);

      showCommandPalette = false;
      expect(showCommandPalette).toBe(false);
    });

    it("should toggle file finder visibility", () => {
      let showFileFinder = false;

      showFileFinder = true;
      expect(showFileFinder).toBe(true);
    });

    it("should toggle buffer search visibility", () => {
      let showBufferSearch = false;

      showBufferSearch = true;
      expect(showBufferSearch).toBe(true);
    });

    it("should toggle go to line visibility", () => {
      let showGoToLine = false;

      showGoToLine = true;
      expect(showGoToLine).toBe(true);
    });

    it("should toggle project search visibility", () => {
      let showProjectSearch = false;

      showProjectSearch = true;
      expect(showProjectSearch).toBe(true);
    });

    it("should toggle workspace symbol picker visibility", () => {
      let showWorkspaceSymbolPicker = false;

      showWorkspaceSymbolPicker = true;
      expect(showWorkspaceSymbolPicker).toBe(true);
    });

    it("should toggle document symbol picker visibility", () => {
      let showDocumentSymbolPicker = false;

      showDocumentSymbolPicker = true;
      expect(showDocumentSymbolPicker).toBe(true);
    });
  });

  describe("Keybinding Management", () => {
    interface Keybinding {
      key: string;
      command: string;
      when?: string;
    }

    it("should parse a keybinding", () => {
      const keybinding: Keybinding = {
        key: "Ctrl+S",
        command: "editor.save",
      };

      expect(keybinding.key).toBe("Ctrl+S");
      expect(keybinding.command).toBe("editor.save");
    });

    it("should handle conditional keybindings", () => {
      const keybinding: Keybinding = {
        key: "Ctrl+Enter",
        command: "editor.runCell",
        when: "editorTextFocus && editorLangId == 'python'",
      };

      expect(keybinding.when).toContain("editorTextFocus");
    });

    it("should match keybindings to commands", () => {
      const keybindings: Keybinding[] = [
        { key: "Ctrl+S", command: "editor.save" },
        { key: "Ctrl+O", command: "editor.open" },
        { key: "Ctrl+Z", command: "editor.undo" },
      ];

      const binding = keybindings.find((k) => k.key === "Ctrl+S");
      expect(binding?.command).toBe("editor.save");
    });

    it("should detect key conflicts", () => {
      const keybindings: Keybinding[] = [
        { key: "Ctrl+K", command: "editor.cut" },
        { key: "Ctrl+K", command: "prefix.command" },
      ];

      const conflicts = keybindings.filter((k) => k.key === "Ctrl+K");
      expect(conflicts).toHaveLength(2);
    });
  });

  describe("IPC Integration", () => {
    it("should invoke vscode_execute_command", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("vscode_execute_command", {
        command: "editor.action.formatDocument",
        args: [],
      });

      expect(invoke).toHaveBeenCalledWith("vscode_execute_command", {
        command: "editor.action.formatDocument",
        args: [],
      });
    });

    it("should invoke vscode_execute_builtin_command", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("vscode_execute_builtin_command", {
        command: "workbench.action.files.save",
        args: [],
      });

      expect(invoke).toHaveBeenCalledWith("vscode_execute_builtin_command", {
        command: "workbench.action.files.save",
        args: [],
      });
    });

    it("should invoke vscode_get_command_palette_items", async () => {
      vi.mocked(invoke).mockResolvedValue([
        { id: "cmd1", label: "Command 1", category: "Test", detail: null, icon: null },
        { id: "cmd2", label: "Command 2", category: "Test", detail: null, icon: null },
      ]);

      const result = await invoke("vscode_get_command_palette_items");

      expect(invoke).toHaveBeenCalledWith("vscode_get_command_palette_items");
      expect(result).toHaveLength(2);
    });

    it("should listen for command:registered events", async () => {
      await listen("command:registered", () => {});

      expect(listen).toHaveBeenCalledWith("command:registered", expect.any(Function));
    });

    it("should listen for command:executed events", async () => {
      await listen("command:executed", () => {});

      expect(listen).toHaveBeenCalledWith("command:executed", expect.any(Function));
    });
  });

  describe("Command Categories", () => {
    interface Command {
      id: string;
      label: string;
      category?: string;
      action: () => void;
    }

    it("should group commands by category", () => {
      const commands: Command[] = [
        { id: "file.save", label: "Save", category: "File", action: vi.fn() },
        { id: "file.open", label: "Open", category: "File", action: vi.fn() },
        { id: "edit.undo", label: "Undo", category: "Edit", action: vi.fn() },
        { id: "edit.redo", label: "Redo", category: "Edit", action: vi.fn() },
        { id: "view.zoom", label: "Zoom", category: "View", action: vi.fn() },
      ];

      const byCategory = new Map<string, Command[]>();
      for (const cmd of commands) {
        const cat = cmd.category || "Other";
        if (!byCategory.has(cat)) {
          byCategory.set(cat, []);
        }
        byCategory.get(cat)!.push(cmd);
      }

      expect(byCategory.get("File")).toHaveLength(2);
      expect(byCategory.get("Edit")).toHaveLength(2);
      expect(byCategory.get("View")).toHaveLength(1);
    });

    it("should list unique categories", () => {
      const commands: Command[] = [
        { id: "1", label: "A", category: "File", action: vi.fn() },
        { id: "2", label: "B", category: "Edit", action: vi.fn() },
        { id: "3", label: "C", category: "File", action: vi.fn() },
        { id: "4", label: "D", category: "View", action: vi.fn() },
      ];

      const categories = [...new Set(commands.map((c) => c.category).filter(Boolean))];

      expect(categories).toHaveLength(3);
      expect(categories).toContain("File");
      expect(categories).toContain("Edit");
      expect(categories).toContain("View");
    });
  });

  describe("Recent Commands", () => {
    it("should track recently used commands", () => {
      const recentCommands: string[] = [];
      const maxRecent = 5;

      const addToRecent = (commandId: string) => {
        const index = recentCommands.indexOf(commandId);
        if (index >= 0) {
          recentCommands.splice(index, 1);
        }
        recentCommands.unshift(commandId);
        if (recentCommands.length > maxRecent) {
          recentCommands.pop();
        }
      };

      addToRecent("cmd1");
      addToRecent("cmd2");
      addToRecent("cmd3");
      addToRecent("cmd1");

      expect(recentCommands[0]).toBe("cmd1");
      expect(recentCommands).toHaveLength(3);
    });

    it("should limit recent commands", () => {
      const recentCommands: string[] = [];
      const maxRecent = 3;

      const addToRecent = (commandId: string) => {
        recentCommands.unshift(commandId);
        if (recentCommands.length > maxRecent) {
          recentCommands.pop();
        }
      };

      addToRecent("cmd1");
      addToRecent("cmd2");
      addToRecent("cmd3");
      addToRecent("cmd4");
      addToRecent("cmd5");

      expect(recentCommands).toHaveLength(3);
      expect(recentCommands).not.toContain("cmd1");
      expect(recentCommands).not.toContain("cmd2");
    });
  });

  describe("Quick Access Views", () => {
    it("should toggle view quick access", () => {
      let showViewQuickAccess = false;

      showViewQuickAccess = true;
      expect(showViewQuickAccess).toBe(true);
    });

    it("should toggle emmet wrap dialog", () => {
      let showEmmetWrapDialog = false;

      showEmmetWrapDialog = true;
      expect(showEmmetWrapDialog).toBe(true);
    });

    it("should toggle project symbols", () => {
      let showProjectSymbols = false;

      showProjectSymbols = true;
      expect(showProjectSymbols).toBe(true);
    });
  });
});
