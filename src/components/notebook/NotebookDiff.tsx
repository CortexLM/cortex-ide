import {
  Show,
  For,
  Switch,
  Match,
  createSignal,
  createMemo,
  createEffect,
} from "solid-js";
import { Icon } from "../ui/Icon";
import { diffLines, diffWords, type Change } from "diff";

// ============================================================================
// Types
// ============================================================================

type CellType = "markdown" | "code" | "raw";

interface NotebookCellOutput {
  output_type: "stream" | "execute_result" | "display_data" | "error";
  name?: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

interface NotebookCell {
  id: string;
  cell_type: CellType;
  source: string[];
  metadata: Record<string, unknown>;
  outputs?: NotebookCellOutput[];
  execution_count?: number | null;
}

interface JupyterNotebook {
  nbformat: number;
  nbformat_minor: number;
  metadata: Record<string, unknown>;
  cells: NotebookCell[];
}

type DiffStatus = "added" | "removed" | "modified" | "unchanged";

interface CellDiff {
  status: DiffStatus;
  leftCell: NotebookCell | null;
  rightCell: NotebookCell | null;
  leftIndex: number;
  rightIndex: number;
  contentChanges: Change[];
  outputChanges: OutputDiff[];
}

interface OutputDiff {
  status: DiffStatus;
  leftOutput: NotebookCellOutput | null;
  rightOutput: NotebookCellOutput | null;
  textChanges: Change[];
}

export interface NotebookDiffProps {
  leftContent: string;
  rightContent: string;
  leftLabel?: string;
  rightLabel?: string;
  onAcceptLeft?: (cellIndex: number) => void;
  onAcceptRight?: (cellIndex: number) => void;
  onAcceptAll?: (side: "left" | "right") => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

function joinSource(source: string | string[]): string {
  return Array.isArray(source) ? source.join("") : source;
}

function parseNotebook(content: string): JupyterNotebook | null {
  try {
    const notebook = JSON.parse(content) as JupyterNotebook;
    if (!notebook.cells || !Array.isArray(notebook.cells)) {
      return null;
    }
    return notebook;
  } catch {
    return null;
  }
}

function getOutputText(output: NotebookCellOutput): string {
  if (output.output_type === "stream") {
    return Array.isArray(output.text) ? output.text.join("") : output.text || "";
  }
  if (output.output_type === "error") {
    return `${output.ename}: ${output.evalue}\n${(output.traceback || []).join("\n")}`;
  }
  if (output.data) {
    if (output.data["text/plain"]) {
      const text = output.data["text/plain"];
      return Array.isArray(text) ? text.join("") : text;
    }
    if (output.data["text/html"]) {
      const html = output.data["text/html"];
      return Array.isArray(html) ? html.join("") : html;
    }
    return JSON.stringify(output.data, null, 2);
  }
  return "";
}

function computeCellFingerprint(cell: NotebookCell): string {
  return `${cell.cell_type}:${joinSource(cell.source).trim()}`;
}

function computeOutputFingerprint(output: NotebookCellOutput): string {
  return `${output.output_type}:${getOutputText(output).trim()}`;
}

function computeOutputDiffs(
  leftOutputs: NotebookCellOutput[],
  rightOutputs: NotebookCellOutput[]
): OutputDiff[] {
  const diffs: OutputDiff[] = [];
  const leftFingerprints = leftOutputs.map(computeOutputFingerprint);
  const rightFingerprints = rightOutputs.map(computeOutputFingerprint);
  const matchedRight = new Set<number>();

  for (let i = 0; i < leftOutputs.length; i++) {
    const leftFp = leftFingerprints[i];
    const matchIndex = rightFingerprints.findIndex(
      (fp, idx) => !matchedRight.has(idx) && fp === leftFp
    );

    if (matchIndex !== -1) {
      matchedRight.add(matchIndex);
      diffs.push({
        status: "unchanged",
        leftOutput: leftOutputs[i],
        rightOutput: rightOutputs[matchIndex],
        textChanges: [],
      });
    } else {
      const rightIdx = rightFingerprints.findIndex(
        (_, idx) =>
          !matchedRight.has(idx) &&
          rightOutputs[idx].output_type === leftOutputs[i].output_type
      );

      if (rightIdx !== -1) {
        matchedRight.add(rightIdx);
        const leftText = getOutputText(leftOutputs[i]);
        const rightText = getOutputText(rightOutputs[rightIdx]);
        diffs.push({
          status: "modified",
          leftOutput: leftOutputs[i],
          rightOutput: rightOutputs[rightIdx],
          textChanges: diffLines(leftText, rightText),
        });
      } else {
        diffs.push({
          status: "removed",
          leftOutput: leftOutputs[i],
          rightOutput: null,
          textChanges: [],
        });
      }
    }
  }

  for (let j = 0; j < rightOutputs.length; j++) {
    if (!matchedRight.has(j)) {
      diffs.push({
        status: "added",
        leftOutput: null,
        rightOutput: rightOutputs[j],
        textChanges: [],
      });
    }
  }

  return diffs;
}

function computeCellDiffs(
  leftCells: NotebookCell[],
  rightCells: NotebookCell[]
): CellDiff[] {
  const diffs: CellDiff[] = [];
  const leftFingerprints = leftCells.map(computeCellFingerprint);
  const rightFingerprints = rightCells.map(computeCellFingerprint);
  const matchedRight = new Set<number>();
  let leftIdx = 0;
  let rightIdx = 0;

  while (leftIdx < leftCells.length || rightIdx < rightCells.length) {
    if (leftIdx >= leftCells.length) {
      diffs.push({
        status: "added",
        leftCell: null,
        rightCell: rightCells[rightIdx],
        leftIndex: -1,
        rightIndex: rightIdx,
        contentChanges: [],
        outputChanges: computeOutputDiffs([], rightCells[rightIdx].outputs || []),
      });
      matchedRight.add(rightIdx);
      rightIdx++;
      continue;
    }

    if (rightIdx >= rightCells.length) {
      diffs.push({
        status: "removed",
        leftCell: leftCells[leftIdx],
        rightCell: null,
        leftIndex: leftIdx,
        rightIndex: -1,
        contentChanges: [],
        outputChanges: computeOutputDiffs(leftCells[leftIdx].outputs || [], []),
      });
      leftIdx++;
      continue;
    }

    const leftFp = leftFingerprints[leftIdx];
    const rightFp = rightFingerprints[rightIdx];

    if (leftFp === rightFp) {
      const leftOutputs = leftCells[leftIdx].outputs || [];
      const rightOutputs = rightCells[rightIdx].outputs || [];
      const outputDiffs = computeOutputDiffs(leftOutputs, rightOutputs);
      const hasOutputChanges = outputDiffs.some((d) => d.status !== "unchanged");

      diffs.push({
        status: hasOutputChanges ? "modified" : "unchanged",
        leftCell: leftCells[leftIdx],
        rightCell: rightCells[rightIdx],
        leftIndex: leftIdx,
        rightIndex: rightIdx,
        contentChanges: [],
        outputChanges: outputDiffs,
      });
      matchedRight.add(rightIdx);
      leftIdx++;
      rightIdx++;
      continue;
    }

    const rightMatchInLeft = rightFingerprints.findIndex(
      (fp, idx) => idx > rightIdx && !matchedRight.has(idx) && fp === leftFp
    );
    const leftMatchInRight = leftFingerprints.findIndex(
      (fp, idx) => idx > leftIdx && fp === rightFp
    );

    if (rightMatchInLeft === -1 && leftMatchInRight === -1) {
      const leftSource = joinSource(leftCells[leftIdx].source);
      const rightSource = joinSource(rightCells[rightIdx].source);
      const contentChanges = diffLines(leftSource, rightSource);
      const outputDiffs = computeOutputDiffs(
        leftCells[leftIdx].outputs || [],
        rightCells[rightIdx].outputs || []
      );

      diffs.push({
        status: "modified",
        leftCell: leftCells[leftIdx],
        rightCell: rightCells[rightIdx],
        leftIndex: leftIdx,
        rightIndex: rightIdx,
        contentChanges,
        outputChanges: outputDiffs,
      });
      matchedRight.add(rightIdx);
      leftIdx++;
      rightIdx++;
    } else if (rightMatchInLeft !== -1 && (leftMatchInRight === -1 || rightMatchInLeft - rightIdx <= leftMatchInRight - leftIdx)) {
      for (let j = rightIdx; j < rightMatchInLeft; j++) {
        if (!matchedRight.has(j)) {
          diffs.push({
            status: "added",
            leftCell: null,
            rightCell: rightCells[j],
            leftIndex: -1,
            rightIndex: j,
            contentChanges: [],
            outputChanges: computeOutputDiffs([], rightCells[j].outputs || []),
          });
          matchedRight.add(j);
        }
      }
      rightIdx = rightMatchInLeft;
    } else {
      diffs.push({
        status: "removed",
        leftCell: leftCells[leftIdx],
        rightCell: null,
        leftIndex: leftIdx,
        rightIndex: -1,
        contentChanges: [],
        outputChanges: computeOutputDiffs(leftCells[leftIdx].outputs || [], []),
      });
      leftIdx++;
    }
  }

  return diffs;
}

// ============================================================================
// Cell Type Badge Component
// ============================================================================

function CellTypeBadge(props: { cellType: CellType }) {
  const icon = () => {
    switch (props.cellType) {
      case "code":
        return <Icon name="code" class="w-3 h-3" />;
      case "markdown":
        return <Icon name="file-lines" class="w-3 h-3" />;
      case "raw":
        return <Icon name="font" class="w-3 h-3" />;
    }
  };

  const label = () => {
    switch (props.cellType) {
      case "code":
        return "Code";
      case "markdown":
        return "Markdown";
      case "raw":
        return "Raw";
    }
  };

  return (
    <div
      class="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
      style={{
        background: "var(--surface-raised)",
        color: "var(--text-weak)",
      }}
    >
      {icon()}
      <span>{label()}</span>
    </div>
  );
}

// ============================================================================
// Diff Status Badge Component
// ============================================================================

function DiffStatusBadge(props: { status: DiffStatus }) {
  const config = () => {
    switch (props.status) {
      case "added":
        return { icon: <Icon name="plus" class="w-3 h-3" />, label: "Added", color: "var(--success)" };
      case "removed":
        return { icon: <Icon name="minus" class="w-3 h-3" />, label: "Removed", color: "var(--error)" };
      case "modified":
        return { icon: <Icon name="pen" class="w-3 h-3" />, label: "Modified", color: "var(--warning)" };
      default:
        return { icon: <Icon name="check" class="w-3 h-3" />, label: "Unchanged", color: "var(--text-weak)" };
    }
  };

  return (
    <div
      class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{
        background: `color-mix(in srgb, ${config().color} 15%, transparent)`,
        color: config().color,
      }}
    >
      {config().icon}
      <span>{config().label}</span>
    </div>
  );
}

// ============================================================================
// Inline Diff Text Component
// ============================================================================

function InlineDiffText(props: { changes: Change[] }) {
  return (
    <pre
      class="font-mono text-code-sm whitespace-pre-wrap break-words m-0 p-2 rounded"
      style={{
        background: "var(--surface-base)",
        "line-height": "1.5",
      }}
    >
      <For each={props.changes}>
        {(change) => (
          <span
            style={{
              background: change.added
                ? "color-mix(in srgb, var(--success) 20%, transparent)"
                : change.removed
                ? "color-mix(in srgb, var(--error) 20%, transparent)"
                : "transparent",
              color: change.added
                ? "var(--success)"
                : change.removed
                ? "var(--error)"
                : "var(--text-base)",
              "text-decoration": change.removed ? "line-through" : "none",
            }}
          >
            {change.value}
          </span>
        )}
      </For>
    </pre>
  );
}

// ============================================================================
// Side-by-Side Diff Lines Component
// ============================================================================

function SideBySideDiffLines(props: { changes: Change[] }) {
  const lines = createMemo(() => {
    const leftLines: Array<{ text: string; type: "removed" | "context" }> = [];
    const rightLines: Array<{ text: string; type: "added" | "context" }> = [];

    for (const change of props.changes) {
      const changeLines = change.value.split("\n");
      if (change.value.endsWith("\n")) {
        changeLines.pop();
      }

      if (change.added) {
        for (const line of changeLines) {
          rightLines.push({ text: line, type: "added" });
        }
      } else if (change.removed) {
        for (const line of changeLines) {
          leftLines.push({ text: line, type: "removed" });
        }
      } else {
        for (const line of changeLines) {
          leftLines.push({ text: line, type: "context" });
          rightLines.push({ text: line, type: "context" });
        }
      }
    }

    const maxLen = Math.max(leftLines.length, rightLines.length);
    const paired: Array<{
      left: { text: string; type: "removed" | "context" } | null;
      right: { text: string; type: "added" | "context" } | null;
    }> = [];

    let li = 0;
    let ri = 0;

    while (li < leftLines.length || ri < rightLines.length) {
      const left = leftLines[li] || null;
      const right = rightLines[ri] || null;

      if (left?.type === "context" && right?.type === "context") {
        paired.push({ left, right });
        li++;
        ri++;
      } else if (left?.type === "removed") {
        paired.push({ left, right: null });
        li++;
      } else if (right?.type === "added") {
        paired.push({ left: null, right });
        ri++;
      } else {
        paired.push({ left, right });
        if (left) li++;
        if (right) ri++;
      }

      if (paired.length > maxLen + 100) break;
    }

    return paired;
  });

  return (
    <div
      class="grid gap-0 font-mono text-code-sm"
      style={{
        "grid-template-columns": "1fr 1fr",
      }}
    >
      <For each={lines()}>
        {(pair) => (
          <>
            <div
              class="px-2 py-0.5 border-r"
              style={{
                background: pair.left?.type === "removed"
                  ? "color-mix(in srgb, var(--error) 15%, transparent)"
                  : "transparent",
                color: pair.left?.type === "removed"
                  ? "var(--error)"
                  : "var(--text-base)",
                "border-color": "var(--border-weak)",
                "min-height": "1.5em",
              }}
            >
              <Show when={pair.left}>
                <span class="select-none opacity-50 mr-2 inline-block w-6 text-right">
                  {pair.left?.type === "removed" ? "-" : " "}
                </span>
                {pair.left?.text}
              </Show>
            </div>
            <div
              class="px-2 py-0.5"
              style={{
                background: pair.right?.type === "added"
                  ? "color-mix(in srgb, var(--success) 15%, transparent)"
                  : "transparent",
                color: pair.right?.type === "added"
                  ? "var(--success)"
                  : "var(--text-base)",
                "min-height": "1.5em",
              }}
            >
              <Show when={pair.right}>
                <span class="select-none opacity-50 mr-2 inline-block w-6 text-right">
                  {pair.right?.type === "added" ? "+" : " "}
                </span>
                {pair.right?.text}
              </Show>
            </div>
          </>
        )}
      </For>
    </div>
  );
}

// ============================================================================
// Cell Content Panel Component
// ============================================================================

function CellContentPanel(props: {
  cell: NotebookCell | null;
  side: "left" | "right";
  status: DiffStatus;
}) {
  const bgColor = () => {
    if (!props.cell) {
      return "var(--surface-base)";
    }
    switch (props.status) {
      case "added":
        return props.side === "right"
          ? "color-mix(in srgb, var(--success) 8%, var(--surface-base))"
          : "var(--surface-base)";
      case "removed":
        return props.side === "left"
          ? "color-mix(in srgb, var(--error) 8%, var(--surface-base))"
          : "var(--surface-base)";
      case "modified":
        return "color-mix(in srgb, var(--warning) 5%, var(--surface-base))";
      default:
        return "var(--surface-base)";
    }
  };

  return (
    <div
      class="flex-1 min-w-0 rounded"
      style={{
        background: bgColor(),
        border: `1px solid var(--border-weak)`,
      }}
    >
      <Show
        when={props.cell}
        fallback={
          <div
            class="flex items-center justify-center h-full min-h-[100px] text-sm"
            style={{ color: "var(--text-weaker)" }}
          >
            <Show
              when={props.status === "added"}
              fallback={
              <span class="flex items-center gap-2">
                  <Icon name="minus" class="w-4 h-4" style={{ color: "var(--error)" }} />
                  Cell removed
                </span>
              }
            >
              <span class="flex items-center gap-2">
                <Icon name="plus" class="w-4 h-4" style={{ color: "var(--success)" }} />
                Cell added
              </span>
            </Show>
          </div>
        }
      >
        <div class="p-3">
          <div class="flex items-center gap-2 mb-2">
            <CellTypeBadge cellType={props.cell!.cell_type} />
            <Show when={props.cell!.cell_type === "code" && props.cell!.execution_count != null}>
              <span
                class="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: "var(--surface-raised)",
                  color: "var(--text-weak)",
                }}
              >
                [{props.cell!.execution_count}]
              </span>
            </Show>
          </div>
          <pre
            class="font-mono text-code-sm whitespace-pre-wrap break-words m-0"
            style={{
              color: "var(--text-base)",
              "line-height": "1.5",
            }}
          >
            {joinSource(props.cell!.source)}
          </pre>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Output Diff Panel Component
// ============================================================================

function OutputDiffPanel(props: { outputDiffs: OutputDiff[] }) {
  const hasChanges = createMemo(() =>
    props.outputDiffs.some((d) => d.status !== "unchanged")
  );

  return (
    <Show when={props.outputDiffs.length > 0}>
      <div
        class="mt-2 rounded overflow-hidden"
        style={{
          border: "1px solid var(--border-weak)",
        }}
      >
        <div
          class="flex items-center gap-2 px-3 py-1.5"
          style={{
            background: "var(--surface-raised)",
            "border-bottom": "1px solid var(--border-weak)",
          }}
        >
          <span class="text-xs font-medium" style={{ color: "var(--text-weak)" }}>
            Outputs
          </span>
          <Show when={hasChanges()}>
            <DiffStatusBadge status="modified" />
          </Show>
        </div>
        <div class="p-2">
          <For each={props.outputDiffs}>
            {(outputDiff, index) => (
              <div
                class="mb-2 last:mb-0 rounded overflow-hidden"
                style={{
                  border: "1px solid var(--border-weak)",
                }}
              >
                <Show when={outputDiff.status !== "unchanged"}>
                  <div
                    class="flex items-center gap-2 px-2 py-1"
                    style={{
                      background: "var(--surface-base)",
                      "border-bottom": "1px solid var(--border-weak)",
                    }}
                  >
                    <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
                      Output {index() + 1}
                    </span>
                    <DiffStatusBadge status={outputDiff.status} />
                  </div>
                </Show>
                <Switch>
                  <Match when={outputDiff.status === "modified" && outputDiff.textChanges.length > 0}>
                    <SideBySideDiffLines changes={outputDiff.textChanges} />
                  </Match>
                  <Match when={outputDiff.status === "added" && outputDiff.rightOutput}>
                    <div
                      class="p-2"
                      style={{
                        background: "color-mix(in srgb, var(--success) 10%, transparent)",
                      }}
                    >
                      <pre
                        class="font-mono text-code-sm whitespace-pre-wrap m-0"
                        style={{ color: "var(--success)" }}
                      >
                        {getOutputText(outputDiff.rightOutput!)}
                      </pre>
                    </div>
                  </Match>
                  <Match when={outputDiff.status === "removed" && outputDiff.leftOutput}>
                    <div
                      class="p-2"
                      style={{
                        background: "color-mix(in srgb, var(--error) 10%, transparent)",
                      }}
                    >
                      <pre
                        class="font-mono text-code-sm whitespace-pre-wrap m-0"
                        style={{ color: "var(--error)", "text-decoration": "line-through" }}
                      >
                        {getOutputText(outputDiff.leftOutput!)}
                      </pre>
                    </div>
                  </Match>
                  <Match when={outputDiff.status === "unchanged"}>
                    <div class="p-2">
                      <pre
                        class="font-mono text-code-sm whitespace-pre-wrap m-0"
                        style={{ color: "var(--text-base)" }}
                      >
                        {getOutputText(outputDiff.leftOutput || outputDiff.rightOutput!)}
                      </pre>
                    </div>
                  </Match>
                </Switch>
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Cell Diff Row Component
// ============================================================================

interface CellDiffRowProps {
  diff: CellDiff;
  index: number;
  isActive: boolean;
  onAcceptLeft: () => void;
  onAcceptRight: () => void;
  onSelect: () => void;
}

function CellDiffRow(props: CellDiffRowProps) {
  const [isCollapsed, setIsCollapsed] = createSignal(props.diff.status === "unchanged");
  const [showWordDiff, setShowWordDiff] = createSignal(false);

  const wordDiffChanges = createMemo(() => {
    if (!showWordDiff() || props.diff.status !== "modified") return [];
    const leftSource = props.diff.leftCell ? joinSource(props.diff.leftCell.source) : "";
    const rightSource = props.diff.rightCell ? joinSource(props.diff.rightCell.source) : "";
    return diffWords(leftSource, rightSource);
  });

  return (
    <div
      class="notebook-diff-cell mb-4"
      style={{
        "border-left": props.isActive
          ? "3px solid var(--accent)"
          : "3px solid transparent",
      }}
      onClick={() => props.onSelect()}
    >
      <div
        class="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        style={{
          background: props.isActive ? "var(--surface-raised)" : "var(--surface-base)",
          "border-radius": "4px 4px 0 0",
          border: "1px solid var(--border-weak)",
          "border-bottom": isCollapsed() ? "1px solid var(--border-weak)" : "none",
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsCollapsed(!isCollapsed());
        }}
      >
        <Show
          when={!isCollapsed()}
          fallback={<Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />}
        >
          <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
        </Show>

        <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
          Cell {props.index + 1}
        </span>

        <DiffStatusBadge status={props.diff.status} />

        <Show when={props.diff.leftCell}>
          <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
            Left: #{props.diff.leftIndex + 1}
          </span>
        </Show>
        <Show when={props.diff.rightCell}>
          <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
            Right: #{props.diff.rightIndex + 1}
          </span>
        </Show>

        <div class="flex-1" />

        <Show when={props.diff.status !== "unchanged"}>
          <Show when={props.diff.status === "modified"}>
            <button
              class="px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)] transition-colors"
              style={{ color: "var(--text-weak)" }}
              onClick={(e) => {
                e.stopPropagation();
                setShowWordDiff(!showWordDiff());
              }}
            >
              {showWordDiff() ? "Line diff" : "Word diff"}
            </button>
          </Show>

          <Show when={props.diff.leftCell}>
            <button
              class="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)] transition-colors"
              style={{ color: "var(--text-weak)" }}
              onClick={(e) => {
                e.stopPropagation();
                props.onAcceptLeft();
              }}
              title="Accept left version"
            >
              <Icon name="arrow-left" class="w-3 h-3" />
              <span>Accept Left</span>
            </button>
          </Show>

          <Show when={props.diff.rightCell}>
            <button
              class="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)] transition-colors"
              style={{ color: "var(--text-weak)" }}
              onClick={(e) => {
                e.stopPropagation();
                props.onAcceptRight();
              }}
              title="Accept right version"
            >
              <span>Accept Right</span>
              <Icon name="arrow-right" class="w-3 h-3" />
            </button>
          </Show>
        </Show>
      </div>

      <Show when={!isCollapsed()}>
        <div
          class="p-3"
          style={{
            background: "var(--background-base)",
            border: "1px solid var(--border-weak)",
            "border-top": "none",
            "border-radius": "0 0 4px 4px",
          }}
        >
          <Switch>
            <Match when={props.diff.status === "modified" && showWordDiff()}>
              <div class="mb-3">
                <InlineDiffText changes={wordDiffChanges()} />
              </div>
            </Match>
            <Match when={props.diff.status === "modified" && props.diff.contentChanges.length > 0}>
              <div
                class="mb-3 rounded overflow-hidden"
                style={{ border: "1px solid var(--border-weak)" }}
              >
                <SideBySideDiffLines changes={props.diff.contentChanges} />
              </div>
            </Match>
            <Match when={true}>
              <div class="flex gap-3 mb-3">
                <CellContentPanel
                  cell={props.diff.leftCell}
                  side="left"
                  status={props.diff.status}
                />
                <CellContentPanel
                  cell={props.diff.rightCell}
                  side="right"
                  status={props.diff.status}
                />
              </div>
            </Match>
          </Switch>

          <Show when={props.diff.outputChanges.length > 0}>
            <OutputDiffPanel outputDiffs={props.diff.outputChanges} />
          </Show>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Navigation Controls Component
// ============================================================================

interface NavigationControlsProps {
  currentChangeIndex: number;
  totalChanges: number;
  onPrevious: () => void;
  onNext: () => void;
}

function NavigationControls(props: NavigationControlsProps) {
  return (
    <div class="flex items-center gap-2">
      <button
        class="p-1.5 rounded hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        onClick={props.onPrevious}
        disabled={props.currentChangeIndex <= 0}
        title="Previous change (↑)"
      >
        <Icon name="chevron-up" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
      </button>
      <span class="text-xs font-mono" style={{ color: "var(--text-weak)" }}>
        {props.totalChanges > 0
          ? `${props.currentChangeIndex + 1}/${props.totalChanges}`
          : "0/0"}
      </span>
      <button
        class="p-1.5 rounded hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        onClick={props.onNext}
        disabled={props.currentChangeIndex >= props.totalChanges - 1}
        title="Next change (↓)"
      >
        <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
      </button>
    </div>
  );
}

// ============================================================================
// Summary Stats Component
// ============================================================================

interface SummaryStatsProps {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
}

function SummaryStats(props: SummaryStatsProps) {
  return (
    <div class="flex items-center gap-4 text-xs">
      <Show when={props.added > 0}>
        <span class="flex items-center gap-1" style={{ color: "var(--success)" }}>
          <Icon name="plus" class="w-3 h-3" />
          {props.added} added
        </span>
      </Show>
      <Show when={props.removed > 0}>
        <span class="flex items-center gap-1" style={{ color: "var(--error)" }}>
          <Icon name="minus" class="w-3 h-3" />
          {props.removed} removed
        </span>
      </Show>
      <Show when={props.modified > 0}>
        <span class="flex items-center gap-1" style={{ color: "var(--warning)" }}>
          <Icon name="pen" class="w-3 h-3" />
          {props.modified} modified
        </span>
      </Show>
      <Show when={props.unchanged > 0}>
        <span class="flex items-center gap-1" style={{ color: "var(--text-weaker)" }}>
          <Icon name="check" class="w-3 h-3" />
          {props.unchanged} unchanged
        </span>
      </Show>
    </div>
  );
}

// ============================================================================
// Main NotebookDiff Component
// ============================================================================

export function NotebookDiff(props: NotebookDiffProps) {
  const [activeChangeIndex, setActiveChangeIndex] = createSignal(0);

  const leftNotebook = createMemo(() => parseNotebook(props.leftContent));
  const rightNotebook = createMemo(() => parseNotebook(props.rightContent));

  const cellDiffs = createMemo(() => {
    const left = leftNotebook();
    const right = rightNotebook();
    if (!left || !right) return [];
    return computeCellDiffs(left.cells, right.cells);
  });

  const changeIndices = createMemo(() => {
    const indices: number[] = [];
    cellDiffs().forEach((diff, index) => {
      if (diff.status !== "unchanged") {
        indices.push(index);
      }
    });
    return indices;
  });

  const stats = createMemo(() => {
    const diffs = cellDiffs();
    return {
      added: diffs.filter((d) => d.status === "added").length,
      removed: diffs.filter((d) => d.status === "removed").length,
      modified: diffs.filter((d) => d.status === "modified").length,
      unchanged: diffs.filter((d) => d.status === "unchanged").length,
    };
  });

  const currentActiveDiffIndex = createMemo(() => {
    const indices = changeIndices();
    const active = activeChangeIndex();
    return indices[active] ?? -1;
  });

  const navigateToPrevious = () => {
    setActiveChangeIndex((prev) => Math.max(0, prev - 1));
  };

  const navigateToNext = () => {
    setActiveChangeIndex((prev) => Math.min(changeIndices().length - 1, prev + 1));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigateToPrevious();
    } else if (e.key === "ArrowDown" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigateToNext();
    }
  };

  createEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleAcceptLeft = (diffIndex: number) => {
    const diff = cellDiffs()[diffIndex];
    if (diff && props.onAcceptLeft) {
      props.onAcceptLeft(diffIndex);
    }
  };

  const handleAcceptRight = (diffIndex: number) => {
    const diff = cellDiffs()[diffIndex];
    if (diff && props.onAcceptRight) {
      props.onAcceptRight(diffIndex);
    }
  };

  const handleSelectChange = (diffIndex: number) => {
    const indices = changeIndices();
    const changeIdx = indices.indexOf(diffIndex);
    if (changeIdx !== -1) {
      setActiveChangeIndex(changeIdx);
    }
  };

  return (
    <div
      class="notebook-diff flex flex-col h-full overflow-hidden"
      style={{ background: "var(--background-base)" }}
    >
      <div
        class="notebook-diff-header flex items-center gap-4 px-4 py-2 shrink-0"
        style={{
          background: "var(--surface-base)",
          "border-bottom": "1px solid var(--border-base)",
        }}
      >
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <Icon name="chevron-left" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
              {props.leftLabel || "Original"}
            </span>
          </div>
          <span class="text-sm" style={{ color: "var(--text-weaker)" }}>vs</span>
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
              {props.rightLabel || "Modified"}
            </span>
            <Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          </div>
        </div>

        <div class="flex-1" />

        <SummaryStats {...stats()} />

        <div style={{ width: "1px", height: "20px", background: "var(--border-base)" }} />

        <NavigationControls
          currentChangeIndex={activeChangeIndex()}
          totalChanges={changeIndices().length}
          onPrevious={navigateToPrevious}
          onNext={navigateToNext}
        />

        <Show when={props.onAcceptAll}>
          <div style={{ width: "1px", height: "20px", background: "var(--border-base)" }} />
          <div class="flex items-center gap-2">
            <button
              class="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)] transition-colors"
              style={{ color: "var(--text-weak)" }}
              onClick={() => props.onAcceptAll?.("left")}
              title="Accept all from left"
            >
              <Icon name="arrow-left" class="w-3 h-3" />
              <span>Accept All Left</span>
            </button>
            <button
              class="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)] transition-colors"
              style={{ color: "var(--text-weak)" }}
              onClick={() => props.onAcceptAll?.("right")}
              title="Accept all from right"
            >
              <span>Accept All Right</span>
              <Icon name="arrow-right" class="w-3 h-3" />
            </button>
          </div>
        </Show>
      </div>

      <div class="notebook-diff-content flex-1 overflow-auto p-4">
        <Show
          when={leftNotebook() && rightNotebook()}
          fallback={
            <div
              class="flex flex-col items-center justify-center h-full gap-2"
              style={{ color: "var(--text-weaker)" }}
            >
              <Icon name="xmark" class="w-8 h-8" style={{ color: "var(--error)" }} />
              <span class="text-sm">Failed to parse one or both notebooks</span>
              <span class="text-xs">Ensure both files are valid Jupyter notebook format</span>
            </div>
          }
        >
          <Show
            when={cellDiffs().length > 0}
            fallback={
            <div
              class="flex flex-col items-center justify-center h-full gap-2"
              style={{ color: "var(--text-weaker)" }}
            >
              <Icon name="check" class="w-8 h-8" style={{ color: "var(--success)" }} />
              <span class="text-sm">No differences found</span>
              <span class="text-xs">Both notebooks are identical</span>
            </div>
            }
          >
            <For each={cellDiffs()}>
              {(diff, index) => (
                <CellDiffRow
                  diff={diff}
                  index={index()}
                  isActive={currentActiveDiffIndex() === index()}
                  onAcceptLeft={() => handleAcceptLeft(index())}
                  onAcceptRight={() => handleAcceptRight(index())}
                  onSelect={() => handleSelectChange(index())}
                />
              )}
            </For>
          </Show>
        </Show>
      </div>

      <div
        class="notebook-diff-footer flex items-center gap-4 px-4 py-1 shrink-0 text-xs"
        style={{
          background: "var(--surface-base)",
          "border-top": "1px solid var(--border-base)",
          color: "var(--text-weaker)",
        }}
      >
        <span>
          <kbd class="px-1 py-0.5 rounded" style={{ background: "var(--surface-raised)" }}>
            Ctrl+↑
          </kbd>{" "}
          /{" "}
          <kbd class="px-1 py-0.5 rounded" style={{ background: "var(--surface-raised)" }}>
            Ctrl+↓
          </kbd>{" "}
          Navigate changes
        </span>
        <span>
          Click cell header to expand/collapse
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Utility Export for External Use
// ============================================================================

export function computeNotebookDiff(
  leftContent: string,
  rightContent: string
): {
  diffs: CellDiff[];
  stats: { added: number; removed: number; modified: number; unchanged: number };
} | null {
  const leftNotebook = parseNotebook(leftContent);
  const rightNotebook = parseNotebook(rightContent);

  if (!leftNotebook || !rightNotebook) {
    return null;
  }

  const diffs = computeCellDiffs(leftNotebook.cells, rightNotebook.cells);

  return {
    diffs,
    stats: {
      added: diffs.filter((d) => d.status === "added").length,
      removed: diffs.filter((d) => d.status === "removed").length,
      modified: diffs.filter((d) => d.status === "modified").length,
      unchanged: diffs.filter((d) => d.status === "unchanged").length,
    },
  };
}
