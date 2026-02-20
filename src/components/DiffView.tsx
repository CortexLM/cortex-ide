import { For, createMemo } from "solid-js";
import { parsePatch } from "diff";

interface DiffViewProps {
  patch: string;
}

interface DiffLine {
  type: "add" | "remove" | "context" | "header";
  content: string;
  oldLine?: number;
  newLine?: number;
}

export function DiffView(props: DiffViewProps) {
  const parsedDiff = createMemo(() => {
    try {
      return parsePatch(props.patch);
    } catch {
      return [];
    }
  });

  const getLines = (diff: any): DiffLine[] => {
    const lines: DiffLine[] = [];
    
    lines.push({
      type: "header",
      content: `--- ${diff.oldFileName || "a"}`,
    });
    lines.push({
      type: "header", 
      content: `+++ ${diff.newFileName || "b"}`,
    });

    for (const hunk of diff.hunks) {
      lines.push({
        type: "header",
        content: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
      });

      let oldLine = hunk.oldStart;
      let newLine = hunk.newStart;

      for (const line of hunk.lines) {
        if (line.startsWith("+")) {
          lines.push({
            type: "add",
            content: line.slice(1),
            newLine: newLine++,
          });
        } else if (line.startsWith("-")) {
          lines.push({
            type: "remove",
            content: line.slice(1),
            oldLine: oldLine++,
          });
        } else {
          lines.push({
            type: "context",
            content: line.slice(1),
            oldLine: oldLine++,
            newLine: newLine++,
          });
        }
      }
    }

    return lines;
  };

  return (
    <div class="rounded-lg border border-border overflow-hidden bg-background font-mono text-sm">
      <For each={parsedDiff()}>
        {(diff) => (
          <div class="divide-y divide-border">
            <For each={getLines(diff)}>
              {(line) => (
                <div
                  class={`flex ${getLineClass(line.type)}`}
                >
                  <div class="w-12 flex-shrink-0 select-none px-2 py-0.5 text-right text-foreground-muted border-r border-border">
                    {line.type === "header" ? "" : (line.oldLine || line.newLine || "")}
                  </div>
                  <div class="w-12 flex-shrink-0 select-none px-2 py-0.5 text-right text-foreground-muted border-r border-border">
                    {line.type === "header" ? "" : (line.newLine || "")}
                  </div>
                  <div class="flex-1 px-2 py-0.5 whitespace-pre overflow-x-auto">
                    <span class={`mr-2 select-none ${getSymbolClass(line.type)}`}>
                      {getSymbol(line.type)}
                    </span>
                    {line.content}
                  </div>
                </div>
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  );
}

function getLineClass(type: DiffLine["type"]): string {
  switch (type) {
    case "add":
      return "bg-diff-added-bg";
    case "remove":
      return "bg-diff-removed-bg";
    case "header":
      return "bg-background-tertiary text-foreground-muted";
    default:
      return "";
  }
}

function getSymbol(type: DiffLine["type"]): string {
  switch (type) {
    case "add":
      return "+";
    case "remove":
      return "-";
    case "header":
      return "";
    default:
      return " ";
  }
}

function getSymbolClass(type: DiffLine["type"]): string {
  switch (type) {
    case "add":
      return "text-diff-added";
    case "remove":
      return "text-diff-removed";
    default:
      return "";
  }
}
