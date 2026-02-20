import { Show, For, createSignal } from "solid-js";
import { useDebug, type DataBreakpointAccessType } from "@/context/DebugContext";
import { Icon } from "@/components/ui/Icon";

function accessTypeLabel(type: DataBreakpointAccessType): string {
  switch (type) {
    case "read":
      return "Read";
    case "write":
      return "Write";
    case "readWrite":
      return "Read/Write";
  }
}

function accessTypeIcon(type: DataBreakpointAccessType): string {
  switch (type) {
    case "read":
      return "eye";
    case "write":
      return "pencil";
    case "readWrite":
      return "arrows-left-right";
  }
}

export interface DataBreakpointViewProps {
  compact?: boolean;
}

export function DataBreakpointView(_props: DataBreakpointViewProps) {
  const debug = useDebug();
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [newVariable, setNewVariable] = createSignal("");
  const [newAccessType, setNewAccessType] = createSignal<DataBreakpointAccessType>("write");

  const dataBreakpoints = () => debug.state.dataBreakpoints;

  const handleAdd = async () => {
    const name = newVariable().trim();
    if (!name) return;

    await debug.addDataBreakpoint(name, newAccessType());
    setNewVariable("");
    setShowAddForm(false);
  };

  const handleRemove = async (id: string) => {
    await debug.removeDataBreakpoint(id);
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await debug.enableDataBreakpoint(id, !enabled);
  };

  const handleClearAll = async () => {
    await debug.clearDataBreakpoints();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === "Escape") {
      setShowAddForm(false);
    }
  };

  return (
    <div class="flex flex-col h-full">
      <div
        class="flex items-center justify-between px-2 py-1"
        style={{ "border-bottom": "1px solid var(--border-weak)" }}
      >
        <span class="text-xs font-medium" style={{ color: "var(--text-base)" }}>
          Data Breakpoints
        </span>
        <div class="flex items-center gap-1">
          <button
            onClick={() => setShowAddForm(!showAddForm())}
            class="p-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
            style={{ color: "var(--text-weak)" }}
            title="Add data breakpoint"
          >
            <Icon name="plus" class="w-3.5 h-3.5" />
          </button>
          <Show when={dataBreakpoints().length > 0}>
            <button
              onClick={handleClearAll}
              class="p-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
              style={{ color: "var(--text-weak)" }}
              title="Remove all data breakpoints"
            >
              <Icon name="trash" class="w-3.5 h-3.5" />
            </button>
          </Show>
        </div>
      </div>

      <Show when={showAddForm()}>
        <div
          class="px-2 py-2 flex flex-col gap-2"
          style={{ "border-bottom": "1px solid var(--border-weak)" }}
        >
          <input
            type="text"
            value={newVariable()}
            onInput={(e) => setNewVariable(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder="Variable name or expression"
            class="w-full px-2 py-1 text-xs rounded outline-none"
            style={{
              background: "var(--surface-sunken)",
              color: "var(--text-base)",
              border: "1px solid var(--border-weak)",
            }}
            autofocus
          />
          <div class="flex items-center gap-2">
            <select
              value={newAccessType()}
              onChange={(e) => setNewAccessType(e.currentTarget.value as DataBreakpointAccessType)}
              class="px-2 py-1 text-xs rounded outline-none"
              style={{
                background: "var(--surface-sunken)",
                color: "var(--text-base)",
                border: "1px solid var(--border-weak)",
              }}
            >
              <option value="write">Write</option>
              <option value="read">Read</option>
              <option value="readWrite">Read/Write</option>
            </select>
            <button
              onClick={handleAdd}
              disabled={!newVariable().trim()}
              class="px-2 py-1 text-xs rounded transition-colors disabled:opacity-30"
              style={{
                background: "var(--accent)",
                color: "var(--text-on-accent)",
              }}
            >
              Add
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              class="px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)] transition-colors"
              style={{ color: "var(--text-weak)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>

      <div class="flex-1 overflow-y-auto">
        <Show
          when={dataBreakpoints().length > 0}
          fallback={
            <div class="px-3 py-4 text-center">
              <div class="text-xs" style={{ color: "var(--text-weaker)" }}>
                No data breakpoints set
              </div>
              <div class="text-[10px] mt-1" style={{ color: "var(--text-weaker)" }}>
                Click + to watch a variable for changes
              </div>
            </div>
          }
        >
          <For each={dataBreakpoints()}>
            {(bp) => (
              <div
                class="flex items-center gap-2 px-2 py-1 hover:bg-[var(--surface-hover)] transition-colors group"
                style={{
                  opacity: bp.enabled ? 1 : 0.5,
                }}
              >
                <input
                  type="checkbox"
                  checked={bp.enabled}
                  onChange={() => handleToggle(bp.id, bp.enabled)}
                  class="w-3 h-3"
                  style={{ "accent-color": "var(--accent)" }}
                />
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    background: bp.verified === false ? "var(--text-weaker)" : "var(--cortex-error)",
                    transform: "rotate(45deg)",
                    "flex-shrink": "0",
                  }}
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1">
                    <span
                      class="font-mono text-xs truncate"
                      style={{ color: "var(--text-base)" }}
                    >
                      {bp.variableName}
                    </span>
                    <span
                      class="flex items-center gap-0.5 text-[10px]"
                      style={{ color: "var(--text-weaker)" }}
                    >
                      <Icon name={accessTypeIcon(bp.accessType)} class="w-2.5 h-2.5" />
                      {accessTypeLabel(bp.accessType)}
                    </span>
                  </div>
                  <Show when={bp.hitCount > 0}>
                    <div class="text-[10px]" style={{ color: "var(--text-weaker)" }}>
                      Hits: {bp.hitCount}
                    </div>
                  </Show>
                </div>
                <button
                  onClick={() => handleRemove(bp.id)}
                  class="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-hover)] transition-all"
                  style={{ color: "var(--text-weak)" }}
                  title="Remove data breakpoint"
                >
                  <Icon name="x" class="w-3 h-3" />
                </button>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
