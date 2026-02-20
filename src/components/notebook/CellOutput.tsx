import { Show, For, createSignal, createMemo } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { SafeHTML } from "@/components/ui/SafeHTML";
import { Markdown } from "@/components/Markdown";
import type {
  CellOutput as CellOutputType,
  StreamOutput,
  ExecuteResultOutput,
  DisplayDataOutput,
  ErrorOutput as ErrorOutputType,
} from "@/context/NotebookContext";

function stripAnsiCodes(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function TextOutput(props: { content: string; isError?: boolean }) {
  return (
    <pre
      class="font-mono text-code-sm whitespace-pre-wrap break-words"
      style={{
        color: props.isError ? "var(--error)" : "var(--text-base)",
        margin: 0,
        padding: "4px 0",
        "line-height": "1.5",
      }}
    >
      {stripAnsiCodes(props.content)}
    </pre>
  );
}

function HtmlOutput(props: { content: string }) {
  return (
    <SafeHTML
      html={props.content}
      class="notebook-html-output prose prose-invert max-w-none"
      style={{
        "max-width": "100%",
        overflow: "auto",
      }}
    />
  );
}

function ImageOutput(props: { mimeType: string; data: string }) {
  const src = createMemo(() => {
    if (props.data.startsWith("data:")) {
      return props.data;
    }
    return `data:${props.mimeType};base64,${props.data}`;
  });

  return (
    <img
      src={src()}
      alt="Cell output"
      style={{
        "max-width": "100%",
        height: "auto",
        "border-radius": "var(--cortex-radius-sm)",
        "margin-top": "8px",
      }}
    />
  );
}

function SvgOutput(props: { content: string }) {
  return (
    <SafeHTML
      html={props.content}
      class="notebook-svg-output"
      style={{
        "max-width": "100%",
        overflow: "auto",
      }}
    />
  );
}

function JsonTreeNode(props: { label: string; data: unknown; depth: number }) {
  const [collapsed, setCollapsed] = createSignal(props.depth > 1);
  const isExpandable = () =>
    props.data !== null &&
    typeof props.data === "object";

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

function JsonOutput(props: { data: unknown }) {
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

function ErrorOutputDisplay(props: { name: string; message: string; traceback: string[] }) {
  return (
    <div class="notebook-error-output" style={{ padding: "4px 0" }}>
      <div
        class="font-mono text-sm font-semibold mb-1"
        style={{ color: "var(--error)" }}
      >
        {props.name}: {props.message}
      </div>
      <Show when={props.traceback.length > 0}>
        <pre
          class="font-mono text-code-sm"
          style={{
            color: "var(--cortex-error)",
            margin: 0,
            "white-space": "pre-wrap",
            "word-break": "break-all",
          }}
        >
          {props.traceback.map(stripAnsiCodes).join("\n")}
        </pre>
      </Show>
    </div>
  );
}

function resolveDataField(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value.join("") : value;
}

function CellOutputRenderer(props: { output: CellOutputType }) {
  const getOutputContent = () => {
    const output = props.output;

    if (output.output_type === "error") {
      const err = output as ErrorOutputType;
      return (
        <ErrorOutputDisplay
          name={err.ename}
          message={err.evalue}
          traceback={err.traceback}
        />
      );
    }

    if (output.output_type === "stream") {
      const stream = output as StreamOutput;
      return <TextOutput content={stream.text} isError={stream.name === "stderr"} />;
    }

    if (output.output_type === "execute_result" || output.output_type === "display_data") {
      const rich = output as ExecuteResultOutput | DisplayDataOutput;
      const data = rich.data;

      if (data["text/html"]) return <HtmlOutput content={resolveDataField(data["text/html"])} />;
      if (data["image/svg+xml"]) return <SvgOutput content={resolveDataField(data["image/svg+xml"])} />;
      if (data["image/png"]) return <ImageOutput mimeType="image/png" data={resolveDataField(data["image/png"])} />;
      if (data["image/jpeg"]) return <ImageOutput mimeType="image/jpeg" data={resolveDataField(data["image/jpeg"])} />;
      if (data["image/gif"]) return <ImageOutput mimeType="image/gif" data={resolveDataField(data["image/gif"])} />;
      if (data["application/json"]) return <JsonOutput data={data["application/json"]} />;
      if (data["text/latex"]) {
        return (
          <pre
            class="font-mono text-code-sm"
            style={{ color: "var(--text-base)", margin: "4px 0" }}
          >
            {resolveDataField(data["text/latex"])}
          </pre>
        );
      }
      if (data["text/markdown"]) return <Markdown content={resolveDataField(data["text/markdown"])} />;
      if (data["text/plain"]) return <TextOutput content={resolveDataField(data["text/plain"])} />;
    }

    return null;
  };

  return <>{getOutputContent()}</>;
}

export interface CellOutputAreaProps {
  outputs: CellOutputType[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function CellOutputArea(props: CellOutputAreaProps) {
  const outputCount = () => props.outputs.length;

  return (
    <Show when={outputCount() > 0}>
      <div
        class="cell-output-area"
        style={{
          "border-top": "1px solid var(--border-weak)",
          "margin-top": "8px",
        }}
      >
        <div
          class="flex items-center gap-2 py-1 cursor-pointer select-none"
          style={{ color: "var(--text-weak)" }}
          onClick={() => props.onToggleCollapse()}
        >
          <Show when={props.isCollapsed} fallback={<Icon name="chevron-down" class="w-3 h-3" />}>
            <Icon name="chevron-right" class="w-3 h-3" />
          </Show>
          <span class="text-xs">
            {outputCount()} output{outputCount() > 1 ? "s" : ""}
            {props.isCollapsed ? " (collapsed)" : ""}
          </span>
        </div>

        <Show when={!props.isCollapsed}>
          <div class="cell-outputs pt-2">
            <For each={props.outputs}>
              {(output) => <CellOutputRenderer output={output} />}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  );
}

export { CellOutputRenderer };
