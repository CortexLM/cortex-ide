import { For, Show } from "solid-js";
import { tokens } from "@/design-system/tokens";

export interface WordChange {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface DiffLineProps {
  type: "context" | "addition" | "deletion" | "header";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  wordDiff?: { old: WordChange[]; new: WordChange[] } | null;
  viewMode: "unified" | "split";
}

export function getLineBackground(type: string): string {
  switch (type) {
    case "addition": return "rgba(46, 160, 67, 0.15)";
    case "deletion": return "rgba(248, 81, 73, 0.15)";
    default: return "transparent";
  }
}

export function getLineColor(type: string): string {
  switch (type) {
    case "addition": return tokens.colors.semantic.success;
    case "deletion": return tokens.colors.semantic.error;
    default: return tokens.colors.text.primary;
  }
}

export function getLinePrefix(type: string): string {
  switch (type) {
    case "addition": return "+";
    case "deletion": return "-";
    default: return " ";
  }
}

export function computeWordDiff(
  oldLine: string,
  newLine: string
): { old: WordChange[]; new: WordChange[] } {
  const oldWords = oldLine.split(/(\s+)/);
  const newWords = newLine.split(/(\s+)/);
  const oldResult: WordChange[] = [];
  const newResult: WordChange[] = [];
  let i = 0, j = 0;
  while (i < oldWords.length || j < newWords.length) {
    if (i >= oldWords.length) {
      newResult.push({ value: newWords[j], added: true });
      j++;
    } else if (j >= newWords.length) {
      oldResult.push({ value: oldWords[i], removed: true });
      i++;
    } else if (oldWords[i] === newWords[j]) {
      oldResult.push({ value: oldWords[i] });
      newResult.push({ value: newWords[j] });
      i++; j++;
    } else {
      oldResult.push({ value: oldWords[i], removed: true });
      newResult.push({ value: newWords[j], added: true });
      i++; j++;
    }
  }
  return { old: oldResult, new: newResult };
}

function WordDiffContent(props: { words: WordChange[]; type: "addition" | "deletion" }) {
  return (
    <For each={props.words}>
      {(word) => {
        const isHighlighted = props.type === "addition" ? word.added : word.removed;
        return (
          <span style={{
            background: isHighlighted
              ? (props.type === "addition"
                ? `color-mix(in srgb, ${tokens.colors.semantic.success} 40%, transparent)`
                : `color-mix(in srgb, ${tokens.colors.semantic.error} 40%, transparent)`)
              : "transparent",
            "border-radius": isHighlighted ? "2px" : "0",
          }}>
            {word.value}
          </span>
        );
      }}
    </For>
  );
}

export function DiffLine(props: DiffLineProps) {
  return (
    <div class="flex" style={{ background: getLineBackground(props.type) }}>
      <span
        class="w-12 shrink-0 text-right pr-2 select-none"
        style={{ color: tokens.colors.text.muted }}
      >
        {props.type !== "addition" ? props.oldLineNumber : ""}
      </span>
      <Show when={props.viewMode === "unified"}>
        <span
          class="w-12 shrink-0 text-right pr-2 select-none border-r"
          style={{ color: tokens.colors.text.muted, "border-color": tokens.colors.border.divider }}
        >
          {props.type !== "deletion" ? props.newLineNumber : ""}
        </span>
      </Show>
      <pre class="flex-1 px-3 py-0" style={{ color: getLineColor(props.type) }}>
        <span class="select-none">{getLinePrefix(props.type)}</span>
        <Show
          when={props.wordDiff}
          fallback={props.content}
        >
          <WordDiffContent
            words={props.type === "deletion" ? props.wordDiff!.old : props.wordDiff!.new}
            type={props.type as "addition" | "deletion"}
          />
        </Show>
      </pre>
    </div>
  );
}
