import { For, createMemo } from "solid-js";

interface AnsiSegment {
  text: string;
  color?: string;
  background?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

const ANSI_COLORS: Record<number, string> = {
  30: "#1e1e1e", 31: "#cd3131", 32: "#0dbc79", 33: "#e5e510",
  34: "#2472c8", 35: "#bc3fbc", 36: "#11a8cd", 37: "#e5e5e5",
  90: "#666666", 91: "#f14c4c", 92: "#23d18b", 93: "#f5f543",
  94: "#3b8eea", 95: "#d670d6", 96: "#29b8db", 97: "#ffffff",
};

const ANSI_BG_COLORS: Record<number, string> = {
  40: "#1e1e1e", 41: "#cd3131", 42: "#0dbc79", 43: "#e5e510",
  44: "#2472c8", 45: "#bc3fbc", 46: "#11a8cd", 47: "#e5e5e5",
  100: "#666666", 101: "#f14c4c", 102: "#23d18b", 103: "#f5f543",
  104: "#3b8eea", 105: "#d670d6", 106: "#29b8db", 107: "#ffffff",
};

function parseAnsi(text: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  const regex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let currentColor: string | undefined;
  let currentBg: string | undefined;
  let bold = false;
  let italic = false;
  let underline = false;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        color: currentColor,
        background: currentBg,
        bold,
        italic,
        underline,
      });
    }

    const codes = match[1].split(";").map(Number);
    for (const code of codes) {
      if (code === 0) {
        currentColor = undefined;
        currentBg = undefined;
        bold = false;
        italic = false;
        underline = false;
      } else if (code === 1) {
        bold = true;
      } else if (code === 3) {
        italic = true;
      } else if (code === 4) {
        underline = true;
      } else if (ANSI_COLORS[code]) {
        currentColor = ANSI_COLORS[code];
      } else if (ANSI_BG_COLORS[code]) {
        currentBg = ANSI_BG_COLORS[code];
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      color: currentColor,
      background: currentBg,
      bold,
      italic,
      underline,
    });
  }

  return segments;
}

export interface AnsiOutputProps {
  content: string;
}

export function AnsiOutput(props: AnsiOutputProps) {
  const segments = createMemo(() => parseAnsi(props.content));

  return (
    <pre
      class="font-mono text-code-sm whitespace-pre-wrap break-words"
      style={{ margin: 0, padding: "4px 0", "line-height": "1.5" }}
    >
      <For each={segments()}>
        {(segment) => (
          <span
            style={{
              color: segment.color,
              background: segment.background,
              "font-weight": segment.bold ? "bold" : undefined,
              "font-style": segment.italic ? "italic" : undefined,
              "text-decoration": segment.underline ? "underline" : undefined,
            }}
          >
            {segment.text}
          </span>
        )}
      </For>
    </pre>
  );
}
