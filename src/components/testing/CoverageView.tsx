import { createSignal, createMemo, For, Show, JSX } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { Button, IconButton, Input, Text, Badge } from "@/components/ui";
import { tokens } from '@/design-system/tokens';
import {
  CoverageBar,
  CoverageBadge,
  CoverageRing,
  MiniCoverageBar,
  CoverageThresholds,
  DEFAULT_THRESHOLDS,
  getCoverageStatus,
  getCoverageColor,
} from "./CoverageBars";

/**
 * Coverage data for a single file
 */
export interface FileCoverage {
  /** File path relative to project root */
  path: string;
  /** File name */
  name: string;
  /** Line coverage metrics */
  lines: {
    total: number;
    covered: number;
    percentage: number;
  };
  /** Branch coverage metrics */
  branches: {
    total: number;
    covered: number;
    percentage: number;
  };
  /** Function coverage metrics */
  functions: {
    total: number;
    covered: number;
    percentage: number;
  };
  /** Statement coverage metrics */
  statements: {
    total: number;
    covered: number;
    percentage: number;
  };
  /** Uncovered line numbers (for highlighting) */
  uncoveredLines?: number[];
  /** Partially covered line numbers */
  partiallyCoveredLines?: number[];
}

/**
 * Aggregated coverage summary
 */
export interface CoverageSummary {
  lines: { total: number; covered: number; percentage: number };
  branches: { total: number; covered: number; percentage: number };
  functions: { total: number; covered: number; percentage: number };
  statements: { total: number; covered: number; percentage: number };
  fileCount: number;
  timestamp?: string;
}

/**
 * Historical coverage data point
 */
export interface CoverageTrend {
  timestamp: string;
  commit?: string;
  summary: CoverageSummary;
}

/**
 * Complete coverage report
 */
export interface CoverageReport {
  summary: CoverageSummary;
  files: FileCoverage[];
  trends?: CoverageTrend[];
  projectName?: string;
  generatedAt?: string;
}

/**
 * Sort direction
 */
type SortDirection = "asc" | "desc";

/**
 * Sort column options
 */
type SortColumn = "name" | "lines" | "branches" | "functions" | "statements";

/**
 * Filter options for file coverage
 */
interface CoverageFilter {
  minCoverage?: number;
  maxCoverage?: number;
  searchQuery?: string;
  showOnlyUncovered?: boolean;
}

/**
 * Props for CoverageView component
 */
export interface CoverageViewProps {
  /** Coverage report data */
  report: CoverageReport | null;
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string;
  /** Custom thresholds for visualization */
  thresholds?: CoverageThresholds;
  /** Callback when file is clicked */
  onFileClick?: (file: FileCoverage) => void;
  /** Callback to refresh coverage data */
  onRefresh?: () => void;
  /** Callback to export coverage report */
  onExport?: () => void;
  /** Additional styles */
  style?: JSX.CSSProperties;
  /** Height of the panel */
  height?: string;
}

/**
 * Main coverage view panel component
 */
export function CoverageView(props: CoverageViewProps) {
  const [sortColumn, setSortColumn] = createSignal<SortColumn>("name");
  const [sortDirection, setSortDirection] = createSignal<SortDirection>("asc");
  const [filter, setFilter] = createSignal<CoverageFilter>({});
  // Tree view state - prepared for future tree mode implementation

  const [showFilters, setShowFilters] = createSignal(false);
  // View mode - used by CoverageFilters component
  const [viewMode, setViewMode] = createSignal<"flat" | "tree">("flat");

  const thresholds = () => props.thresholds || DEFAULT_THRESHOLDS;

  // Filter files based on current filter settings
  const filteredFiles = createMemo(() => {
    let files = props.report?.files || [];
    const currentFilter = filter();

    if (currentFilter.searchQuery) {
      const query = currentFilter.searchQuery.toLowerCase();
      files = files.filter(f => 
        f.path.toLowerCase().includes(query) || 
        f.name.toLowerCase().includes(query)
      );
    }

    if (currentFilter.minCoverage !== undefined) {
      files = files.filter(f => f.lines.percentage >= currentFilter.minCoverage!);
    }

    if (currentFilter.maxCoverage !== undefined) {
      files = files.filter(f => f.lines.percentage <= currentFilter.maxCoverage!);
    }

    if (currentFilter.showOnlyUncovered) {
      files = files.filter(f => f.lines.percentage < 100);
    }

    return files;
  });

  // Sort files based on current sort settings
  const sortedFiles = createMemo(() => {
    const files = [...filteredFiles()];
    const column = sortColumn();
    const direction = sortDirection();

    files.sort((a, b) => {
      let valueA: number | string;
      let valueB: number | string;

      switch (column) {
        case "name":
          valueA = a.path.toLowerCase();
          valueB = b.path.toLowerCase();
          break;
        case "lines":
          valueA = a.lines.percentage;
          valueB = b.lines.percentage;
          break;
        case "branches":
          valueA = a.branches.percentage;
          valueB = b.branches.percentage;
          break;
        case "functions":
          valueA = a.functions.percentage;
          valueB = b.functions.percentage;
          break;
        case "statements":
          valueA = a.statements.percentage;
          valueB = b.statements.percentage;
          break;
      }

      if (typeof valueA === "string" && typeof valueB === "string") {
        return direction === "asc" 
          ? valueA.localeCompare(valueB) 
          : valueB.localeCompare(valueA);
      }

      const numA = valueA as number;
      const numB = valueB as number;
      return direction === "asc" ? numA - numB : numB - numA;
    });

    return files;
  });

  // Toggle sort column and direction
  const handleSort = (column: SortColumn) => {
    if (sortColumn() === column) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setFilter({});
  };

  // Previous coverage for trend calculation
  const previousSummary = createMemo(() => {
    const trends = props.report?.trends;
    if (!trends || trends.length < 2) return undefined;
    return trends[trends.length - 2].summary;
  });

  return (
    <div
      class="coverage-view"
      style={{
        display: "flex",
        "flex-direction": "column",
        height: props.height || "100%",
        background: "var(--background-base)",
        color: "var(--text-base)",
        "font-size": "13px",
        ...props.style,
      }}
    >
      {/* Header with summary */}
      <CoverageHeader
        report={props.report}
        loading={props.loading}
        onRefresh={props.onRefresh}
        onExport={props.onExport}
        thresholds={thresholds()}
        previousSummary={previousSummary()}
      />

      {/* Filters bar */}
      <CoverageFilters
        filter={filter()}
        setFilter={setFilter}
        showFilters={showFilters()}
        setShowFilters={setShowFilters}
        viewMode={viewMode()}
        setViewMode={setViewMode}
        totalFiles={props.report?.files?.length || 0}
        filteredFiles={filteredFiles().length}
        onClear={clearFilters}
      />

      {/* Main content area */}
      <div style={{ flex: "1", overflow: "hidden", display: "flex", "flex-direction": "column" }}>
        <Show
          when={!props.loading}
          fallback={<CoverageLoadingState />}
        >
          <Show
            when={!props.error}
            fallback={<CoverageErrorState error={props.error!} onRetry={props.onRefresh} />}
          >
            <Show
              when={props.report && props.report.files.length > 0}
              fallback={<CoverageEmptyState />}
            >
              {/* File table */}
              <CoverageTable
                files={sortedFiles()}
                sortColumn={sortColumn()}
                sortDirection={sortDirection()}
                onSort={handleSort}
                onFileClick={props.onFileClick}
                thresholds={thresholds()}
              />
            </Show>
          </Show>
        </Show>
      </div>

      {/* Trends chart (if available) */}
      <Show when={props.report?.trends && props.report.trends.length > 1}>
        <CoverageTrendsChart
          trends={props.report!.trends!}
          thresholds={thresholds()}
        />
      </Show>
    </div>
  );
}

/**
 * Header component with summary stats
 */
interface CoverageHeaderProps {
  report: CoverageReport | null;
  loading?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  thresholds: CoverageThresholds;
  previousSummary?: CoverageSummary;
}

function CoverageHeader(props: CoverageHeaderProps) {
  const summary = () => props.report?.summary;

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        gap: tokens.spacing.lg,
        padding: `${tokens.spacing.lg} ${tokens.spacing.xl}`,
        "border-bottom": `1px solid ${tokens.colors.border.divider}`,
        background: tokens.colors.surface.panel,
      }}
    >
      {/* Title row */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.lg }}>
          <h2 style={{ margin: "0", "font-size": "14px", "font-weight": "600", color: tokens.colors.text.primary }}>
            Test Coverage
          </h2>
          <Show when={props.report?.projectName}>
            <Text variant="muted" size="sm">
              {props.report?.projectName}
            </Text>
          </Show>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
          <Show when={props.report?.generatedAt}>
            <Text variant="muted" size="xs">
              Generated: {new Date(props.report!.generatedAt!).toLocaleString()}
            </Text>
          </Show>
          <Show when={props.onRefresh}>
            <IconButton
              icon={<Icon name="rotate" class={props.loading ? "animate-spin" : ""} />}
              onClick={props.onRefresh}
              disabled={props.loading}
              title="Refresh coverage"
              variant="ghost"
              size="sm"
            />
          </Show>
          <Show when={props.onExport}>
            <IconButton
              icon={<Icon name="download" />}
              onClick={props.onExport}
              title="Export report"
              variant="ghost"
              size="sm"
            />
          </Show>
        </div>
      </div>

      {/* Summary stats */}
      <Show when={summary()}>
        <div style={{ display: "flex", "align-items": "flex-start", gap: "24px" }}>
          {/* Overall coverage ring */}
          <CoverageRing
            percentage={summary()!.lines.percentage}
            size={72}
            strokeWidth={8}
            thresholds={props.thresholds}
          />

          {/* Metric bars */}
          <div style={{ flex: "1", display: "flex", "flex-direction": "column", gap: tokens.spacing.md }}>
            <CoverageSummaryRow
              label="Lines"
              covered={summary()!.lines.covered}
              total={summary()!.lines.total}
              percentage={summary()!.lines.percentage}
              previousPercentage={props.previousSummary?.lines.percentage}
              thresholds={props.thresholds}
            />
            <CoverageSummaryRow
              label="Branches"
              covered={summary()!.branches.covered}
              total={summary()!.branches.total}
              percentage={summary()!.branches.percentage}
              previousPercentage={props.previousSummary?.branches.percentage}
              thresholds={props.thresholds}
            />
            <CoverageSummaryRow
              label="Functions"
              covered={summary()!.functions.covered}
              total={summary()!.functions.total}
              percentage={summary()!.functions.percentage}
              previousPercentage={props.previousSummary?.functions.percentage}
              thresholds={props.thresholds}
            />
            <CoverageSummaryRow
              label="Statements"
              covered={summary()!.statements.covered}
              total={summary()!.statements.total}
              percentage={summary()!.statements.percentage}
              previousPercentage={props.previousSummary?.statements.percentage}
              thresholds={props.thresholds}
            />
          </div>

          {/* File count */}
          <div style={{ "text-align": "right" }}>
            <div style={{ "font-size": "24px", "font-weight": "600", color: "var(--text-strong)" }}>
              {summary()!.fileCount}
            </div>
            <Text variant="muted" size="xs">Files</Text>
          </div>
        </div>
      </Show>
    </div>
  );
}

/**
 * Summary row with bar and trend
 */
interface CoverageSummaryRowProps {
  label: string;
  covered: number;
  total: number;
  percentage: number;
  previousPercentage?: number;
  thresholds: CoverageThresholds;
}

function CoverageSummaryRow(props: CoverageSummaryRowProps) {
  const change = createMemo(() => {
    if (props.previousPercentage === undefined) return undefined;
    return props.percentage - props.previousPercentage;
  });

  const changeColor = createMemo(() => {
    const c = change();
    if (c === undefined || Math.abs(c) < 0.01) return tokens.colors.text.muted;
    return c > 0 ? tokens.colors.semantic.success : tokens.colors.semantic.error;
  });

  return (
    <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.lg }}>
      <Text variant="muted" size="xs" style={{ width: "72px" }}>
        {props.label}
      </Text>
      <div style={{ flex: "1" }}>
        <CoverageBar
          percentage={props.percentage}
          height={4}
          thresholds={props.thresholds}
          showPercentage={false}
          showTooltip={false}
        />
      </div>
      <CoverageBadge
        percentage={props.percentage}
        thresholds={props.thresholds}
        size="xs"
      />
      <Text variant="muted" size="xs" style={{ width: "80px", "text-align": "right" }}>
        {props.covered}/{props.total}
      </Text>
      <Show when={change() !== undefined}>
        <Text
          size="xs"
          style={{
            width: "48px",
            "font-weight": "500",
            color: changeColor(),
            "text-align": "right",
          }}
        >
          {change()! > 0 ? "+" : ""}{change()!.toFixed(1)}%
        </Text>
      </Show>
    </div>
  );
}

/**
 * Filters bar component
 */
interface CoverageFiltersProps {
  filter: CoverageFilter;
  setFilter: (f: CoverageFilter | ((prev: CoverageFilter) => CoverageFilter)) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  viewMode: "flat" | "tree";
  setViewMode: (v: "flat" | "tree") => void;
  totalFiles: number;
  filteredFiles: number;
  onClear: () => void;
}

function CoverageFilters(props: CoverageFiltersProps) {
  const hasActiveFilters = createMemo(() => {
    const f = props.filter;
    return f.searchQuery || f.minCoverage !== undefined || f.maxCoverage !== undefined || f.showOnlyUncovered;
  });

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        "border-bottom": `1px solid ${tokens.colors.border.divider}`,
      }}
    >
      {/* Search and toggle row */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: tokens.spacing.md,
          padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
        }}
      >
        {/* Search input */}
        <div
          style={{
            flex: "1",
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.md,
          }}
        >
          <Input
            type="text"
            placeholder="Search files..."
            value={props.filter.searchQuery || ""}
            onInput={(e) => props.setFilter(f => ({ ...f, searchQuery: e.currentTarget.value || undefined }))}
            icon={<Icon name="magnifying-glass" style={{ width: "14px", height: "14px" }} />}
            size="sm"
          />
          <Show when={props.filter.searchQuery}>
            <IconButton
              icon={<Icon name="xmark" />}
              onClick={() => props.setFilter(f => ({ ...f, searchQuery: undefined }))}
              variant="ghost"
              size="sm"
              title="Clear search"
            />
          </Show>
        </div>

        {/* Filter toggle */}
        <Button
          onClick={() => props.setShowFilters(!props.showFilters)}
          variant={hasActiveFilters() ? "secondary" : "ghost"}
          size="sm"
        >
          <Icon name="filter" style={{ width: "14px", height: "14px" }} />
          <Text size="sm">Filters</Text>
          <Show when={hasActiveFilters()}>
            <Badge variant="accent" size="sm">!</Badge>
          </Show>
        </Button>

        {/* File count */}
        <Text variant="muted" size="xs">
          {props.filteredFiles === props.totalFiles
            ? `${props.totalFiles} files`
            : `${props.filteredFiles} of ${props.totalFiles} files`}
        </Text>
      </div>

      {/* Expanded filter options */}
      <Show when={props.showFilters}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.xl,
            padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
            background: tokens.colors.surface.panel,
            "border-top": `1px solid ${tokens.colors.border.divider}`,
          }}
        >
          {/* Min coverage */}
          <label style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md, "font-size": "12px" }}>
            <Text variant="muted" size="sm">Min:</Text>
            <Input
              type="number"
              min="0"
              max="100"
              value={props.filter.minCoverage ?? ""}
              onInput={(e) => {
                const val = e.currentTarget.value ? parseFloat(e.currentTarget.value) : undefined;
                props.setFilter(f => ({ ...f, minCoverage: val }));
              }}
              size="sm"
              style={{ width: "60px" }}
            />
            <Text variant="muted" size="xs">%</Text>
          </label>

          {/* Max coverage */}
          <label style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md, "font-size": "12px" }}>
            <Text variant="muted" size="sm">Max:</Text>
            <Input
              type="number"
              min="0"
              max="100"
              value={props.filter.maxCoverage ?? ""}
              onInput={(e) => {
                const val = e.currentTarget.value ? parseFloat(e.currentTarget.value) : undefined;
                props.setFilter(f => ({ ...f, maxCoverage: val }));
              }}
              size="sm"
              style={{ width: "60px" }}
            />
            <Text variant="muted" size="xs">%</Text>
          </label>

          {/* Show uncovered only */}
          <label style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md, "font-size": "12px", cursor: "pointer" }}>
            <Input
              type="checkbox"
              checked={props.filter.showOnlyUncovered || false}
              onChange={(e) => props.setFilter(f => ({ ...f, showOnlyUncovered: e.currentTarget.checked || undefined }))}
            />
            <Text variant="muted" size="sm">Uncovered only</Text>
          </label>

          {/* Clear filters */}
          <Show when={hasActiveFilters()}>
            <Button
              onClick={props.onClear}
              variant="ghost"
              size="sm"
            >
              Clear all
            </Button>
          </Show>
        </div>
      </Show>
    </div>
  );
}

/**
 * File coverage table
 */
interface CoverageTableProps {
  files: FileCoverage[];
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
  onFileClick?: (file: FileCoverage) => void;
  thresholds: CoverageThresholds;
}

function CoverageTable(props: CoverageTableProps) {
  const SortIcon = (sortProps: { column: SortColumn }) => {
    if (props.sortColumn !== sortProps.column) {
      return <span style={{ opacity: "0.3" }}>↕</span>;
    }
    return props.sortDirection === "asc" ? <Icon name="chevron-up" style={{ width: "12px", height: "12px" }} /> : <Icon name="chevron-down" style={{ width: "12px", height: "12px" }} />;
  };

  const headerStyle: JSX.CSSProperties = {
    padding: "8px 12px",
    "text-align": "left",
    "font-size": "11px",
    "font-weight": "600",
    color: "var(--text-weak)",
    "text-transform": "uppercase",
    "letter-spacing": "0.05em",
    cursor: "pointer",
    "user-select": "none",
    "white-space": "nowrap",
    background: "var(--surface-base)",
    "border-bottom": "1px solid var(--border-weak)",
  };

  const numericHeaderStyle: JSX.CSSProperties = {
    ...headerStyle,
    "text-align": "right",
    width: "100px",
  };

  return (
    <div style={{ flex: "1", overflow: "auto" }}>
      <table
        style={{
          width: "100%",
          "border-collapse": "collapse",
          "table-layout": "fixed",
        }}
      >
        <thead style={{ position: "sticky", top: "0", "z-index": "1" }}>
          <tr>
            <th
              style={{ ...headerStyle, width: "auto" }}
              onClick={() => props.onSort("name")}
            >
              <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                File
                <SortIcon column="name" />
              </span>
            </th>
            <th
              style={numericHeaderStyle}
              onClick={() => props.onSort("lines")}
            >
              <span style={{ display: "flex", "align-items": "center", "justify-content": "flex-end", gap: "4px" }}>
                Lines
                <SortIcon column="lines" />
              </span>
            </th>
            <th
              style={numericHeaderStyle}
              onClick={() => props.onSort("branches")}
            >
              <span style={{ display: "flex", "align-items": "center", "justify-content": "flex-end", gap: "4px" }}>
                Branches
                <SortIcon column="branches" />
              </span>
            </th>
            <th
              style={numericHeaderStyle}
              onClick={() => props.onSort("functions")}
            >
              <span style={{ display: "flex", "align-items": "center", "justify-content": "flex-end", gap: "4px" }}>
                Functions
                <SortIcon column="functions" />
              </span>
            </th>
            <th
              style={numericHeaderStyle}
              onClick={() => props.onSort("statements")}
            >
              <span style={{ display: "flex", "align-items": "center", "justify-content": "flex-end", gap: "4px" }}>
                Statements
                <SortIcon column="statements" />
              </span>
            </th>
            <th style={{ ...headerStyle, width: "120px" }}>
              <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                Visual
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <For each={props.files}>
            {(file, index) => (
              <CoverageTableRow
                file={file}
                onClick={props.onFileClick}
                thresholds={props.thresholds}
                isEven={index() % 2 === 0}
              />
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Single row in coverage table
 */
interface CoverageTableRowProps {
  file: FileCoverage;
  onClick?: (file: FileCoverage) => void;
  thresholds: CoverageThresholds;
  isEven: boolean;
}

function CoverageTableRow(props: CoverageTableRowProps) {
  const [isHovered, setIsHovered] = createSignal(false);

  const cellStyle: JSX.CSSProperties = {
    padding: "8px 12px",
    "font-size": "12px",
    "border-bottom": "1px solid var(--border-weak)",
    "vertical-align": "middle",
  };

  const numericCellStyle: JSX.CSSProperties = {
    ...cellStyle,
    "text-align": "right",
    "font-variant-numeric": "tabular-nums",
  };

  const rowStyle = (): JSX.CSSProperties => ({
    background: isHovered() 
      ? "var(--surface-raised-hover)" 
      : props.isEven 
        ? "transparent" 
        : "var(--surface-base)",
    cursor: props.onClick ? "pointer" : "default",
    transition: "background 100ms ease",
  });

  // Get the filename and folder from path
  const pathParts = createMemo(() => {
    const parts = props.file.path.split("/");
    const name = parts.pop() || props.file.name;
    const folder = parts.join("/");
    return { name, folder };
  });

  return (
    <tr
      style={rowStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => props.onClick?.(props.file)}
    >
      <td style={cellStyle}>
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md, overflow: "hidden" }}>
          <Icon name="file" style={{ width: "14px", height: "14px", "flex-shrink": "0", color: tokens.colors.text.muted }} />
          <div style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
            <Text variant="body">{pathParts().name}</Text>
            <Show when={pathParts().folder}>
              <Text variant="muted" size="xs" style={{ "margin-left": tokens.spacing.md }}>
                {pathParts().folder}
              </Text>
            </Show>
          </div>
          <Show when={props.onClick && isHovered()}>
            <Icon name="arrow-up-right-from-square" style={{ width: "12px", height: "12px", "flex-shrink": "0", color: tokens.colors.accent.primary }} />
          </Show>
        </div>
      </td>
      <td style={numericCellStyle}>
        <CoverageCell
          covered={props.file.lines.covered}
          total={props.file.lines.total}
          percentage={props.file.lines.percentage}
          thresholds={props.thresholds}
        />
      </td>
      <td style={numericCellStyle}>
        <CoverageCell
          covered={props.file.branches.covered}
          total={props.file.branches.total}
          percentage={props.file.branches.percentage}
          thresholds={props.thresholds}
        />
      </td>
      <td style={numericCellStyle}>
        <CoverageCell
          covered={props.file.functions.covered}
          total={props.file.functions.total}
          percentage={props.file.functions.percentage}
          thresholds={props.thresholds}
        />
      </td>
      <td style={numericCellStyle}>
        <CoverageCell
          covered={props.file.statements.covered}
          total={props.file.statements.total}
          percentage={props.file.statements.percentage}
          thresholds={props.thresholds}
        />
      </td>
      <td style={cellStyle}>
        <MiniCoverageBar
          percentage={props.file.lines.percentage}
          thresholds={props.thresholds}
          width={100}
          height={6}
        />
      </td>
    </tr>
  );
}

/**
 * Coverage cell with percentage and count
 */
interface CoverageCellProps {
  covered: number;
  total: number;
  percentage: number;
  thresholds: CoverageThresholds;
}

function CoverageCell(props: CoverageCellProps) {
  const status = createMemo(() => getCoverageStatus(props.percentage, props.thresholds));
  const color = createMemo(() => getCoverageColor(status()));

  return (
    <div style={{ display: "flex", "flex-direction": "column", "align-items": "flex-end", gap: "2px" }}>
      <Text style={{ color: color(), "font-weight": "500" }}>
        {props.percentage.toFixed(1)}%
      </Text>
      <Text variant="muted" size="xs">
        {props.covered}/{props.total}
      </Text>
    </div>
  );
}

/**
 * Trends chart component
 */
interface CoverageTrendsChartProps {
  trends: CoverageTrend[];
  thresholds: CoverageThresholds;
}

function CoverageTrendsChart(props: CoverageTrendsChartProps) {
  const [isExpanded, setIsExpanded] = createSignal(false);

  // Get last N trends for display
  const displayTrends = createMemo(() => {
    const count = isExpanded() ? props.trends.length : Math.min(10, props.trends.length);
    return props.trends.slice(-count);
  });

  // Calculate chart dimensions
  const chartHeight = 80;
  const chartPadding = { top: 10, right: 10, bottom: 20, left: 40 };

  // Get min/max for scaling
  const valueRange = createMemo(() => {
    let min = 100;
    let max = 0;
    for (const trend of displayTrends()) {
      min = Math.min(min, trend.summary.lines.percentage);
      max = Math.max(max, trend.summary.lines.percentage);
    }
    // Add some padding
    return { min: Math.max(0, min - 5), max: Math.min(100, max + 5) };
  });

  // Scale a value to chart coordinates
  const scaleY = (value: number) => {
    const { min, max } = valueRange();
    const range = max - min || 1;
    return chartHeight - chartPadding.bottom - ((value - min) / range) * (chartHeight - chartPadding.top - chartPadding.bottom);
  };

  return (
    <div
      style={{
        "border-top": "1px solid var(--border-weak)",
        background: "var(--surface-base)",
      }}
    >
      {/* Header */}
      <Button
        onClick={() => setIsExpanded(!isExpanded())}
        variant="ghost"
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          width: "100%",
          "text-align": "left",
        }}
      >
        <span style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
          <Icon name="arrow-trend-up" style={{ width: "14px", height: "14px", color: tokens.colors.text.muted }} />
          <Text style={{ "font-weight": "500" }}>Coverage Trends</Text>
          <Text variant="muted" size="sm">
            ({props.trends.length} data points)
          </Text>
        </span>
        <span style={{ color: tokens.colors.text.muted }}>
          {isExpanded() ? <Icon name="chevron-up" style={{ width: "14px", height: "14px" }} /> : <Icon name="chevron-down" style={{ width: "14px", height: "14px" }} />}
        </span>
      </Button>

      {/* Chart */}
      <Show when={isExpanded()}>
        <div style={{ padding: "8px 12px 16px" }}>
          <svg
            width="100%"
            height={chartHeight}
            viewBox={`0 0 ${displayTrends().length * 30 + chartPadding.left + chartPadding.right} ${chartHeight}`}
            style={{ overflow: "visible" }}
          >
            {/* Threshold lines */}
            <line
              x1={chartPadding.left}
              y1={scaleY(props.thresholds.good)}
              x2={displayTrends().length * 30 + chartPadding.left}
              y2={scaleY(props.thresholds.good)}
              stroke="var(--success)"
              stroke-width="1"
              stroke-dasharray="4,4"
              opacity="0.5"
            />
            <line
              x1={chartPadding.left}
              y1={scaleY(props.thresholds.acceptable)}
              x2={displayTrends().length * 30 + chartPadding.left}
              y2={scaleY(props.thresholds.acceptable)}
              stroke="var(--warning)"
              stroke-width="1"
              stroke-dasharray="4,4"
              opacity="0.5"
            />

            {/* Trend line */}
            <polyline
              fill="none"
              stroke="var(--accent)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              points={displayTrends().map((t, i) =>
                `${chartPadding.left + i * 30 + 15},${scaleY(t.summary.lines.percentage)}`
              ).join(" ")}
            />

            {/* Data points */}
            <For each={displayTrends()}>
              {(trend, i) => (
                <g>
                  <circle
                    cx={chartPadding.left + i() * 30 + 15}
                    cy={scaleY(trend.summary.lines.percentage)}
                    r="4"
                    fill="var(--accent)"
                  >
                    <title>
                      {trend.timestamp}: {trend.summary.lines.percentage.toFixed(1)}%
                      {trend.commit ? `\nCommit: ${trend.commit.slice(0, 7)}` : ""}
                    </title>
                  </circle>
                </g>
              )}
            </For>

            {/* Y-axis labels */}
            <text
              x={chartPadding.left - 8}
              y={scaleY(valueRange().max)}
              text-anchor="end"
              font-size="10"
              fill="var(--text-weaker)"
            >
              {valueRange().max.toFixed(0)}%
            </text>
            <text
              x={chartPadding.left - 8}
              y={scaleY(valueRange().min)}
              text-anchor="end"
              font-size="10"
              fill="var(--text-weaker)"
            >
              {valueRange().min.toFixed(0)}%
            </text>
          </svg>
        </div>
      </Show>
    </div>
  );
}

/**
 * Loading state component
 */
function CoverageLoadingState() {
  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "justify-content": "center",
        padding: "48px 24px",
        gap: "16px",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          border: "3px solid var(--border-weak)",
          "border-top-color": "var(--accent)",
          "border-radius": "var(--cortex-radius-full)",
          animation: "spin 1s linear infinite",
        }}
      />
      <Text variant="muted" size="sm">
        Loading coverage data...
      </Text>
      <style>
        {`@keyframes spin { to { transform: rotate(360deg); } }`}
      </style>
    </div>
  );
}

/**
 * Error state component
 */
interface CoverageErrorStateProps {
  error: string;
  onRetry?: () => void;
}

function CoverageErrorState(props: CoverageErrorStateProps) {
  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "justify-content": "center",
        padding: "48px 24px",
        gap: "16px",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          "border-radius": "var(--cortex-radius-full)",
          background: "rgba(239, 113, 119, 0.15)",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
        }}
      >
        <Icon name="xmark" style={{ width: "24px", height: "24px", color: "var(--error)" }} />
      </div>
      <Text variant="body" style={{ "font-weight": "500" }}>
        Failed to load coverage
      </Text>
      <Text variant="muted" size="sm" style={{ "text-align": "center", "max-width": "300px" }}>
        {props.error}
      </Text>
      <Show when={props.onRetry}>
        <Button
          onClick={props.onRetry}
          variant="secondary"
          size="sm"
        >
          Retry
        </Button>
      </Show>
    </div>
  );
}

/**
 * Empty state component
 */
function CoverageEmptyState() {
  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "justify-content": "center",
        padding: "48px 24px",
        gap: "16px",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          "border-radius": "var(--cortex-radius-full)",
          background: "var(--surface-raised)",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
        }}
      >
        <Icon name="file" style={{ width: "24px", height: "24px", color: "var(--text-weak)" }} />
      </div>
      <Text variant="body" style={{ "font-weight": "500" }}>
        No coverage data
      </Text>
      <Text variant="muted" size="sm" style={{ "text-align": "center", "max-width": "300px" }}>
        Run your test suite with coverage enabled to see results here.
      </Text>
    </div>
  );
}



