import { Show, For, createSignal } from "solid-js";
import {
  useDebug,
  type DataBreakpointAccessType,
  type DataBreakpoint,
} from "@/context/DebugContext";
import { Icon } from "@/components/ui/Icon";

export interface DataBreakpointPanelProps {
  compact?: boolean;
}

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

export function DataBreakpointPanel(_props: DataBreakpointPanelProps) {
  const debug = useDebug();
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [newVarName, setNewVarName] = createSignal("");
  const [newAccessType, setNewAccessType] =
    createSignal<DataBreakpointAccessType>("write");

  const handleAdd = async () => {
    const name = newVarName().trim();
    if (!name) return;
    await debug.addDataBreakpoint(name, newAccessType());
    setNewVarName("");
    setShowAddForm(false);
  };

  const handleRemove = async (id: string) => {
    await debug.removeDataBreakpoint(id);
  };

  const handleToggle = async (bp: DataBreakpoint) => {
    await debug.enableDataBreakpoint(bp.id, !bp.enabled);
  };

  const handleClearAll = async () => {
    await debug.clearDataBreakpoints();
  };

  return (
    <div class="py-1">
      {/* Header */}
      <div class="flex items-center justify-between px-2 pb-1">
        <div
          class="flex items-center gap-1.5 text-xs"
          style={{ color: "var(--text-weak)" }}
        >
          <Icon name="database" size="xs" />
          <span>Data Breakpoints</span>
          <Show when={debug.state.dataBreakpoints.length > 0}>
            <span
              class="px-1 rounded text-[10px]"
              style={{
                background: "var(--surface-active)",
                color: "var(--text-weak)",
              }}
            >
              {debug.state.dataBreakpoints.length}
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-1">
          <Show when={debug.state.dataBreakpoints.length > 0}>
            <button
              onClick={handleClearAll}
              class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title="Clear all data breakpoints"
            >
              <Icon name="trash" size="xs" />
            </button>
          </Show>
          <button
            onClick={() => setShowAddForm(!showAddForm())}
            class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{
              color: showAddForm() ? "var(--accent)" : "var(--text-weak)",
            }}
            title="Add data breakpoint"
          >
            <Icon name="plus" size="xs" />
          </button>
        </div>
      </div>

      {/* Add form */}
      <Show when={showAddForm()}>
        <div class="px-2 pb-2 space-y-1.5">
          <input
            type="text"
            value={newVarName()}
            onInput={(e) => setNewVarName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") setShowAddForm(false);
            }}
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
              onChange={(e) =>
                setNewAccessType(
                  e.currentTarget.value as DataBreakpointAccessType,
                )
              }
              class="flex-1 px-2 py-1 text-xs rounded outline-none"
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
              disabled={!newVarName().trim()}
              class="px-2 py-1 text-xs rounded disabled:opacity-30"
              style={{ background: "var(--accent)", color: "white" }}
            >
              Add
            </button>
          </div>
        </div>
      </Show>

      {/* List */}
      <Show
        when={debug.state.dataBreakpoints.length > 0}
        fallback={
          <Show when={!showAddForm()}>
            <div
              class="text-xs text-center py-4"
              style={{ color: "var(--text-weak)" }}
            >
              No data breakpoints.
              <br />
              <button
                onClick={() => setShowAddForm(true)}
                class="underline hover:no-underline"
              >
                Add data breakpoint
              </button>
            </div>
          </Show>
        }
      >
        <For each={debug.state.dataBreakpoints}>
          {(bp) => (
            <div
              class="group flex items-center gap-1.5 px-2 text-xs transition-colors hover:bg-[var(--surface-raised)]"
              style={{ height: "24px" }}
            >
              <input
                type="checkbox"
                checked={bp.enabled}
                onChange={() => handleToggle(bp)}
                class="w-3 h-3 shrink-0"
              />
              <Icon
                name={accessTypeIcon(bp.accessType)}
                size="xs"
                class="shrink-0"
                style={{
                  color: bp.enabled
                    ? "var(--cortex-warning)"
                    : "var(--text-weak)",
                }}
              />
              <span
                class="flex-1 truncate font-mono"
                style={{
                  color: bp.enabled ? "var(--text-base)" : "var(--text-weak)",
                  opacity: bp.enabled ? 1 : 0.6,
                }}
              >
                {bp.variableName}
              </span>
              <span
                class="text-[10px] shrink-0"
                style={{ color: "var(--text-weak)" }}
              >
                {accessTypeLabel(bp.accessType)}
              </span>
              <Show when={bp.verified === false}>
                <Icon
                  name="circle-exclamation"
                  size="xs"
                  style={{ color: "var(--cortex-warning)" }}
                />
              </Show>
              <button
                onClick={() => handleRemove(bp.id)}
                class="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity hover:bg-[var(--surface-raised)]"
                style={{ color: "var(--text-weak)" }}
                title="Remove"
              >
                <Icon name="xmark" size="xs" />
              </button>
            </div>
          )}
        </For>
      </Show>

      {/* Capabilities warning */}
      <Show
        when={
          debug.state.isDebugging &&
          !debug.state.capabilities?.supportsDataBreakpoints
        }
      >
        <div
          class="mx-2 mt-2 px-2 py-1.5 rounded text-[10px]"
          style={{
            background: "rgba(245, 158, 11, 0.1)",
            color: "var(--cortex-warning)",
          }}
        >
          <Icon name="triangle-exclamation" size="xs" class="inline mr-1" />
          Current debug adapter may not support data breakpoints.
        </div>
      </Show>
    </div>
  );
}
