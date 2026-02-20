/**
 * Debug Keyboard Handler
 *
 * Global keyboard event handler for debug-related shortcuts.
 * Handles F5, F9, F10, F11, Ctrl+Shift+F10, etc.
 *
 * This component should be rendered inside the DebugProvider context.
 */

import { onMount, onCleanup, createEffect } from "solid-js";
import { useDebug } from "@/context/DebugContext";
import { useKeymap } from "@/context/KeymapContext";
import { useEditor } from "@/context/EditorContext";

export function DebugKeyboardHandler() {
  const debug = useDebug();
  const keymap = useKeymap();
  const editor = useEditor();

  // Store cleanup functions for event listeners
  let cleanupFns: (() => void)[] = [];

  const handleKeyDown = async (e: KeyboardEvent) => {
    // Skip if we're in an input field (unless it's the editor)
    const target = e.target as HTMLElement;
    const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
    const isEditorEl = target.closest(".monaco-editor") !== null;
    
    if (isInput && !isEditorEl) {
      return;
    }

    // Build keystroke from event
    const keystroke = {
      key: e.key,
      modifiers: {
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
      },
    };

    // Use the keymap context to check for chord handling
    const result = keymap.handleKeystrokeForChord(keystroke);
    
    if (result.handled && result.commandId) {
      // Execute the command based on commandId
      await executeDebugCommand(result.commandId, e);
    }
  };

  const executeDebugCommand = async (commandId: string, e: KeyboardEvent) => {
    // Only handle debug-related commands
    switch (commandId) {
      case "start-debugging":
        if (!debug.state.isDebugging) {
          e.preventDefault();
          // Dispatch event to show launch config picker or start debugging
          window.dispatchEvent(new CustomEvent("debug:start"));
        }
        break;

      case "stop-debugging":
        if (debug.state.isDebugging) {
          e.preventDefault();
          await debug.stopSession();
        }
        break;

      case "toggle-breakpoint":
        e.preventDefault();
        // Get current editor position and toggle breakpoint
        const activeFile = editor.selectors.activeFile();
        if (activeFile?.path) {
          // Dispatch event to toggle breakpoint at current line
          window.dispatchEvent(new CustomEvent("debug:toggle-breakpoint", {
            detail: { path: activeFile.path }
          }));
        }
        break;

      case "step-over":
        if (debug.state.isDebugging && debug.state.isPaused) {
          e.preventDefault();
          await debug.stepOver();
        }
        break;

      case "step-into":
        if (debug.state.isDebugging && debug.state.isPaused) {
          e.preventDefault();
          await debug.stepInto();
        }
        break;

      case "step-out":
        if (debug.state.isDebugging && debug.state.isPaused) {
          e.preventDefault();
          await debug.stepOut();
        }
        break;

      case "continue":
        if (debug.state.isDebugging && debug.state.isPaused) {
          e.preventDefault();
          await debug.continue_();
        }
        break;

      case "jump-to-cursor":
        if (debug.state.isDebugging && debug.state.isPaused) {
          e.preventDefault();
          await handleJumpToCursor();
        }
        break;

      case "step-into-targets":
        if (debug.state.isDebugging && debug.state.isPaused && debug.state.activeFrameId !== null) {
          e.preventDefault();
          // Dispatch event to show step-in targets menu at center of screen
          window.dispatchEvent(new CustomEvent("debug:show-step-in-targets", {
            detail: {
              x: window.innerWidth / 2 - 150,
              y: window.innerHeight / 2 - 100,
              frameId: debug.state.activeFrameId,
            }
          }));
        }
        break;

      case "restart-frame":
        if (debug.state.isDebugging && debug.state.isPaused && debug.state.activeFrameId !== null) {
          e.preventDefault();
          await debug.restartFrame(debug.state.activeFrameId);
        }
        break;
    }
  };

  const handleJumpToCursor = async () => {
    // Check if adapter supports goto
    if (!debug.state.capabilities?.supportsGotoTargetsRequest) {
      console.warn("Debug adapter does not support Jump to Cursor");
      return;
    }

    // Get current editor position
    const activeFile = editor.selectors.activeFile();
    if (!activeFile?.path) {
      return;
    }

    // We need the current cursor line from the editor
    // Dispatch an event to get the current line and perform the jump
    window.dispatchEvent(new CustomEvent("debug:jump-to-cursor-request", {
      detail: { path: activeFile.path }
    }));
  };

  // Listen for jump-to-cursor response from editor
  const handleJumpToCursorExecute = async (e: CustomEvent<{ path: string; line: number }>) => {
    const { path, line } = e.detail;
    try {
      const targets = await debug.getGotoTargets(path, line);
      if (targets.length > 0) {
        await debug.jumpToLocation(targets[0].id);
      }
    } catch (err) {
      console.error("Jump to cursor failed:", err);
    }
  };

  // Listen for toggle breakpoint at line (from CodeEditor)
  const handleToggleBreakpointAtLine = async (e: CustomEvent<{ path: string; line: number }>) => {
    const { path, line } = e.detail;
    try {
      await debug.toggleBreakpoint(path, line);
    } catch (err) {
      console.error("Toggle breakpoint failed:", err);
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("debug:jump-to-cursor-execute", handleJumpToCursorExecute as unknown as EventListener);
    window.addEventListener("debug:toggle-breakpoint-at-line", handleToggleBreakpointAtLine as unknown as EventListener);

    cleanupFns = [
      () => window.removeEventListener("keydown", handleKeyDown),
      () => window.removeEventListener("debug:jump-to-cursor-execute", handleJumpToCursorExecute as unknown as EventListener),
      () => window.removeEventListener("debug:toggle-breakpoint-at-line", handleToggleBreakpointAtLine as unknown as EventListener),
    ];
  });

  onCleanup(() => {
    cleanupFns.forEach(fn => fn());
  });

  // Update keymap context keys when debug state changes
  createEffect(() => {
    keymap.setContextKeys({
      debuggingActive: debug.state.isDebugging,
      inDebugMode: debug.state.isDebugging && debug.state.isPaused,
      debugState: debug.state.isPaused ? "stopped" : debug.state.isDebugging ? "running" : "inactive",
    });
  });

  return null;
}
