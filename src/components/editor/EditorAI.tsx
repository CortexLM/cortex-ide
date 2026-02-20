/**
 * EditorAI - SolidJS component for agent activity indicator.
 *
 * Renders a Zed-style orange glow overlay when an AI agent is actively
 * reading or editing the current file. The indicator is driven by
 * "editor:agentActive" / "editor:agentInactive" window events.
 *
 * This component is part of the CodeEditor refactor that splits the monolithic
 * editor into focused, composable sub-components.
 */

import { Show, createSignal, onCleanup } from "solid-js";
import type { JSX } from "solid-js";
import type { OpenFile } from "@/context/EditorContext";

// ============================================================================
// Types
// ============================================================================

export interface EditorAIProps {
  activeFile: () => OpenFile | undefined;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Visual component that displays an orange glow overlay when an AI agent
 * is actively interacting with the current editor file.
 *
 * Event contract:
 * - "editor:agentActive"   → detail: { path?, paths?, action, duration, allSplits? }
 * - "editor:agentInactive" → clears the indicator
 */
export function EditorAI(props: EditorAIProps): JSX.Element {
  const [agentActive, setAgentActive] = createSignal(false);
  let agentActiveTimer: ReturnType<typeof setTimeout> | null = null;

  const handleAgentActive = (
    e: CustomEvent<{
      path?: string;
      paths?: string[];
      action: string;
      duration: number;
      allSplits?: boolean;
    }>,
  ) => {
    const file = props.activeFile();
    const detail = e.detail;

    const shouldActivate =
      detail.allSplits ||
      (file && detail.path === file.path) ||
      (file && detail.paths?.includes(file.path));

    if (shouldActivate) {
      setAgentActive(true);

      if (agentActiveTimer) {
        clearTimeout(agentActiveTimer);
      }

      if (detail.duration > 0) {
        agentActiveTimer = setTimeout(() => {
          setAgentActive(false);
        }, detail.duration);
      }
    }
  };

  const handleAgentInactive = () => {
    setAgentActive(false);
    if (agentActiveTimer) {
      clearTimeout(agentActiveTimer);
      agentActiveTimer = null;
    }
  };

  window.addEventListener(
    "editor:agentActive",
    handleAgentActive as EventListener,
  );
  window.addEventListener("editor:agentInactive", handleAgentInactive);

  onCleanup(() => {
    window.removeEventListener(
      "editor:agentActive",
      handleAgentActive as EventListener,
    );
    window.removeEventListener("editor:agentInactive", handleAgentInactive);
    if (agentActiveTimer) clearTimeout(agentActiveTimer);
  });

  return (
    <Show when={agentActive()}>
      <div
        class="absolute inset-0 pointer-events-none z-50 animate-pulse"
        style={{
          "box-shadow": "inset 0 0 20px rgba(249, 115, 22, 0.3)",
          border: "2px solid var(--jb-color-warning, var(--cortex-warning))",
          "border-radius": "var(--cortex-radius-sm)",
        }}
      />
    </Show>
  );
}
