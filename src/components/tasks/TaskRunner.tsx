import { createSignal, createEffect, Show, For } from "solid-js";
import { Icon } from "../ui/Icon";
import { useTasks, type TaskRun } from "@/context/TasksContext";

interface TaskRunnerProps {
  run: TaskRun;
  onClose: () => void;
}

export function TaskRunner(props: TaskRunnerProps) {
  const tasks = useTasks();
  let outputContainer: HTMLDivElement | undefined;
  let autoScroll = true;

  const [searchQuery, setSearchQuery] = createSignal("");
  const [showSearch, setShowSearch] = createSignal(false);

  // Auto-scroll to bottom when new output arrives
  createEffect(() => {
    const output = props.run.output;
    if (autoScroll && outputContainer && output.length > 0) {
      outputContainer.scrollTop = outputContainer.scrollHeight;
    }
  });

  const handleScroll = () => {
    if (!outputContainer) return;
    const isAtBottom = outputContainer.scrollHeight - outputContainer.scrollTop - outputContainer.clientHeight < 50;
    autoScroll = isAtBottom;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      setShowSearch(!showSearch());
    }
    if (e.key === "Escape") {
      setShowSearch(false);
    }
  };

  const filteredOutput = () => {
    const query = searchQuery().toLowerCase();
    if (!query) return props.run.output;
    return props.run.output.filter(line => line.toLowerCase().includes(query));
  };

  const formatDuration = (start: number, end?: number) => {
    const duration = (end || Date.now()) - start;
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
  };

  const getStatusIcon = () => {
    switch (props.run.status) {
      case "running":
        return <Icon name="play" class="w-4 h-4 text-blue-400 animate-pulse" />;
      case "completed":
        return <Icon name="check" class="w-4 h-4 text-green-400" />;
      case "failed":
        return <Icon name="circle-exclamation" class="w-4 h-4 text-red-400" />;
      case "cancelled":
        return <Icon name="stop" class="w-4 h-4 text-yellow-400" />;
      default:
        return <Icon name="clock" class="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (props.run.status) {
      case "running": return "var(--cortex-info)";
      case "completed": return "var(--cortex-success)";
      case "failed": return "var(--cortex-error)";
      case "cancelled": return "var(--cortex-warning)";
      default: return "var(--cortex-text-inactive)";
    }
  };

  const getStatusText = () => {
    switch (props.run.status) {
      case "running": return "Running";
      case "completed": return "Completed";
      case "failed": return "Failed";
      case "cancelled": return "Cancelled";
      default: return "Pending";
    }
  };

  const downloadOutput = () => {
    const content = props.run.output.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.run.taskLabel.replace(/[^a-z0-9]/gi, "_")}_output.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      class="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div 
        class="w-[90vw] max-w-5xl h-[85vh] flex flex-col rounded-lg shadow-xl overflow-hidden"
        style={{ background: "var(--surface-base)", border: "1px solid var(--border-base)" }}
      >
        {/* Header */}
        <div 
          class="flex items-center gap-3 px-4 py-3 border-b shrink-0"
          style={{ "border-color": "var(--border-base)" }}
        >
          <button 
            onClick={props.onClose}
            class="p-1 rounded hover:bg-[var(--surface-hover)]"
          >
            <Icon name="chevron-left" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
          </button>
          
          <div class="w-8 h-8 rounded flex items-center justify-center" style={{ background: `${getStatusColor()}20` }}>
            {getStatusIcon()}
          </div>
          
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate" style={{ color: "var(--text-strong)" }}>
              {props.run.taskLabel}
            </div>
            <div class="text-xs flex items-center gap-2" style={{ color: "var(--text-weak)" }}>
              <span>{props.run.config.command} {props.run.config.args?.join(" ")}</span>
              <span>•</span>
              <span>{formatDuration(props.run.startedAt, props.run.finishedAt)}</span>
            </div>
          </div>

          <div 
            class="px-2 py-0.5 rounded text-xs font-medium"
            style={{ background: `${getStatusColor()}20`, color: getStatusColor() }}
          >
            {getStatusText()}
            <Show when={props.run.exitCode !== undefined}>
              <span> (code: {props.run.exitCode})</span>
            </Show>
          </div>

          <div class="flex items-center gap-1">
            <Show when={props.run.status === "running"}>
              <button 
                onClick={() => tasks.cancelTask(props.run.id)}
                class="p-2 rounded hover:bg-red-500/20"
                title="Stop task"
              >
                <Icon name="stop" class="w-4 h-4 text-red-400" />
              </button>
            </Show>
            
            <Show when={props.run.status !== "running"}>
              <button 
                onClick={() => tasks.rerunTask(props.run)}
                class="p-2 rounded hover:bg-[var(--surface-hover)]"
                title="Rerun task"
              >
                <Icon name="rotate" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
              </button>
            </Show>
            
            <button 
              onClick={downloadOutput}
              class="p-2 rounded hover:bg-[var(--surface-hover)]"
              title="Download output"
            >
              <Icon name="download" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            </button>
            
            <button 
              onClick={props.onClose}
              class="p-2 rounded hover:bg-[var(--surface-hover)]"
            >
              <Icon name="xmark" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <Show when={showSearch()}>
          <div 
            class="flex items-center gap-2 px-4 py-2 border-b shrink-0"
            style={{ "border-color": "var(--border-base)" }}
          >
            <input
              type="text"
              placeholder="Search output..."
              class="flex-1 px-3 py-1.5 rounded text-sm bg-transparent outline-none"
              style={{ 
                border: "1px solid var(--border-base)",
                color: "var(--text-base)"
              }}
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              autofocus
            />
            <span class="text-xs" style={{ color: "var(--text-weak)" }}>
              {filteredOutput().length} / {props.run.output.length} lines
            </span>
          </div>
        </Show>

        {/* Output */}
        <div 
          ref={outputContainer}
          onScroll={handleScroll}
          class="flex-1 overflow-auto font-mono text-sm p-4"
          style={{ background: "var(--ui-panel-bg)" }}
        >
          <Show 
            when={filteredOutput().length > 0}
            fallback={
              <div class="text-center py-8" style={{ color: "var(--text-weak)" }}>
                <Show when={props.run.status === "pending"}>
                  Waiting to start...
                </Show>
                <Show when={props.run.status === "running" && props.run.output.length === 0}>
                  Running... (no output yet)
                </Show>
                <Show when={props.run.status !== "pending" && props.run.status !== "running"}>
                  No output
                </Show>
              </div>
            }
          >
            <For each={filteredOutput()}>
              {(line, index) => (
                <OutputLine line={line} lineNumber={index() + 1} searchQuery={searchQuery()} />
              )}
            </For>
          </Show>
        </div>

        {/* Footer */}
        <div 
          class="flex items-center justify-between px-4 py-2 border-t shrink-0"
          style={{ "border-color": "var(--border-base)", background: "var(--surface-raised)" }}
        >
          <div class="text-xs" style={{ color: "var(--text-weak)" }}>
            {props.run.output.length} lines
          </div>
          <div class="flex items-center gap-2 text-xs" style={{ color: "var(--text-weak)" }}>
            <kbd class="px-1.5 py-0.5 rounded" style={{ background: "var(--surface-base)" }}>
              Ctrl+F
            </kbd>
            <span>Search</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Output Line Component
// ============================================================================

interface OutputLineProps {
  line: string;
  lineNumber: number;
  searchQuery: string;
}

function OutputLine(props: OutputLineProps) {
  const isError = () => {
    const lower = props.line.toLowerCase();
    return lower.includes("error") || lower.includes("failed") || lower.includes("exception");
  };

  const isWarning = () => {
    const lower = props.line.toLowerCase();
    return lower.includes("warning") || lower.includes("warn");
  };

  const getLineColor = () => {
    if (isError()) return "var(--cortex-error)";
    if (isWarning()) return "var(--cortex-warning)";
    return "var(--cortex-text-primary)";
  };

  const highlightMatches = () => {
    if (!props.searchQuery) return props.line;
    
    const parts: Array<{ text: string; highlighted: boolean }> = [];
    const query = props.searchQuery.toLowerCase();
    const line = props.line;
    let lastIndex = 0;
    let searchIndex = line.toLowerCase().indexOf(query);
    
    while (searchIndex !== -1) {
      if (searchIndex > lastIndex) {
        parts.push({ text: line.slice(lastIndex, searchIndex), highlighted: false });
      }
      parts.push({ text: line.slice(searchIndex, searchIndex + query.length), highlighted: true });
      lastIndex = searchIndex + query.length;
      searchIndex = line.toLowerCase().indexOf(query, lastIndex);
    }
    
    if (lastIndex < line.length) {
      parts.push({ text: line.slice(lastIndex), highlighted: false });
    }
    
    return parts;
  };

  return (
    <div class="flex hover:bg-white/5 group">
      <span 
        class="w-12 shrink-0 text-right pr-3 select-none opacity-30"
        style={{ color: "var(--text-weak)" }}
      >
        {props.lineNumber}
      </span>
      <span 
        class="flex-1 whitespace-pre-wrap break-all"
        style={{ color: getLineColor() }}
      >
        <Show 
          when={typeof highlightMatches() !== "string"}
          fallback={props.line}
        >
          <For each={highlightMatches() as Array<{ text: string; highlighted: boolean }>}>
            {(part) => (
              <span 
                style={{ 
                  background: part.highlighted ? "rgba(234, 179, 8, 0.3)" : "transparent",
                  "border-radius": part.highlighted ? "2px" : "0",
                }}
              >
                {part.text}
              </span>
            )}
          </For>
        </Show>
      </span>
    </div>
  );
}

// ============================================================================
// Task Output Panel (Inline version for split views)
// ============================================================================

interface TaskOutputPanelProps {
  run: TaskRun;
  compact?: boolean;
}

export function TaskOutputPanel(props: TaskOutputPanelProps) {
  const tasks = useTasks();
  let outputContainer: HTMLDivElement | undefined;
  let autoScroll = true;

  createEffect(() => {
    const output = props.run.output;
    if (autoScroll && outputContainer && output.length > 0) {
      outputContainer.scrollTop = outputContainer.scrollHeight;
    }
  });

  const handleScroll = () => {
    if (!outputContainer) return;
    const isAtBottom = outputContainer.scrollHeight - outputContainer.scrollTop - outputContainer.clientHeight < 50;
    autoScroll = isAtBottom;
  };

  const getStatusColor = () => {
    switch (props.run.status) {
      case "running": return "var(--cortex-info)";
      case "completed": return "var(--cortex-success)";
      case "failed": return "var(--cortex-error)";
      case "cancelled": return "var(--cortex-warning)";
      default: return "var(--cortex-text-inactive)";
    }
  };

  return (
    <div class="flex flex-col h-full" style={{ background: "var(--ui-panel-bg)" }}>
      {/* Header */}
      <div 
        class="flex items-center gap-2 px-3 py-2 border-b shrink-0"
        style={{ "border-color": "var(--border-base)" }}
      >
        <div 
          class="w-2 h-2 rounded-full"
          style={{ background: getStatusColor() }}
        />
        <span class="text-xs font-medium truncate" style={{ color: "var(--text-base)" }}>
          {props.run.taskLabel}
        </span>
        <div class="flex-1" />
        <Show when={props.run.status === "running"}>
          <button 
            onClick={() => tasks.cancelTask(props.run.id)}
            class="p-1 rounded hover:bg-red-500/20"
            title="Stop"
          >
            <Icon name="stop" class="w-3 h-3 text-red-400" />
          </button>
        </Show>
      </div>

      {/* Output */}
      <div 
        ref={outputContainer}
        onScroll={handleScroll}
        class="flex-1 overflow-auto font-mono text-xs p-2"
      >
        <For each={props.run.output}>
          {(line) => (
            <div class="whitespace-pre-wrap break-all" style={{ color: "var(--cortex-text-primary)" }}>
              {line}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

