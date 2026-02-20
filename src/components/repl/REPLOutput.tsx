import { Show, For, Switch, Match } from "solid-js";
import { SafeHTML } from "../ui/SafeHTML";
import type { CellOutput } from "@/context/REPLContext";

interface REPLOutputProps {
  output: CellOutput;
}

function TextOutput(props: { content: string; isError?: boolean }) {
  return (
    <pre
      class="font-mono text-sm whitespace-pre-wrap break-all"
      style={{
        color: props.isError ? "var(--cortex-error)" : "var(--text-base)",
        margin: 0,
        padding: "4px 0",
      }}
    >
      {props.content}
    </pre>
  );
}

function HtmlOutput(props: { content: string }) {
  return (
    <SafeHTML
      class="repl-html-output"
      html={props.content}
      style={{
        "max-width": "100%",
        overflow: "auto",
      }}
    />
  );
}

function ImageOutput(props: { mimeType: string; data: string }) {
  const src = () => {
    if (props.data.startsWith("data:")) {
      return props.data;
    }
    return `data:${props.mimeType};base64,${props.data}`;
  };

  return (
    <img
      src={src()}
      alt="Output image"
      style={{
        "max-width": "100%",
        height: "auto",
        "border-radius": "var(--cortex-radius-sm)",
      }}
    />
  );
}

function JsonOutput(props: { data: Record<string, unknown> }) {
  return (
    <pre
      class="font-mono text-sm"
      style={{
        color: "var(--text-base)",
        background: "var(--surface-raised)",
        padding: "8px",
        "border-radius": "var(--cortex-radius-sm)",
        overflow: "auto",
        margin: 0,
      }}
    >
      {JSON.stringify(props.data, null, 2)}
    </pre>
  );
}

function ErrorOutput(props: { name: string; message: string; traceback: string[] }) {
  return (
    <div class="error-output">
      <div
        class="font-mono text-sm font-semibold mb-1"
        style={{ color: "var(--cortex-error)" }}
      >
        {props.name}: {props.message}
      </div>
      <Show when={props.traceback.length > 0}>
        <pre
          class="font-mono text-xs"
          style={{
            color: "var(--cortex-error)",
            margin: 0,
            "white-space": "pre-wrap",
          }}
        >
          {props.traceback.join("\n")}
        </pre>
      </Show>
    </div>
  );
}

export function REPLOutput(props: REPLOutputProps) {
  const content = () => props.output.content;
  const outputType = () => props.output.output_type;

  return (
    <div
      class="repl-output"
      style={{
        padding: "4px 0",
      }}
    >
      <Switch fallback={<TextOutput content={String(content().data)} />}>
        <Match when={content().type === "text"}>
          <TextOutput
            content={content().data as string}
            isError={outputType() === "stderr" || outputType() === "error"}
          />
        </Match>
        <Match when={content().type === "html"}>
          <HtmlOutput content={content().data as string} />
        </Match>
        <Match when={content().type === "image"}>
          {(() => {
            const data = content().data as { mime_type: string; data: string };
            return <ImageOutput mimeType={data.mime_type} data={data.data} />;
          })()}
        </Match>
        <Match when={content().type === "json"}>
          <JsonOutput data={content().data as Record<string, unknown>} />
        </Match>
        <Match when={content().type === "error"}>
          {(() => {
            const errData = content().data as { name: string; message: string; traceback: string[] };
            return (
              <ErrorOutput
                name={errData.name}
                message={errData.message}
                traceback={errData.traceback}
              />
            );
          })()}
        </Match>
      </Switch>
    </div>
  );
}

interface REPLOutputListProps {
  outputs: CellOutput[];
}

export function REPLOutputList(props: REPLOutputListProps) {
  return (
    <Show when={props.outputs.length > 0}>
      <div
        class="repl-output-list"
        style={{
          "border-top": "1px solid var(--border-base)",
          "padding-top": "8px",
          "margin-top": "8px",
        }}
      >
        <For each={props.outputs}>
          {(output) => <REPLOutput output={output} />}
        </For>
      </div>
    </Show>
  );
}

