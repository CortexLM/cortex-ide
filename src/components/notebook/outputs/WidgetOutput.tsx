import { Show, For, createSignal } from "solid-js";
import { Icon } from "@/components/ui/Icon";

function WidgetTreeNode(props: { label: string; data: unknown; depth: number }) {
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
            <WidgetTreeNode label={key} data={value} depth={props.depth + 1} />
          )}
        </For>
      </Show>
    </div>
  );
}

export interface WidgetOutputProps {
  data: Record<string, unknown>;
}

export function WidgetOutput(props: WidgetOutputProps) {
  const modelId = () => (props.data.model_id as string) || "unknown";
  const modelName = () => (props.data.model_name as string) || "Widget";

  return (
    <div style={{ margin: "4px 0" }}>
      <div
        class="flex items-center gap-2 px-3 py-2 rounded-t"
        style={{
          background: "var(--surface-raised)",
          "border-bottom": "1px solid var(--border-weak)",
        }}
      >
        <Icon name="puzzle-piece" class="w-3.5 h-3.5" style={{ color: "var(--cortex-info)" }} />
        <span class="text-xs font-medium" style={{ color: "var(--text-base)" }}>
          {modelName()}
        </span>
        <span class="text-[10px]" style={{ color: "var(--text-weaker)" }}>
          (id: {modelId()})
        </span>
      </div>
      <div
        style={{
          background: "var(--surface-raised)",
          padding: "8px",
          "border-radius": "0 0 var(--cortex-radius-sm) var(--cortex-radius-sm)",
          overflow: "auto",
          "max-height": "300px",
        }}
      >
        <div class="text-[10px] mb-2" style={{ color: "var(--text-weaker)" }}>
          Interactive widget display requires a running widget manager. Showing widget state:
        </div>
        <WidgetTreeNode label="state" data={props.data} depth={0} />
      </div>
    </div>
  );
}
