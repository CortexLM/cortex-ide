import { createSignal, createEffect, For, Show, createMemo } from "solid-js";
import { useOutput, type OutputLine } from "@/context/OutputContext";

interface AnsiStyle {
  color?: string;
  background?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  dim?: boolean;
}

const ANSI_COLORS: Record<number, string> = {
  30: "var(--cortex-ansi-black, #1e1e1e)",
  31: "var(--cortex-ansi-red, #f44747)",
  32: "var(--cortex-ansi-green, #6a9955)",
  33: "var(--cortex-ansi-yellow, #dcdcaa)",
  34: "var(--cortex-ansi-blue, #569cd6)",
  35: "var(--cortex-ansi-magenta, #c586c0)",
  36: "var(--cortex-ansi-cyan, #4ec9b0)",
  37: "var(--cortex-ansi-white, #d4d4d4)",
  90: "var(--cortex-ansi-bright-black, #808080)",
  91: "var(--cortex-ansi-bright-red, #f14c4c)",
  92: "var(--cortex-ansi-bright-green, #73c991)",
  93: "var(--cortex-ansi-bright-yellow, #e2e210)",
  94: "var(--cortex-ansi-bright-blue, #3794ff)",
  95: "var(--cortex-ansi-bright-magenta, #d670d6)",
  96: "var(--cortex-ansi-bright-cyan, #29b8db)",
  97: "var(--cortex-ansi-bright-white, #ffffff)",
};

const ANSI_BG_COLORS: Record<number, string> = {
  40: "var(--cortex-ansi-black, #1e1e1e)",
  41: "var(--cortex-ansi-red, #f44747)",
  42: "var(--cortex-ansi-green, #6a9955)",
  43: "var(--cortex-ansi-yellow, #dcdcaa)",
  44: "var(--cortex-ansi-blue, #569cd6)",
  45: "var(--cortex-ansi-magenta, #c586c0)",
  46: "var(--cortex-ansi-cyan, #4ec9b0)",
  47: "var(--cortex-ansi-white, #d4d4d4)",
  100: "var(--cortex-ansi-bright-black, #808080)",
  101: "var(--cortex-ansi-bright-red, #f14c4c)",
  102: "var(--cortex-ansi-bright-green, #73c991)",
  103: "var(--cortex-ansi-bright-yellow, #e2e210)",
  104: "var(--cortex-ansi-bright-blue, #3794ff)",
  105: "var(--cortex-ansi-bright-magenta, #d670d6)",
  106: "var(--cortex-ansi-bright-cyan, #29b8db)",
  107: "var(--cortex-ansi-bright-white, #ffffff)",
};

interface ParsedSegment {
  text: string;
  style: AnsiStyle;
}

function parseAnsiCodes(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const ansiRegex = /\x1b\[([0-9;]*)m/g;
  let currentStyle: AnsiStyle = {};
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        style: { ...currentStyle },
      });
    }

    const codes = match[1].split(";").map(Number);
    for (const code of codes) {
      if (code === 0) {
        currentStyle = {};
      } else if (code === 1) {
        currentStyle.bold = true;
      } else if (code === 2) {
        currentStyle.dim = true;
      } else if (code === 3) {
        currentStyle.italic = true;
      } else if (code === 4) {
        currentStyle.underline = true;
      } else if (code === 9) {
        currentStyle.strikethrough = true;
      } else if (code === 22) {
        currentStyle.bold = false;
        currentStyle.dim = false;
      } else if (code === 23) {
        currentStyle.italic = false;
      } else if (code === 24) {
        currentStyle.underline = false;
      } else if (code === 29) {
        currentStyle.strikethrough = false;
      } else if (code >= 30 && code <= 37) {
        currentStyle.color = ANSI_COLORS[code];
      } else if (code >= 90 && code <= 97) {
        currentStyle.color = ANSI_COLORS[code];
      } else if (code === 39) {
        currentStyle.color = undefined;
      } else if (code >= 40 && code <= 47) {
        currentStyle.background = ANSI_BG_COLORS[code];
      } else if (code >= 100 && code <= 107) {
        currentStyle.background = ANSI_BG_COLORS[code];
      } else if (code === 49) {
        currentStyle.background = undefined;
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      style: { ...currentStyle },
    });
  }

  return segments;
}

function getStyleString(style: AnsiStyle): string {
  const styles: string[] = [];
  if (style.color) styles.push(`color: ${style.color}`);
  if (style.background) styles.push(`background: ${style.background}`);
  if (style.bold) styles.push("font-weight: bold");
  if (style.dim) styles.push("opacity: 0.7");
  if (style.italic) styles.push("font-style: italic");
  if (style.underline) styles.push("text-decoration: underline");
  if (style.strikethrough) styles.push("text-decoration: line-through");
  return styles.join("; ");
}

export interface OutputChannelProps {
  channelName: string;
  lockScroll?: boolean;
  filterText?: string;
}

export function OutputChannel(props: OutputChannelProps) {
  const output = useOutput();
  let containerRef: HTMLDivElement | undefined;
  const [autoScroll, setAutoScroll] = createSignal(true);

  const filteredLines = createMemo(() => {
    const lines = output.getFilteredLines(props.channelName);
    const filter = props.filterText?.toLowerCase();
    if (!filter) return lines;
    return lines.filter((line) => line.text.toLowerCase().includes(filter));
  });

  createEffect(() => {
    filteredLines();
    if (autoScroll() && !props.lockScroll && containerRef) {
      requestAnimationFrame(() => {
        if (containerRef) {
          containerRef.scrollTop = containerRef.scrollHeight;
        }
      });
    }
  });

  const handleScroll = () => {
    if (!containerRef) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const getSeverityColor = (severity?: OutputLine["severity"]): string => {
    switch (severity) {
      case "error":
        return "var(--cortex-error, #f44747)";
      case "warning":
        return "var(--cortex-warning, #dcdcaa)";
      case "success":
        return "var(--cortex-success, #6a9955)";
      default:
        return "inherit";
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        flex: "1",
        overflow: "auto",
        "font-family": "var(--cortex-font-mono, 'JetBrains Mono', monospace)",
        "font-size": "12px",
        "line-height": "1.5",
        padding: "8px 12px",
        background: "var(--cortex-bg-primary)",
      }}
    >
      <Show
        when={filteredLines().length > 0}
        fallback={
          <div
            style={{
              color: "var(--cortex-text-inactive)",
              "font-style": "italic",
              padding: "16px",
              "text-align": "center",
            }}
          >
            No output
          </div>
        }
      >
        <For each={filteredLines()}>
          {(line) => {
            const segments = parseAnsiCodes(line.text);
            return (
              <div
                style={{
                  display: "flex",
                  "white-space": "pre-wrap",
                  "word-break": "break-all",
                  color: getSeverityColor(line.severity),
                }}
              >
                <Show when={line.source}>
                  <span
                    style={{
                      color: "var(--cortex-text-inactive)",
                      "margin-right": "8px",
                      "flex-shrink": "0",
                    }}
                  >
                    [{line.source}]
                  </span>
                </Show>
                <span style={{ flex: "1" }}>
                  <For each={segments}>
                    {(segment) => (
                      <span style={getStyleString(segment.style)}>{segment.text}</span>
                    )}
                  </For>
                </span>
              </div>
            );
          }}
        </For>
      </Show>
    </div>
  );
}

export default OutputChannel;
