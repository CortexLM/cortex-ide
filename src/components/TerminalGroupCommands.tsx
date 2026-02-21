import { onMount, onCleanup } from "solid-js";
import { useCommands, Command } from "@/context/CommandContext";
import { useTerminals } from "@/context/TerminalsContext";

/**
 * TerminalGroupCommands - Registers terminal group commands with the command palette
 *
 * Commands:
 * - terminal.splitTerminal - Split terminal horizontally
 * - terminal.splitTerminalVertical - Split terminal vertically
 * - terminal.newTerminalInGroup - Create new terminal in current group
 * - terminal.moveTerminalToNewGroup - Move terminal to new group
 * - terminal.moveTerminalToGroup - Move terminal to existing group
 * - terminal.createGroup - Create new terminal group
 * - terminal.deleteGroup - Delete current group
 * - terminal.renameGroup - Rename current group
 * - terminal.focusNextTerminalInGroup - Focus next terminal in group
 * - terminal.focusPreviousTerminalInGroup - Focus previous terminal in group
 */

export function TerminalGroupCommands() {
  const { registerCommand, unregisterCommand } = useCommands();
  const {
    state,
    createTerminal,
    setActiveTerminal,
    setActiveGroup,
    createGroup,
    deleteGroup,
    addToGroup,
    removeFromGroup,
    splitTerminalInGroup,
    getGroupForTerminal,
    moveToGroup,
  } = useTerminals();

  onMount(() => {
    const commands: Command[] = [
      // Split Terminal Commands
      {
        id: "terminal.splitTerminal",
        label: "Terminal: Split Terminal",
        shortcut: "Ctrl+Shift+5",
        category: "Terminal",
        action: async () => {
          const terminalId = state.activeTerminalId;
          if (terminalId) {
            await splitTerminalInGroup(terminalId, "horizontal");
          }
        },
      },
      {
        id: "terminal.splitTerminalVertical",
        label: "Terminal: Split Terminal Down",
        shortcut: "Ctrl+Shift+4",
        category: "Terminal",
        action: async () => {
          const terminalId = state.activeTerminalId;
          if (terminalId) {
            await splitTerminalInGroup(terminalId, "vertical");
          }
        },
      },

      // New Terminal Commands
      {
        id: "terminal.newTerminalInGroup",
        label: "Terminal: New Terminal in Group",
        category: "Terminal",
        action: async () => {
          const groupId = state.activeGroupId;
          if (groupId) {
            const terminal = await createTerminal();
            addToGroup(terminal.id, groupId);
            setActiveTerminal(terminal.id);
          } else {
            // No active group - create terminal and new group
            const group = createGroup();
            const terminal = await createTerminal();
            addToGroup(terminal.id, group.id);
            setActiveGroup(group.id);
            setActiveTerminal(terminal.id);
          }
        },
      },

      // Move Terminal Commands
      {
        id: "terminal.moveTerminalToNewGroup",
        label: "Terminal: Move Terminal to New Group",
        category: "Terminal",
        action: () => {
          const terminalId = state.activeTerminalId;
          if (terminalId) {
            moveToGroup({ terminalId, targetGroupId: null });
          }
        },
      },
      {
        id: "terminal.ungroupTerminal",
        label: "Terminal: Ungroup Terminal",
        category: "Terminal",
        action: () => {
          const terminalId = state.activeTerminalId;
          if (terminalId) {
            const group = getGroupForTerminal(terminalId);
            if (group) {
              removeFromGroup(terminalId);
            }
          }
        },
      },

      // Group Management Commands
      {
        id: "terminal.createGroup",
        label: "Terminal: Create Terminal Group",
        category: "Terminal",
        action: async () => {
          const group = createGroup();
          const terminal = await createTerminal();
          addToGroup(terminal.id, group.id);
          setActiveGroup(group.id);
          setActiveTerminal(terminal.id);
        },
      },
      {
        id: "terminal.deleteGroup",
        label: "Terminal: Delete Current Group",
        category: "Terminal",
        action: () => {
          const groupId = state.activeGroupId;
          if (groupId) {
            deleteGroup(groupId);
          }
        },
      },

      // Focus Navigation Commands
      {
        id: "terminal.focusNextTerminalInGroup",
        label: "Terminal: Focus Next Terminal in Group",
        shortcut: "Alt+Right",
        category: "Terminal",
        action: () => {
          const terminalId = state.activeTerminalId;
          if (!terminalId) return;

          const group = getGroupForTerminal(terminalId);
          if (!group) return;

          const currentIndex = group.terminalIds.indexOf(terminalId);
          const nextIndex = (currentIndex + 1) % group.terminalIds.length;
          setActiveTerminal(group.terminalIds[nextIndex]);
        },
      },
      {
        id: "terminal.focusPreviousTerminalInGroup",
        label: "Terminal: Focus Previous Terminal in Group",
        shortcut: "Alt+Left",
        category: "Terminal",
        action: () => {
          const terminalId = state.activeTerminalId;
          if (!terminalId) return;

          const group = getGroupForTerminal(terminalId);
          if (!group) return;

          const currentIndex = group.terminalIds.indexOf(terminalId);
          const prevIndex =
            currentIndex === 0 ? group.terminalIds.length - 1 : currentIndex - 1;
          setActiveTerminal(group.terminalIds[prevIndex]);
        },
      },

      // Focus Group Commands
      {
        id: "terminal.focusNextGroup",
        label: "Terminal: Focus Next Group",
        shortcut: "Ctrl+PageDown",
        category: "Terminal",
        action: () => {
          const currentGroupId = state.activeGroupId;
          const groups = state.groups;
          
          if (groups.length === 0) return;

          let nextIndex = 0;
          if (currentGroupId) {
            const currentIndex = groups.findIndex((g) => g.id === currentGroupId);
            nextIndex = (currentIndex + 1) % groups.length;
          }

          const nextGroup = groups[nextIndex];
          if (nextGroup) {
            setActiveGroup(nextGroup.id);
            if (nextGroup.terminalIds.length > 0) {
              setActiveTerminal(nextGroup.terminalIds[0]);
            }
          }
        },
      },
      {
        id: "terminal.focusPreviousGroup",
        label: "Terminal: Focus Previous Group",
        shortcut: "Ctrl+PageUp",
        category: "Terminal",
        action: () => {
          const currentGroupId = state.activeGroupId;
          const groups = state.groups;
          
          if (groups.length === 0) return;

          let prevIndex = groups.length - 1;
          if (currentGroupId) {
            const currentIndex = groups.findIndex((g) => g.id === currentGroupId);
            prevIndex = currentIndex === 0 ? groups.length - 1 : currentIndex - 1;
          }

          const prevGroup = groups[prevIndex];
          if (prevGroup) {
            setActiveGroup(prevGroup.id);
            if (prevGroup.terminalIds.length > 0) {
              setActiveTerminal(prevGroup.terminalIds[0]);
            }
          }
        },
      },

      // Maximize/Restore Split
      {
        id: "terminal.maximizeTerminal",
        label: "Terminal: Maximize Terminal Panel",
        category: "Terminal",
        action: () => {
          // Dispatch event for TerminalPanel to handle
          window.dispatchEvent(new CustomEvent("terminal:maximize"));
        },
      },
      {
        id: "terminal.toggleMaximizeTerminal",
        label: "Terminal: Toggle Maximize Terminal",
        shortcut: "Ctrl+Shift+M",
        category: "Terminal",
        action: () => {
          window.dispatchEvent(new CustomEvent("terminal:toggle-maximize"));
        },
      },
    ];

    // Register all commands
    commands.forEach((cmd) => registerCommand(cmd));

    // Register keyboard shortcuts via window event
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+Left/Right for navigating within group
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          commands.find((c) => c.id === "terminal.focusPreviousTerminalInGroup")?.action();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          commands.find((c) => c.id === "terminal.focusNextTerminalInGroup")?.action();
        }
      }
      
      // Ctrl+PageUp/PageDown for navigating groups
      if (e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (e.key === "PageUp") {
          e.preventDefault();
          commands.find((c) => c.id === "terminal.focusPreviousGroup")?.action();
        } else if (e.key === "PageDown") {
          e.preventDefault();
          commands.find((c) => c.id === "terminal.focusNextGroup")?.action();
        }
      }

      // Ctrl+Shift+5 for split horizontal
      if (e.ctrlKey && e.shiftKey && e.key === "5") {
        e.preventDefault();
        commands.find((c) => c.id === "terminal.splitTerminal")?.action();
      }

      // Ctrl+Shift+4 for split vertical
      if (e.ctrlKey && e.shiftKey && e.key === "4") {
        e.preventDefault();
        commands.find((c) => c.id === "terminal.splitTerminalVertical")?.action();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      commands.forEach((cmd) => unregisterCommand(cmd.id));
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  return null;
}

export default TerminalGroupCommands;
