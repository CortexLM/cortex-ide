import { onMount, onCleanup } from "solid-js";
import { useDebug } from "@/context/DebugContext";

/**
 * Debug keyboard shortcuts:
 * - F5: Start debugging / Continue
 * - Shift+F5: Stop debugging
 * - Ctrl+Shift+F5: Restart debugging
 * - F6: Pause
 * - F9: Toggle breakpoint at current line
 * - F10: Step over
 * - F11: Step into
 * - Shift+F11: Step out
 */
export function useDebugKeyboard(options?: {
  getCurrentFile?: () => string | null;
  getCurrentLine?: () => number | null;
  onStartDebug?: () => void;
}) {
  const debug = useDebug();

  const handleKeyDown = async (event: KeyboardEvent) => {
    const { key, shiftKey, ctrlKey, metaKey } = event;
    const mod = ctrlKey || metaKey;

    // Prevent handling if typing in input
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    switch (key) {
      case "F5":
        event.preventDefault();
        if (mod && shiftKey) {
          // Ctrl+Shift+F5: Restart
          if (debug.state.isDebugging) {
            try {
              await debug.restartSession();
            } catch (e) {
              console.error("Failed to restart debug session:", e);
            }
          }
        } else if (shiftKey) {
          // Shift+F5: Stop
          if (debug.state.isDebugging) {
            try {
              await debug.stopSession();
            } catch (e) {
              console.error("Failed to stop debug session:", e);
            }
          }
        } else {
          // F5: Start/Continue
          if (debug.state.isDebugging) {
            if (debug.state.isPaused) {
              try {
                await debug.continue_();
              } catch (e) {
                console.error("Failed to continue:", e);
              }
            }
          } else {
            // Start debug - trigger the callback to open launch config
            options?.onStartDebug?.();
          }
        }
        break;

      case "F6":
        // F6: Pause
        event.preventDefault();
        if (debug.state.isDebugging && !debug.state.isPaused) {
          try {
            await debug.pause();
          } catch (e) {
            console.error("Failed to pause:", e);
          }
        }
        break;

      case "F9":
        // F9: Toggle breakpoint
        event.preventDefault();
        {
          const currentFile = options?.getCurrentFile?.();
          const currentLine = options?.getCurrentLine?.();
          if (currentFile && currentLine) {
            try {
              await debug.toggleBreakpoint(currentFile, currentLine);
            } catch (e) {
              console.error("Failed to toggle breakpoint:", e);
            }
          }
        }
        break;

      case "F10":
        // F10: Step over
        event.preventDefault();
        if (debug.state.isDebugging && debug.state.isPaused) {
          try {
            await debug.stepOver();
          } catch (e) {
            console.error("Failed to step over:", e);
          }
        }
        break;

      case "F11":
        event.preventDefault();
        if (shiftKey) {
          // Shift+F11: Step out
          if (debug.state.isDebugging && debug.state.isPaused) {
            try {
              await debug.stepOut();
            } catch (e) {
              console.error("Failed to step out:", e);
            }
          }
        } else {
          // F11: Step into
          if (debug.state.isDebugging && debug.state.isPaused) {
            try {
              await debug.stepInto();
            } catch (e) {
              console.error("Failed to step into:", e);
            }
          }
        }
        break;
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });
}

/**
 * Get the status text for the debug session
 */
export function getDebugStatusText(state: {
  isDebugging: boolean;
  isPaused: boolean;
}): string {
  if (!state.isDebugging) {
    return "Not debugging";
  }
  return state.isPaused ? "Paused" : "Running";
}

/**
 * Get keyboard shortcut hints for the current debug state
 */
export function getDebugShortcutHints(state: {
  isDebugging: boolean;
  isPaused: boolean;
}): { key: string; action: string; available: boolean }[] {
  const hints = [
    {
      key: "F5",
      action: state.isDebugging && state.isPaused ? "Continue" : "Start Debug",
      available: !state.isDebugging || state.isPaused,
    },
    {
      key: "Shift+F5",
      action: "Stop",
      available: state.isDebugging,
    },
    {
      key: "Ctrl+Shift+F5",
      action: "Restart",
      available: state.isDebugging,
    },
    {
      key: "F6",
      action: "Pause",
      available: state.isDebugging && !state.isPaused,
    },
    {
      key: "F9",
      action: "Toggle Breakpoint",
      available: true,
    },
    {
      key: "F10",
      action: "Step Over",
      available: state.isDebugging && state.isPaused,
    },
    {
      key: "F11",
      action: "Step Into",
      available: state.isDebugging && state.isPaused,
    },
    {
      key: "Shift+F11",
      action: "Step Out",
      available: state.isDebugging && state.isPaused,
    },
  ];

  return hints;
}
