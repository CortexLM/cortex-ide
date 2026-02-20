import { Show, For, createSignal } from "solid-js";
import { Icon } from "@/components/ui/Icon";

function JsonTreeNode(props: { label: string; data: unknown; depth: number }) {
  const [collapsed, setCollapsed] = createSignal(props.depth > 1);
  const isExpandable = () =>
    props.data !== null && typeof props.data === "object";

  return (
    <div style={{ "padding-left": `${props.depth * 12}px` }}>
      <div
        class="flex items-center gap-1 cursor-pointer select-none"
        onClick={() => isExpandable() && setCollapsed(!collapsed())}
      >
        <Show when={isExpandable()}>
          <Show when={collapsed()} fallback={<Icon name="chevron-down" class="w-3 h-3" />}>
            <Icon name="chevron-right" class="w-3 h-3" />
          </Show>
        </Show>
        <span class="font-mono text-code-sm" style={{ color: "var(--cortex-info)" }}>
          {props.label}
        </span>
        <Show when={!isExpandable()}>
          <span class="font-mono text-code-sm" style={{ color: "var(--text-base)" }}>
            : {JSON.stringify(props.data)}
          </span>
        </Show>
        <Show when={isExpandable() && collapsed()}>
          <span class="font-mono text-code-sm" style={{ color: "var(--text-weak)" }}>
            {Array.isArray(props.data)
              ? `[${(props.data as unknown[]).length}]`
              : `{${Object.keys(props.data as Record<string, unknown>).length}}`}
          </span>
        </Show>
      </div>
      <Show when={isExpandable() && !collapsed()}>
        <For each={Object.entries(props.data as Record<string, unknown>)}>
          {([key, value]) => (
            <JsonTreeNode label={key} data={value} depth={props.depth + 1} />
          )}
        </For>
      </Show>
    </div>
  );
}

export interface JsonOutputProps {
  data: unknown;
}

export function JsonOutput(props: JsonOutputProps) {
  const [treeView, setTreeView] = createSignal(false);

  return (
    <div style={{ margin: "4px 0" }}>
      <div class="flex items-center gap-2 mb-1">
        <button
          onClick={() => setTreeView(!treeView())}
          class="text-xs px-1.5 py-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
          style={{ color: "var(--text-weak)" }}
        >
          {treeView() ? "Raw" : "Tree"}
        </button>
      </div>
      <Show
        when={treeView()}
        fallback={
          <pre
            class="font-mono text-code-sm"
            style={{
              color: "var(--text-base)",
              background: "var(--surface-raised)",
              padding: "8px",
              "border-radius": "var(--cortex-radius-sm)",
              overflow: "auto",
            }}
          >
            {JSON.stringify(props.data, null, 2)}
          </pre>
        }
      >
        <div
          style={{
            background: "var(--surface-raised)",
            padding: "8px",
            "border-radius": "var(--cortex-radius-sm)",
            overflow: "auto",
          }}
        >
          <JsonTreeNode label="root" data={props.data} depth={0} />
        </div>
      </Show>
    </div>
  );
}
