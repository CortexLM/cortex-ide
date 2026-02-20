import { Show, For, createSignal, createMemo } from "solid-js";
import { Icon } from "@/components/ui/Icon";

function stripAnsiCodes(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

interface TracebackFrameProps {
  line: string;
  index: number;
  defaultExpanded: boolean;
}

function TracebackFrame(props: TracebackFrameProps) {
  const [expanded, setExpanded] = createSignal(props.defaultExpanded);
  const stripped = createMemo(() => stripAnsiCodes(props.line));
  const isFrameHeader = createMemo(() =>
    /^\s*(File |Traceback |---+>|Cell )/.test(stripped()),
  );
  const isCollapsible = createMemo(() => stripped().length > 120 || isFrameHeader());

  return (
    <div>
      <Show
        when={isCollapsible()}
        fallback={
          <span class="font-mono text-code-sm" style={{ color: "var(--cortex-error)" }}>
            {stripped()}
          </span>
        }
      >
        <div
          class="flex items-start gap-1 cursor-pointer select-none"
          onClick={() => setExpanded(!expanded())}
        >
          <Show when={expanded()} fallback={<Icon name="chevron-right" class="w-3 h-3 mt-0.5 shrink-0" />}>
            <Icon name="chevron-down" class="w-3 h-3 mt-0.5 shrink-0" />
          </Show>
          <span
            class="font-mono text-code-sm"
            style={{
              color: "var(--cortex-error)",
              "white-space": expanded() ? "pre-wrap" : "nowrap",
              overflow: expanded() ? "visible" : "hidden",
              "text-overflow": expanded() ? "clip" : "ellipsis",
              "max-width": expanded() ? "none" : "100%",
              display: "block",
            }}
          >
            {stripped()}
          </span>
        </div>
      </Show>
    </div>
  );
}

export interface ErrorOutputProps {
  name: string;
  message: string;
  traceback: string[];
}

export function ErrorOutput(props: ErrorOutputProps) {
  const [allExpanded, setAllExpanded] = createSignal(true);

  const hasTraceback = createMemo(() => props.traceback.length > 0);
  const isLongTraceback = createMemo(() => props.traceback.length > 5);

  return (
    <div class="notebook-error-output" style={{ padding: "4px 0" }}>
      <div
        class="font-mono text-sm font-semibold mb-1"
        style={{ color: "var(--error)" }}
      >
        {props.name}: {props.message}
      </div>
      <Show when={hasTraceback()}>
        <Show when={isLongTraceback()}>
          <button
            onClick={() => setAllExpanded(!allExpanded())}
            class="text-[10px] px-1.5 py-0.5 rounded mb-1 hover:bg-[var(--surface-hover)] transition-colors"
            style={{ color: "var(--text-weak)" }}
          >
            {allExpanded() ? "Collapse all frames" : "Expand all frames"}
          </button>
        </Show>
        <div
          style={{
            margin: 0,
            "word-break": "break-all",
          }}
        >
          <For each={props.traceback}>
            {(line, index) => (
              <TracebackFrame
                line={line}
                index={index()}
                defaultExpanded={allExpanded()}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
