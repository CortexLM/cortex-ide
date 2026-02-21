/**
 * ViewNavigationHandlers — Headless component that wires menu-bar events
 * (View, Go, Selection, Terminal, Run, Git, Developer, Help) to the
 * appropriate context actions and Tauri IPC commands.
 *
 * Mounted inside CortexDesktopLayout alongside existing inline handlers.
 */

import { onMount, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

import { createLogger } from "@/utils/logger";
import type { SidebarTab, BottomPanelTab } from "../layout/types";

const logger = createLogger("ViewNavigationHandlers");

export interface ViewNavigationHandlersProps {
  setShowCommandPalette: (show: boolean) => void;
  setShowFileFinder: (show: boolean) => void;
  setShowGoToLine: (show: boolean) => void;

  setSidebarTab: (tab: SidebarTab) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  bottomPanelTab: () => BottomPanelTab;
  bottomPanelCollapsed: () => boolean;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
  setBottomPanelCollapsed: (collapsed: boolean) => void;

  projectPath: () => string | null;
}

export function ViewNavigationHandlers(props: ViewNavigationHandlersProps) {
  onMount(() => {
    const handlers: Record<string, EventListener> = {
      // ── View events ──────────────────────────────────────────────────
      "command-palette:open": (() => {
        props.setShowCommandPalette(true);
      }) as EventListener,

      "quick-open:show": (() => {
        props.setShowFileFinder(true);
      }) as EventListener,

      // ── Go events ────────────────────────────────────────────────────
      "goto:file": (() => {
        props.setShowFileFinder(true);
      }) as EventListener,

      "goto:line": (() => {
        props.setShowGoToLine(true);
      }) as EventListener,

      "goto:back": (() => {
        window.dispatchEvent(new CustomEvent("navigation:back"));
      }) as EventListener,

      "goto:forward": (() => {
        window.dispatchEvent(new CustomEvent("navigation:forward"));
      }) as EventListener,

      // ── Selection events ─────────────────────────────────────────────
      "selection:expand": (() => {
        window.dispatchEvent(
          new CustomEvent("editor:command", { detail: { command: "expand-selection" } }),
        );
      }) as EventListener,

      "selection:shrink": (() => {
        window.dispatchEvent(
          new CustomEvent("editor:command", { detail: { command: "shrink-selection" } }),
        );
      }) as EventListener,

      // ── Terminal events ──────────────────────────────────────────────
      "terminal:new": (() => {
        props.setBottomPanelCollapsed(false);
        props.setBottomPanelTab("terminal");
      }) as EventListener,

      "terminal:split": (() => {
        props.setBottomPanelCollapsed(false);
        props.setBottomPanelTab("terminal");
      }) as EventListener,

      // ── Run / Debug events ───────────────────────────────────────────
      "debug:start": (() => {
        props.setSidebarTab("debug");
        props.setSidebarCollapsed(false);
      }) as EventListener,

      "debug:stop": (() => {
        props.setSidebarTab("debug");
        props.setSidebarCollapsed(false);
      }) as EventListener,

      "debug:restart": (() => {
        props.setSidebarTab("debug");
        props.setSidebarCollapsed(false);
      }) as EventListener,

      "debug:run-no-debug": (() => {
        window.dispatchEvent(new CustomEvent("debug:run-without-debugging"));
      }) as EventListener,

      // ── Git events ───────────────────────────────────────────────────
      "git:init": (async () => {
        const cwd = props.projectPath();
        if (!cwd) {
          logger.warn("No project path — cannot init repository");
          return;
        }
        try {
          await invoke("git_init", { path: cwd });
          props.setSidebarTab("git");
          props.setSidebarCollapsed(false);
          window.dispatchEvent(
            new CustomEvent("notification", {
              detail: { type: "success", message: "Git repository initialized" },
            }),
          );
        } catch (e) {
          logger.error("git_init failed:", e);
          window.dispatchEvent(
            new CustomEvent("notification", {
              detail: { type: "error", message: `Failed to init repository: ${e}` },
            }),
          );
        }
      }) as EventListener,

      "git:clone": (() => {
        window.dispatchEvent(new CustomEvent("git:clone-repository"));
      }) as EventListener,

      "git:commit": (() => {
        props.setSidebarTab("git");
        props.setSidebarCollapsed(false);
        window.dispatchEvent(new CustomEvent("git:open-commit-dialog"));
      }) as EventListener,

      "git:push": (async () => {
        const cwd = props.projectPath();
        if (!cwd) {
          logger.warn("No project path — cannot push");
          return;
        }
        try {
          await invoke("git_push_with_tags", { path: cwd, remote: null, branch: null, followTags: false });
          window.dispatchEvent(
            new CustomEvent("notification", {
              detail: { type: "success", message: "Pushed successfully" },
            }),
          );
        } catch (e) {
          logger.error("git_push failed:", e);
          window.dispatchEvent(
            new CustomEvent("notification", {
              detail: { type: "error", message: `Push failed: ${e}` },
            }),
          );
        }
      }) as EventListener,

      "git:pull": (async () => {
        const cwd = props.projectPath();
        if (!cwd) {
          logger.warn("No project path — cannot pull");
          return;
        }
        try {
          await invoke("git_pull", { path: cwd, remote: "origin", branch: null });
          window.dispatchEvent(
            new CustomEvent("notification", {
              detail: { type: "success", message: "Pulled successfully" },
            }),
          );
        } catch (e) {
          logger.error("git_pull failed:", e);
          window.dispatchEvent(
            new CustomEvent("notification", {
              detail: { type: "error", message: `Pull failed: ${e}` },
            }),
          );
        }
      }) as EventListener,

      // ── Developer events ─────────────────────────────────────────────
      "dev:toggle-devtools": (async () => {
        try {
          await invoke("toggle_devtools");
        } catch (e) {
          logger.error("toggle_devtools failed:", e);
        }
      }) as EventListener,

      "dev:reload": (() => {
        window.location.reload();
      }) as EventListener,

      // ── Help events ──────────────────────────────────────────────────
      "help:welcome": (() => {
        window.dispatchEvent(
          new CustomEvent("notification", {
            detail: { type: "info", message: "Welcome to Cortex!" },
          }),
        );
      }) as EventListener,

      "help:about": (() => {
        window.dispatchEvent(
          new CustomEvent("notification", {
            detail: { type: "info", message: "Cortex — AI-Powered Development Environment" },
          }),
        );
      }) as EventListener,
    };

    for (const [event, handler] of Object.entries(handlers)) {
      window.addEventListener(event, handler);
    }

    onCleanup(() => {
      for (const [event, handler] of Object.entries(handlers)) {
        window.removeEventListener(event, handler);
      }
    });
  });

  return null;
}
