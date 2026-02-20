import { createSignal, For, Show } from "solid-js";
import { DebugSessionConfig } from "@/context/DebugContext";
import { useTasks } from "@/context/TasksContext";
import { Icon } from "../ui/Icon";

interface LaunchConfigModalProps {
  onClose: () => void;
  onLaunch: (config: DebugSessionConfig) => void;
}

interface DebugTemplate {
  id: string;
  name: string;
  type: string;
  request: "launch" | "attach";
  defaults: Partial<DebugSessionConfig>;
}

const templates: DebugTemplate[] = [
  {
    id: "node",
    name: "Node.js",
    type: "node",
    request: "launch",
    defaults: {
      console: "integratedTerminal",
      stopOnEntry: false,
    },
  },
  {
    id: "python",
    name: "Python",
    type: "python",
    request: "launch",
    defaults: {
      console: "integratedTerminal",
      stopOnEntry: false,
    },
  },
  {
    id: "go",
    name: "Go",
    type: "go",
    request: "launch",
    defaults: {},
  },
  {
    id: "rust",
    name: "Rust (LLDB)",
    type: "lldb",
    request: "launch",
    defaults: {},
  },
];

export function LaunchConfigModal(props: LaunchConfigModalProps) {
  const tasks = useTasks();
  const [selectedTemplate, setSelectedTemplate] = createSignal<DebugTemplate | null>(null);
  const [name, setName] = createSignal("Debug Session");
  const [program, setProgram] = createSignal("");
  const [args, setArgs] = createSignal("");
  const [cwd, setCwd] = createSignal("");
  const [env, setEnv] = createSignal("");
  const [stopOnEntry, setStopOnEntry] = createSignal(false);
  const [adapterPath, setAdapterPath] = createSignal("");
  const [preLaunchTask, setPreLaunchTask] = createSignal("");
  const [postDebugTask, setPostDebugTask] = createSignal("");

  const handleLaunch = () => {
    const template = selectedTemplate();
    if (!template) return;

    const config: DebugSessionConfig = {
      id: `debug-${Date.now()}`,
      name: name(),
      type: template.type,
      request: template.request,
      program: program() || undefined,
      args: args() ? args().split(" ") : undefined,
      cwd: cwd() || undefined,
      env: env()
        ? Object.fromEntries(
            env()
              .split("\n")
              .map((line) => line.split("="))
              .filter((parts) => parts.length === 2)
          )
        : undefined,
      stopOnEntry: stopOnEntry(),
      adapterPath: adapterPath() || undefined,
      preLaunchTask: preLaunchTask() || undefined,
      postDebugTask: postDebugTask() || undefined,
      ...template.defaults,
    };

    props.onLaunch(config);
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "var(--ui-panel-bg)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        class="w-[500px] max-h-[80vh] overflow-hidden rounded-lg shadow-2xl flex flex-col"
        style={{ background: "var(--background-base)" }}
      >
        {/* Header */}
        <div
          class="shrink-0 flex items-center justify-between px-4 py-3 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <h2 class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
            Start Debugging
          </h2>
          <button
            onClick={props.onClose}
            class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
          >
            <Icon name="xmark" size="md" />
          </button>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-auto p-4">
          {/* Template selection */}
          <Show when={!selectedTemplate()}>
            <div class="space-y-2">
              <label class="text-xs" style={{ color: "var(--text-weak)" }}>
                Select Debug Configuration
              </label>
              <div class="grid grid-cols-2 gap-2">
                <For each={templates}>
                  {(template) => (
                    <button
                      onClick={() => setSelectedTemplate(template)}
                      class="flex items-center gap-2 px-3 py-2 rounded text-left transition-colors hover:bg-[var(--surface-raised)]"
                      style={{
                        background: "var(--surface-sunken)",
                        color: "var(--text-base)",
                      }}
                    >
                      <Icon name="terminal" size="md" style={{ color: "var(--text-weak)" }} />
                      <span class="text-sm">{template.name}</span>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Configuration form */}
          <Show when={selectedTemplate()}>
            <div class="space-y-4">
              {/* Template indicator */}
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Icon name="terminal" size="md" style={{ color: "var(--text-weak)" }} />
                  <span class="text-sm" style={{ color: "var(--text-base)" }}>
                    {selectedTemplate()!.name}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  class="text-xs underline"
                  style={{ color: "var(--text-weak)" }}
                >
                  Change
                </button>
              </div>

              {/* Name */}
              <div>
                <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                  Configuration Name
                </label>
                <input
                  type="text"
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  class="w-full px-3 py-2 text-sm rounded outline-none"
                  style={{
                    background: "var(--surface-sunken)",
                    color: "var(--text-base)",
                    border: "1px solid var(--border-weak)",
                  }}
                />
              </div>

              {/* Program */}
              <div>
                <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                  Program Path
                </label>
                <div class="flex gap-2">
                  <input
                    type="text"
                    value={program()}
                    onInput={(e) => setProgram(e.currentTarget.value)}
                    placeholder="e.g., main.py, index.js, main.go"
                    class="flex-1 px-3 py-2 text-sm rounded outline-none"
                    style={{
                      background: "var(--surface-sunken)",
                      color: "var(--text-base)",
                      border: "1px solid var(--border-weak)",
                    }}
                  />
                  <button
                    class="px-2 rounded transition-colors hover:bg-[var(--surface-raised)]"
                    style={{
                      background: "var(--surface-sunken)",
                      color: "var(--text-weak)",
                      border: "1px solid var(--border-weak)",
                    }}
                    title="Browse"
                  >
                    <Icon name="file" size="md" />
                  </button>
                </div>
              </div>

              {/* Arguments */}
              <div>
                <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                  Arguments (space-separated)
                </label>
                <input
                  type="text"
                  value={args()}
                  onInput={(e) => setArgs(e.currentTarget.value)}
                  placeholder="arg1 arg2 --flag value"
                  class="w-full px-3 py-2 text-sm rounded outline-none"
                  style={{
                    background: "var(--surface-sunken)",
                    color: "var(--text-base)",
                    border: "1px solid var(--border-weak)",
                  }}
                />
              </div>

              {/* Working Directory */}
              <div>
                <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                  Working Directory
                </label>
                <div class="flex gap-2">
                  <input
                    type="text"
                    value={cwd()}
                    onInput={(e) => setCwd(e.currentTarget.value)}
                    placeholder="Leave empty for project root"
                    class="flex-1 px-3 py-2 text-sm rounded outline-none"
                    style={{
                      background: "var(--surface-sunken)",
                      color: "var(--text-base)",
                      border: "1px solid var(--border-weak)",
                    }}
                  />
                  <button
                    class="px-2 rounded transition-colors hover:bg-[var(--surface-raised)]"
                    style={{
                      background: "var(--surface-sunken)",
                      color: "var(--text-weak)",
                      border: "1px solid var(--border-weak)",
                    }}
                    title="Browse"
                  >
                    <Icon name="folder" size="md" />
                  </button>
                </div>
              </div>

              {/* Environment Variables */}
              <div>
                <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                  Environment Variables (KEY=value, one per line)
                </label>
                <textarea
                  value={env()}
                  onInput={(e) => setEnv(e.currentTarget.value)}
                  placeholder="DEBUG=true&#10;NODE_ENV=development"
                  rows={3}
                  class="w-full px-3 py-2 text-sm rounded outline-none resize-none font-mono"
                  style={{
                    background: "var(--surface-sunken)",
                    color: "var(--text-base)",
                    border: "1px solid var(--border-weak)",
                  }}
                />
              </div>

              {/* Stop on Entry */}
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="stopOnEntry"
                  checked={stopOnEntry()}
                  onChange={(e) => setStopOnEntry(e.currentTarget.checked)}
                  class="rounded"
                />
                <label
                  for="stopOnEntry"
                  class="text-sm"
                  style={{ color: "var(--text-base)" }}
                >
                  Stop on entry
                </label>
              </div>

              {/* Custom Adapter Path */}
              <details class="group">
                <summary
                  class="cursor-pointer text-xs"
                  style={{ color: "var(--text-weak)" }}
                >
                  Advanced Options
                </summary>
                <div class="mt-2 space-y-3">
                  {/* Pre-launch Task */}
                  <div>
                    <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                      Pre-launch Task
                    </label>
                    <select
                      value={preLaunchTask()}
                      onChange={(e) => setPreLaunchTask(e.currentTarget.value)}
                      class="w-full px-3 py-2 text-sm rounded outline-none"
                      style={{
                        background: "var(--surface-sunken)",
                        color: "var(--text-base)",
                        border: "1px solid var(--border-weak)",
                      }}
                    >
                      <option value="">None</option>
                      <For each={tasks.allTasks()}>
                        {(task) => <option value={task.label}>{task.label}</option>}
                      </For>
                    </select>
                    <span class="text-[10px] mt-0.5 block" style={{ color: "var(--text-weak)" }}>
                      Task to run before debugging starts
                    </span>
                  </div>

                  {/* Post-debug Task */}
                  <div>
                    <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                      Post Debug Task
                    </label>
                    <select
                      value={postDebugTask()}
                      onChange={(e) => setPostDebugTask(e.currentTarget.value)}
                      class="w-full px-3 py-2 text-sm rounded outline-none"
                      style={{
                        background: "var(--surface-sunken)",
                        color: "var(--text-base)",
                        border: "1px solid var(--border-weak)",
                      }}
                    >
                      <option value="">None</option>
                      <For each={tasks.allTasks()}>
                        {(task) => <option value={task.label}>{task.label}</option>}
                      </For>
                    </select>
                    <span class="text-[10px] mt-0.5 block" style={{ color: "var(--text-weak)" }}>
                      Task to run after debugging ends
                    </span>
                  </div>

                  {/* Custom Debug Adapter Path */}
                  <div>
                    <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                      Custom Debug Adapter Path
                    </label>
                    <input
                      type="text"
                      value={adapterPath()}
                      onInput={(e) => setAdapterPath(e.currentTarget.value)}
                      placeholder="Path to custom debug adapter executable"
                      class="w-full px-3 py-2 text-sm rounded outline-none"
                      style={{
                        background: "var(--surface-sunken)",
                        color: "var(--text-base)",
                        border: "1px solid var(--border-weak)",
                      }}
                    />
                  </div>
                </div>
              </details>
            </div>
          </Show>
        </div>

        {/* Footer */}
        <div
          class="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-t"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <button
            onClick={props.onClose}
            class="px-3 py-1.5 text-sm rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleLaunch}
            disabled={!selectedTemplate() || !program()}
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "white",
            }}
          >
            <Icon name="play" size="sm" />
            Start Debugging
          </button>
        </div>
      </div>
    </div>
  );
}
