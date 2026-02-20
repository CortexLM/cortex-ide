/**
 * Extension Profiler Commands
 * Registers developer commands for extension profiling
 */

import { Component, createSignal, onMount, onCleanup, Show } from "solid-js";
import { useCommands } from "../../context/CommandContext";
import { ExtensionProfiler } from "./ExtensionProfiler";

/**
 * Component that registers profiler-related commands and renders the profiler modal
 */
export const ExtensionProfilerCommands: Component = () => {
  const commands = useCommands();
  const [showProfiler, setShowProfiler] = createSignal(false);

  onMount(() => {
    // Register "Developer: Show Running Extensions" command
    commands.registerCommand({
      id: "developer.showRunningExtensions",
      label: "Show Running Extensions",
      category: "Developer",
      action: () => setShowProfiler(true),
    });

    // Register "Developer: Profile Extensions" command
    commands.registerCommand({
      id: "developer.profileExtensions",
      label: "Profile Extensions",
      category: "Developer",
      action: () => setShowProfiler(true),
    });

    // Register "Developer: Show Extension Profiler" command
    commands.registerCommand({
      id: "developer.showExtensionProfiler",
      label: "Show Extension Profiler",
      category: "Developer",
      action: () => setShowProfiler(true),
    });
  });

  onCleanup(() => {
    commands.unregisterCommand("developer.showRunningExtensions");
    commands.unregisterCommand("developer.profileExtensions");
    commands.unregisterCommand("developer.showExtensionProfiler");
  });

  return (
    <Show when={showProfiler()}>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          "background-color": "rgba(0, 0, 0, 0.5)",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          "z-index": 10000,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowProfiler(false);
          }
        }}
      >
        <div
          style={{
            width: "min(900px, 90vw)",
            height: "min(700px, 85vh)",
            "border-radius": "var(--cortex-radius-md)",
            overflow: "hidden",
            "box-shadow": "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          }}
        >
          <ExtensionProfiler onClose={() => setShowProfiler(false)} />
        </div>
      </div>
    </Show>
  );
};

export default ExtensionProfilerCommands;

