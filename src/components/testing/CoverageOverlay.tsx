import { Show, For, createSignal, createMemo } from "solid-js";
import { useTesting, type CoverageFileData } from "@/context/TestingContext";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui";

const COVERAGE_THRESHOLD_HIGH = 80;
const COVERAGE_THRESHOLD_MEDIUM = 50;

function getCoverageColor(percentage: number): string {
  if (percentage >= COVERAGE_THRESHOLD_HIGH) return "var(--cortex-success)";
  if (percentage >= COVERAGE_THRESHOLD_MEDIUM) return "var(--cortex-warning)";
  return "var(--cortex-error)";
}

function CoverageBar(props: { percentage: number; height?: number }) {
  const h = () => props.height ?? 6;
  return (
    <div
      style={{
        width: "100%",
        height: `${h()}px`,
        background: "var(--surface-border)",
        "border-radius": `${h() / 2}px`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, props.percentage))}%`,
          height: "100%",
          background: getCoverageColor(props.percentage),
          "border-radius": `${h() / 2}px`,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

function FileCoverageRow(props: { file: CoverageFileData }) {
  const fileName = () => props.file.filePath.split("/").pop() || props.file.filePath;
  const percentage = () => props.file.lines.percentage;

  const handleNavigate = () => {
    window.dispatchEvent(new CustomEvent("editor:goto", {
      detail: { path: props.file.filePath, line: 1, column: 1, focus: true },
    }));
  };

  return (
    <div
      class="flex items-center gap-2 px-3 py-1 hover:bg-[var(--surface-raised)] cursor-pointer"
      style={{ "font-size": "12px" }}
      onClick={handleNavigate}
    >
      <Icon name="file" size={12} color="var(--text-weak)" class="shrink-0" />
      <span class="truncate flex-1" style={{ color: "var(--text-base)" }} title={props.file.filePath}>
        {fileName()}
      </span>
      <div class="shrink-0" style={{ width: "60px" }}>
        <CoverageBar percentage={percentage()} />
      </div>
      <span
        class="shrink-0"
        style={{ width: "40px", "text-align": "right", color: getCoverageColor(percentage()), "font-size": "11px", "font-weight": "500" }}
      >
        {percentage().toFixed(0)}%
      </span>
    </div>
  );
}

export function CoverageOverlay() {
  const testing = useTesting();
  const [sortBy, setSortBy] = createSignal<"name" | "coverage">("coverage");

  const coverage = () => testing.state.coverage;
  const isVisible = () => testing.state.showCoverage;
  const overallPercentage = () => testing.coveragePercentage();

  const sortedFiles = createMemo(() => {
    const cov = coverage();
    if (!cov) return [];
    const files = [...cov.files];
    if (sortBy() === "coverage") {
      files.sort((a, b) => a.lines.percentage - b.lines.percentage);
    } else {
      files.sort((a, b) => a.filePath.localeCompare(b.filePath));
    }
    return files;
  });

  const summaryStats = createMemo(() => {
    const cov = coverage();
    if (!cov) return null;
    return {
      lines: { covered: cov.coveredLines, total: cov.totalLines, pct: cov.totalLines > 0 ? (cov.coveredLines / cov.totalLines) * 100 : 0 },
      branches: { covered: cov.coveredBranches, total: cov.totalBranches, pct: cov.totalBranches > 0 ? (cov.coveredBranches / cov.totalBranches) * 100 : 0 },
      functions: { covered: cov.coveredFunctions, total: cov.totalFunctions, pct: cov.totalFunctions > 0 ? (cov.coveredFunctions / cov.totalFunctions) * 100 : 0 },
    };
  });

  return (
    <div class="flex flex-col h-full" style={{ background: "var(--cortex-bg-primary)", color: "var(--text-base)" }}>
      <div class="flex items-center justify-between px-2 shrink-0" style={{ height: "32px", "border-bottom": "1px solid var(--surface-border)" }}>
        <div class="flex items-center gap-2">
          <Icon name="chart-pie" size={14} color="var(--text-weak)" />
          <span style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase" }}>Coverage</span>
        </div>
        <div class="flex items-center gap-1">
          <IconButton
            size="sm"
            variant="ghost"
            onClick={() => testing.setShowCoverage(!isVisible())}
            title={isVisible() ? "Hide Coverage" : "Show Coverage"}
          >
            <Icon name={isVisible() ? "eye" : "eye-slash"} size={12} />
          </IconButton>
          <IconButton
            size="sm"
            variant="ghost"
            onClick={() => testing.runWithCoverage()}
            title="Run with Coverage"
          >
            <Icon name="play" size={12} />
          </IconButton>
        </div>
      </div>
      <Show when={coverage()} fallback={
        <div class="flex items-center justify-center p-4" style={{ color: "var(--text-weak)", "font-size": "12px" }}>
          No coverage data. Run tests with coverage to see results.
        </div>
      }>
        <div class="px-3 py-2 shrink-0" style={{ "border-bottom": "1px solid var(--surface-border)" }}>
          <div class="flex items-center gap-2 mb-1">
            <span style={{ "font-size": "24px", "font-weight": "700", color: getCoverageColor(overallPercentage()) }}>
              {overallPercentage().toFixed(1)}%
            </span>
            <span style={{ color: "var(--text-weak)", "font-size": "12px" }}>overall</span>
          </div>
          <CoverageBar percentage={overallPercentage()} height={8} />
          <Show when={summaryStats()}>
            <div class="flex gap-3 mt-2" style={{ "font-size": "11px" }}>
              <span style={{ color: "var(--text-weak)" }}>
                Lines: <span style={{ color: getCoverageColor(summaryStats()!.lines.pct) }}>{summaryStats()!.lines.covered}/{summaryStats()!.lines.total}</span>
              </span>
              <span style={{ color: "var(--text-weak)" }}>
                Branches: <span style={{ color: getCoverageColor(summaryStats()!.branches.pct) }}>{summaryStats()!.branches.covered}/{summaryStats()!.branches.total}</span>
              </span>
              <span style={{ color: "var(--text-weak)" }}>
                Functions: <span style={{ color: getCoverageColor(summaryStats()!.functions.pct) }}>{summaryStats()!.functions.covered}/{summaryStats()!.functions.total}</span>
              </span>
            </div>
          </Show>
        </div>
        <div class="flex items-center gap-1 px-2 shrink-0" style={{ height: "24px", "border-bottom": "1px solid var(--surface-border)" }}>
          <span style={{ "font-size": "11px", color: "var(--text-weak)" }}>Sort by:</span>
          <button
            onClick={() => setSortBy("coverage")}
            style={{
              background: "none",
              border: "none",
              color: sortBy() === "coverage" ? "var(--cortex-accent-primary)" : "var(--text-weak)",
              "font-size": "11px",
              cursor: "pointer",
              "text-decoration": sortBy() === "coverage" ? "underline" : "none",
            }}
          >
            Coverage
          </button>
          <button
            onClick={() => setSortBy("name")}
            style={{
              background: "none",
              border: "none",
              color: sortBy() === "name" ? "var(--cortex-accent-primary)" : "var(--text-weak)",
              "font-size": "11px",
              cursor: "pointer",
              "text-decoration": sortBy() === "name" ? "underline" : "none",
            }}
          >
            Name
          </button>
        </div>
        <div class="flex-1 overflow-y-auto">
          <For each={sortedFiles()}>
            {(file) => <FileCoverageRow file={file} />}
          </For>
        </div>
      </Show>
    </div>
  );
}
