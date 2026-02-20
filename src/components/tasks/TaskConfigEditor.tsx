import { createSignal, Show, For, createEffect } from "solid-js";
import { Icon } from "../ui/Icon";
import { useTasks, type TaskConfig, type TaskGroup, BUILTIN_PROBLEM_MATCHERS } from "@/context/TasksContext";
import { Button, IconButton, Input, Text } from "@/components/ui";

export function TaskConfigEditor() {
  const tasks = useTasks();
  const isEditing = () => tasks.state.editingTask !== null;
  
  const [label, setLabel] = createSignal("");
  const [type, setType] = createSignal<TaskConfig["type"]>("shell");
  const [command, setCommand] = createSignal("");
  const [args, setArgs] = createSignal<string[]>([]);
  const [cwd, setCwd] = createSignal("");
  const [group, setGroup] = createSignal<TaskGroup>("none");
  const [isDefault, setIsDefault] = createSignal(false);
  const [envVars, setEnvVars] = createSignal<Array<{ key: string; value: string }>>([]);
  const [dependsOn, setDependsOn] = createSignal<string[]>([]);
  const [revealMode, setRevealMode] = createSignal<"always" | "silent" | "never">("always");
  const [panelMode, setPanelMode] = createSignal<"shared" | "dedicated" | "new">("shared");
  const [focusTerminal, setFocusTerminal] = createSignal(true);
  const [clearTerminal, setClearTerminal] = createSignal(false);
  const [isBackground, setIsBackground] = createSignal(false);
  const [problemMatchers, setProblemMatchers] = createSignal<string[]>([]);
  const [runOn, setRunOn] = createSignal<"default" | "folderOpen">("default");
  
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [activeTab, setActiveTab] = createSignal<"basic" | "advanced" | "presentation" | "dependencies">("basic");

  // Initialize form with editing task
  createEffect(() => {
    const task = tasks.state.editingTask;
    if (task) {
      setLabel(task.label);
      setType(task.type);
      setCommand(task.command);
      setArgs(task.args || []);
      setCwd(task.cwd || "");
      setGroup(task.group || "none");
      setIsDefault(task.isDefault || false);
      setEnvVars(
        task.env 
          ? Object.entries(task.env).map(([key, value]) => ({ key, value }))
          : []
      );
      setDependsOn(task.dependsOn || []);
      setRevealMode(task.presentation?.reveal || "always");
      setPanelMode(task.presentation?.panel || "shared");
      setFocusTerminal(task.presentation?.focus ?? true);
      setClearTerminal(task.presentation?.clear ?? false);
      setIsBackground(task.isBackground ?? false);
      setProblemMatchers(
        task.problemMatcher 
          ? (Array.isArray(task.problemMatcher) 
              ? task.problemMatcher.filter((m): m is string => typeof m === "string")
              : typeof task.problemMatcher === "string" 
                ? [task.problemMatcher] 
                : [])
          : []
      );
      setRunOn(task.runOptions?.runOn || "default");
    } else {
      resetForm();
    }
  });

  const resetForm = () => {
    setLabel("");
    setType("shell");
    setCommand("");
    setArgs([]);
    setCwd("");
    setGroup("none");
    setIsDefault(false);
    setEnvVars([]);
    setDependsOn([]);
    setRevealMode("always");
    setPanelMode("shared");
    setFocusTerminal(true);
    setClearTerminal(false);
    setIsBackground(false);
    setProblemMatchers([]);
    setRunOn("default");
    setErrors({});
    setActiveTab("basic");
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!label().trim()) {
      newErrors.label = "Label is required";
    } else if (!isEditing() && tasks.allTasks().some(t => t.label === label())) {
      newErrors.label = "A task with this label already exists";
    }
    
    if (!command().trim()) {
      newErrors.command = "Command is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    
    const env: Record<string, string> = {};
    for (const { key, value } of envVars()) {
      if (key.trim()) {
        env[key.trim()] = value;
      }
    }
    
    const task: TaskConfig = {
      label: label().trim(),
      type: type(),
      command: command().trim(),
      args: args().filter(a => a.trim()),
      cwd: cwd().trim() || undefined,
      group: group(),
      isDefault: isDefault(),
      isBackground: isBackground(),
      env: Object.keys(env).length > 0 ? env : undefined,
      dependsOn: dependsOn().filter(d => d.trim()),
      presentation: {
        reveal: revealMode(),
        panel: panelMode(),
        focus: focusTerminal(),
        clear: clearTerminal(),
      },
      problemMatcher: problemMatchers().length > 0 ? problemMatchers() : undefined,
      runOptions: runOn() !== "default" ? { runOn: runOn() } : undefined,
      source: "user",
    };
    
    if (isEditing()) {
      tasks.updateTask(tasks.state.editingTask!.label, task);
    } else {
      tasks.addTask(task);
    }
    
    tasks.closeConfigEditor();
  };

  const handleSaveAndRun = async () => {
    if (!validate()) return;
    
    handleSave();
    
    const task: TaskConfig = {
      label: label().trim(),
      type: type(),
      command: command().trim(),
      args: args().filter(a => a.trim()),
      cwd: cwd().trim() || undefined,
      group: group(),
      source: "user",
    };
    
    await tasks.runTask(task);
  };

  const addArg = () => {
    setArgs([...args(), ""]);
  };

  const updateArg = (index: number, value: string) => {
    const newArgs = [...args()];
    newArgs[index] = value;
    setArgs(newArgs);
  };

  const removeArg = (index: number) => {
    setArgs(args().filter((_, i) => i !== index));
  };

  const addEnvVar = () => {
    setEnvVars([...envVars(), { key: "", value: "" }]);
  };

  const updateEnvVar = (index: number, field: "key" | "value", value: string) => {
    const newVars = [...envVars()];
    newVars[index][field] = value;
    setEnvVars(newVars);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars().filter((_, i) => i !== index));
  };

  const addDependency = () => {
    setDependsOn([...dependsOn(), ""]);
  };

  const updateDependency = (index: number, value: string) => {
    const newDeps = [...dependsOn()];
    newDeps[index] = value;
    setDependsOn(newDeps);
  };

  const removeDependency = (index: number) => {
    setDependsOn(dependsOn().filter((_, i) => i !== index));
  };

  const availableTasks = () => {
    const currentLabel = isEditing() ? tasks.state.editingTask?.label : label();
    return tasks.allTasks().filter(t => t.label !== currentLabel);
  };

  const groupOptions: { value: TaskGroup; label: string }[] = [
    { value: "none", label: "None" },
    { value: "build", label: "Build" },
    { value: "test", label: "Test" },
    { value: "run", label: "Run" },
    { value: "clean", label: "Clean" },
    { value: "deploy", label: "Deploy" },
  ];

  const typeOptions: { value: TaskConfig["type"]; label: string; icon: string }[] = [
    { value: "shell", label: "Shell", icon: "💻" },
    { value: "process", label: "Process", icon: "⚡" },
    { value: "npm", label: "npm", icon: "📦" },
    { value: "cargo", label: "Cargo", icon: "🦀" },
  ];

  return (
    <Show when={tasks.state.showConfigEditor}>
      <div 
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={(e) => { if (e.target === e.currentTarget) tasks.closeConfigEditor(); }}
      >
        <div 
          class="w-[600px] max-h-[85vh] flex flex-col rounded-lg shadow-xl overflow-hidden"
          style={{ background: "var(--surface-base)", border: "1px solid var(--border-base)" }}
        >
          {/* Header */}
          <div 
            class="flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{ "border-color": "var(--border-base)" }}
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded flex items-center justify-center" style={{ background: "var(--cortex-info)20" }}>
                <Icon name="play" class="w-4 h-4" style={{ color: "var(--cortex-info)" }} />
              </div>
              <div>
                <h2 class="font-semibold" style={{ color: "var(--text-strong)" }}>
                  {isEditing() ? "Edit Task" : "New Task"}
                </h2>
                <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                  Configure task settings
                </p>
              </div>
            </div>
            
            <IconButton
              onClick={() => tasks.closeConfigEditor()}
              tooltip="Close"
            >
              <Icon name="xmark" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
            </IconButton>
          </div>

          {/* Tabs */}
          <div class="flex border-b shrink-0 overflow-x-auto" style={{ "border-color": "var(--border-base)" }}>
            <Button
              variant="ghost"
              style={{
                "border-radius": "0",
                color: activeTab() === "basic" ? "var(--text-strong)" : "var(--text-weak)",
                "border-bottom": activeTab() === "basic" ? "2px solid var(--cortex-info)" : "2px solid transparent",
              }}
              onClick={() => setActiveTab("basic")}
            >
              Basic
            </Button>
            <Button
              variant="ghost"
              style={{
                "border-radius": "0",
                color: activeTab() === "advanced" ? "var(--text-strong)" : "var(--text-weak)",
                "border-bottom": activeTab() === "advanced" ? "2px solid var(--cortex-info)" : "2px solid transparent",
              }}
              onClick={() => setActiveTab("advanced")}
            >
              Advanced
            </Button>
            <Button
              variant="ghost"
              icon={<Icon name="terminal" class="w-3.5 h-3.5" />}
              style={{
                "border-radius": "0",
                color: activeTab() === "presentation" ? "var(--text-strong)" : "var(--text-weak)",
                "border-bottom": activeTab() === "presentation" ? "2px solid var(--cortex-info)" : "2px solid transparent",
              }}
              onClick={() => setActiveTab("presentation")}
            >
              Presentation
            </Button>
            <Button
              variant="ghost"
              style={{
                "border-radius": "0",
                color: activeTab() === "dependencies" ? "var(--text-strong)" : "var(--text-weak)",
                "border-bottom": activeTab() === "dependencies" ? "2px solid var(--cortex-info)" : "2px solid transparent",
              }}
              onClick={() => setActiveTab("dependencies")}
            >
              Dependencies
            </Button>
          </div>

          {/* Content */}
          <div class="flex-1 overflow-y-auto p-4">
            {/* Basic Tab */}
            <Show when={activeTab() === "basic"}>
              <div class="space-y-4">
                {/* Label */}
                <div>
                  <Input
                    type="text"
                    label="Label *"
                    placeholder="e.g., Build Project"
                    error={errors().label}
                    value={label()}
                    onInput={(e) => setLabel(e.currentTarget.value)}
                  />
                </div>

                {/* Type */}
                <div>
                  <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-base)" }}>
                    Type
                  </label>
                  <div class="grid grid-cols-4 gap-2">
                    <For each={typeOptions}>
                      {(option) => (
                        <Button
                          variant="ghost"
                          style={{
                            display: "flex",
                            "flex-direction": "column",
                            "align-items": "center",
                            gap: "4px",
                            padding: "12px",
                            height: "auto",
                            background: type() === option.value ? "var(--cortex-info)20" : "var(--surface-raised)",
                            border: type() === option.value ? "1px solid var(--cortex-info)" : "1px solid var(--border-base)",
                          }}
                          onClick={() => setType(option.value)}
                        >
                          <span class="text-lg">{option.icon}</span>
                          <span class="text-xs" style={{ color: "var(--text-base)" }}>{option.label}</span>
                        </Button>
                      )}
                    </For>
                  </div>
                </div>

                {/* Command */}
                <div>
                  <Input
                    type="text"
                    label="Command *"
                    placeholder={type() === "npm" ? "run build" : "cargo build"}
                    error={errors().command}
                    style={{ "font-family": "monospace" }}
                    value={command()}
                    onInput={(e) => setCommand(e.currentTarget.value)}
                  />
                </div>

                {/* Arguments */}
                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <label class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                      Arguments
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={addArg}
                      icon={<Icon name="plus" class="w-3 h-3" />}
                      style={{ color: "var(--cortex-info)" }}
                    >
                      Add
                    </Button>
                  </div>
                  <div class="space-y-2">
                    <For each={args()}>
                      {(arg, index) => (
                        <div class="flex items-center gap-2">
                          <Input
                            type="text"
                            placeholder="--release"
                            style={{ "font-family": "monospace", flex: "1" }}
                            value={arg}
                            onInput={(e) => updateArg(index(), e.currentTarget.value)}
                          />
                          <IconButton
                            onClick={() => removeArg(index())}
                            tooltip="Remove argument"
                            style={{ color: "var(--cortex-error)" }}
                          >
                            <Icon name="trash" class="w-4 h-4" />
                          </IconButton>
                        </div>
                      )}
                    </For>
                  </div>
                </div>

                {/* Group */}
                <div>
                  <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-base)" }}>
                    Group
                  </label>
                  <select
                    class="w-full px-3 py-2 rounded text-sm outline-none"
                    style={{ 
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border-base)",
                      color: "var(--text-base)"
                    }}
                    value={group()}
                    onChange={(e) => setGroup(e.currentTarget.value as TaskGroup)}
                  >
                    <For each={groupOptions}>
                      {(option) => (
                        <option value={option.value}>{option.label}</option>
                      )}
                    </For>
                  </select>
                </div>

                {/* Task Options */}
                <div class="space-y-2">
                  <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-base)" }}>
                    Task Options
                  </label>
                  
                  {/* Is Default */}
                  <div class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is-default"
                      checked={isDefault()}
                      onChange={(e) => setIsDefault(e.currentTarget.checked)}
                      class="w-4 h-4 rounded"
                      style={{
                        background: "var(--jb-input-bg)",
                        border: "var(--jb-input-border)",
                        "accent-color": "var(--cortex-info)",
                      }}
                    />
                    <Text variant="body" style={{ color: "var(--text-base)" }}>
                      Set as default task for this group
                    </Text>
                  </div>
                  
                  {/* Is Background */}
                  <div class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is-background"
                      checked={isBackground()}
                      onChange={(e) => setIsBackground(e.currentTarget.checked)}
                      class="w-4 h-4 rounded"
                      style={{
                        background: "var(--jb-input-bg)",
                        border: "var(--jb-input-border)",
                        "accent-color": "var(--cortex-success)",
                      }}
                    />
                    <div class="flex items-center gap-1.5">
                      <Icon name="eye" class="w-3.5 h-3.5" style={{ color: "var(--cortex-success)" }} />
                      <Text variant="body" style={{ color: "var(--text-base)" }}>
                        Background/Watch task (runs indefinitely)
                      </Text>
                    </div>
                  </div>
                </div>

                {/* Run On */}
                <div>
                  <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-base)" }}>
                    Auto-run
                  </label>
                  <select
                    class="w-full px-3 py-2 rounded text-sm outline-none"
                    style={{ 
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border-base)",
                      color: "var(--text-base)"
                    }}
                    value={runOn()}
                    onChange={(e) => setRunOn(e.currentTarget.value as "default" | "folderOpen")}
                  >
                    <option value="default">Manual - Run on demand</option>
                    <option value="folderOpen">Folder Open - Run when project opens</option>
                  </select>
                  <p class="text-xs mt-1" style={{ color: "var(--text-weak)" }}>
                    Folder Open is useful for watch tasks that should start automatically
                  </p>
                </div>
              </div>
            </Show>

            {/* Advanced Tab */}
            <Show when={activeTab() === "advanced"}>
              <div class="space-y-4">
                {/* Working Directory */}
                <div>
                  <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-base)" }}>
                    Working Directory
                  </label>
                  <div class="flex items-center gap-2">
                    <Input
                      type="text"
                      placeholder="${workspaceFolder}/src"
                      style={{ "font-family": "monospace", flex: "1" }}
                      hint="Supports variables: ${workspaceFolder}, ${file}, ${fileDirname}"
                      value={cwd()}
                      onInput={(e) => setCwd(e.currentTarget.value)}
                    />
                    <IconButton
                      tooltip="Browse"
                    >
                      <Icon name="folder" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                    </IconButton>
                  </div>
                </div>

                {/* Environment Variables */}
                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <label class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                      Environment Variables
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={addEnvVar}
                      icon={<Icon name="plus" class="w-3 h-3" />}
                      style={{ color: "var(--cortex-info)" }}
                    >
                      Add
                    </Button>
                  </div>
                  <div class="space-y-2">
                    <For each={envVars()}>
                      {(envVar, index) => (
                        <div class="flex items-center gap-2">
                          <Input
                            type="text"
                            placeholder="KEY"
                            style={{ "font-family": "monospace", width: "33%" }}
                            value={envVar.key}
                            onInput={(e) => updateEnvVar(index(), "key", e.currentTarget.value)}
                          />
                          <Text variant="body" style={{ color: "var(--text-weak)" }}>=</Text>
                          <Input
                            type="text"
                            placeholder="value"
                            style={{ "font-family": "monospace", flex: "1" }}
                            value={envVar.value}
                            onInput={(e) => updateEnvVar(index(), "value", e.currentTarget.value)}
                          />
                          <IconButton
                            onClick={() => removeEnvVar(index())}
                            tooltip="Remove variable"
                            style={{ color: "var(--cortex-error)" }}
                          >
                            <Icon name="trash" class="w-4 h-4" />
                          </IconButton>
                        </div>
                      )}
                    </For>
                  </div>
                </div>

                {/* Problem Matchers */}
                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <label class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                      Problem Matchers
                    </label>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <For each={Object.keys(BUILTIN_PROBLEM_MATCHERS)}>
                      {(matcher) => (
                        <button
                          class="flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs"
                          style={{
                            background: problemMatchers().includes(matcher)
                              ? "var(--cortex-info)20"
                              : "var(--surface-raised)",
                            border: problemMatchers().includes(matcher)
                              ? "1px solid var(--cortex-info)"
                              : "1px solid var(--border-base)",
                            color: "var(--text-base)",
                          }}
                          onClick={() => {
                            if (problemMatchers().includes(matcher)) {
                              setProblemMatchers(problemMatchers().filter(m => m !== matcher));
                            } else {
                              setProblemMatchers([...problemMatchers(), matcher]);
                            }
                          }}
                        >
                          <div
                            class="w-3 h-3 rounded-sm flex items-center justify-center shrink-0"
                            style={{
                              background: problemMatchers().includes(matcher)
                                ? "var(--cortex-info)"
                                : "var(--surface-hover)",
                            }}
                          >
                            <Show when={problemMatchers().includes(matcher)}>
                              <svg class="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                              </svg>
                            </Show>
                          </div>
                          <span class="font-mono">{matcher}</span>
                        </button>
                      )}
                    </For>
                  </div>
                  <p class="text-xs mt-2" style={{ color: "var(--text-weak)" }}>
                    Problem matchers parse task output and populate the Problems panel with errors/warnings
                  </p>
                </div>
              </div>
            </Show>

            {/* Presentation Tab */}
            <Show when={activeTab() === "presentation"}>
              <div class="space-y-4">
                <div class="flex items-start gap-2 p-3 rounded" style={{ background: "var(--surface-raised)" }}>
                  <Icon name="terminal" class="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--cortex-info)" }} />
                  <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                    Configure how the task terminal is displayed when the task runs.
                    These settings match VS Code's task presentation options.
                  </p>
                </div>

                {/* Reveal Mode */}
                <div>
                  <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-base)" }}>
                    Reveal Terminal
                  </label>
                  <select
                    class="w-full px-3 py-2 rounded text-sm outline-none"
                    style={{ 
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border-base)",
                      color: "var(--text-base)"
                    }}
                    value={revealMode()}
                    onChange={(e) => setRevealMode(e.currentTarget.value as "always" | "silent" | "never")}
                  >
                    <option value="always">Always - Always show terminal when task runs</option>
                    <option value="silent">Silent - Show terminal only if there are errors</option>
                    <option value="never">Never - Never reveal terminal</option>
                  </select>
                </div>

                {/* Panel Mode */}
                <div>
                  <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-base)" }}>
                    Terminal Panel
                  </label>
                  <select
                    class="w-full px-3 py-2 rounded text-sm outline-none"
                    style={{ 
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border-base)",
                      color: "var(--text-base)"
                    }}
                    value={panelMode()}
                    onChange={(e) => setPanelMode(e.currentTarget.value as "shared" | "dedicated" | "new")}
                  >
                    <option value="shared">Shared - Reuse terminal panel</option>
                    <option value="dedicated">Dedicated - Use dedicated terminal for this task</option>
                    <option value="new">New - Create new terminal for each run</option>
                  </select>
                </div>

                {/* Focus & Clear Options */}
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="focus-terminal"
                      checked={focusTerminal()}
                      onChange={(e) => setFocusTerminal(e.currentTarget.checked)}
                      class="w-4 h-4 rounded"
                      style={{
                        background: "var(--jb-input-bg)",
                        border: "var(--jb-input-border)",
                        "accent-color": "var(--cortex-info)",
                      }}
                    />
                    <Text variant="body" style={{ color: "var(--text-base)" }}>
                      Focus terminal when task starts
                    </Text>
                  </div>
                  
                  <div class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="clear-terminal"
                      checked={clearTerminal()}
                      onChange={(e) => setClearTerminal(e.currentTarget.checked)}
                      class="w-4 h-4 rounded"
                      style={{
                        background: "var(--jb-input-bg)",
                        border: "var(--jb-input-border)",
                        "accent-color": "var(--cortex-info)",
                      }}
                    />
                    <Text variant="body" style={{ color: "var(--text-base)" }}>
                      Clear terminal before running task
                    </Text>
                  </div>
                </div>
              </div>
            </Show>

            {/* Dependencies Tab */}
            <Show when={activeTab() === "dependencies"}>
              <div class="space-y-4">
                <div class="flex items-start gap-2 p-3 rounded" style={{ background: "var(--surface-raised)" }}>
                  <Icon name="circle-info" class="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--cortex-info)" }} />
                  <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                    Dependencies are tasks that will be executed before this task runs.
                    They will run in the order listed.
                  </p>
                </div>

                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <label class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                      Depends On
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={addDependency}
                      icon={<Icon name="plus" class="w-3 h-3" />}
                      style={{ color: "var(--cortex-info)" }}
                    >
                      Add
                    </Button>
                  </div>
                  <div class="space-y-2">
                    <For each={dependsOn()}>
                      {(dep, index) => (
                        <div class="flex items-center gap-2">
                          <select
                            class="flex-1 px-3 py-2 rounded text-sm outline-none"
                            style={{ 
                              background: "var(--jb-input-bg)",
                              border: "var(--jb-input-border)",
                              "border-radius": "var(--jb-input-radius)",
                              color: "var(--jb-input-color)"
                            }}
                            value={dep}
                            onChange={(e) => updateDependency(index(), e.currentTarget.value)}
                          >
                            <option value="">Select a task...</option>
                            <For each={availableTasks()}>
                              {(task) => (
                                <option value={task.label}>{task.label}</option>
                              )}
                            </For>
                          </select>
                          <IconButton
                            onClick={() => removeDependency(index())}
                            tooltip="Remove dependency"
                            style={{ color: "var(--cortex-error)" }}
                          >
                            <Icon name="trash" class="w-4 h-4" />
                          </IconButton>
                        </div>
                      )}
                    </For>
                  </div>
                  
                  <Show when={dependsOn().length === 0}>
                    <p class="text-xs py-4 text-center" style={{ color: "var(--text-weak)" }}>
                      No dependencies configured
                    </p>
                  </Show>
                </div>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div 
            class="flex items-center justify-end gap-2 px-4 py-3 border-t shrink-0"
            style={{ "border-color": "var(--border-base)" }}
          >
            <Button
              variant="ghost"
              onClick={() => tasks.closeConfigEditor()}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handleSaveAndRun}
              icon={<Icon name="play" class="w-4 h-4" />}
            >
              Save & Run
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              icon={<Icon name="floppy-disk" class="w-4 h-4" />}
              style={{ background: "var(--cortex-info)" }}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
}


