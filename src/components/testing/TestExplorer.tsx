import {
  createSignal,
  createMemo,
  createEffect,
  For,
  Show,
  onMount,
  onCleanup,
} from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { Button, IconButton } from "@/components/ui";
import { tokens } from '@/design-system/tokens';

// ============================================================================
// Types
// ============================================================================

export type TestStatus = "pending" | "running" | "passed" | "failed" | "skipped";

export interface TestCase {
  id: string;
  name: string;
  fullName: string;
  status: TestStatus;
  duration?: number;
  error?: string;
  stackTrace?: string;
  filePath: string;
  lineNumber?: number;
}

export interface TestSuite {
  id: string;
  name: string;
  filePath: string;
  status: TestStatus;
  duration?: number;
  tests: TestCase[];
  suites: TestSuite[];
  expanded?: boolean;
}

export interface TestFile {
  id: string;
  name: string;
  path: string;
  status: TestStatus;
  duration?: number;
  suites: TestSuite[];
  tests: TestCase[];
  expanded?: boolean;
}

export interface TestExplorerProps {
  files?: TestFile[];
  onRunTest?: (test: TestCase) => void;
  onRunSuite?: (suite: TestSuite) => void;
  onRunFile?: (file: TestFile) => void;
  onRunAll?: () => void;
  onRunFailed?: () => void;
  onDebugTest?: (test: TestCase) => void;
  onGoToTest?: (filePath: string, lineNumber?: number) => void;
  onStopTests?: () => void;
  isRunning?: boolean;
  continuousRun?: boolean;
  onToggleContinuousRun?: () => void;
  lastAutoRunTime?: number | null;
  // Watch mode props
  watchMode?: boolean;
  onToggleWatchMode?: () => void;
  // Coverage props
  showCoverage?: boolean;
  onToggleCoverage?: () => void;
  onRunWithCoverage?: () => void;
  coveragePercentage?: number;
}

type StatusFilter = "all" | "passed" | "failed" | "skipped" | "running";

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusIcon(status: TestStatus, size: string = "w-3.5 h-3.5") {
  switch (status) {
    case "passed":
      return <Icon name="check" class={`${size} text-green-400`} />;
    case "failed":
      return <Icon name="xmark" class={`${size} text-red-400`} />;
    case "skipped":
      return <Icon name="forward-step" class={`${size} text-yellow-400`} />;
    case "running":
      return <Icon name="play" class={`${size} text-blue-400 animate-pulse`} />;
    case "pending":
    default:
      return <Icon name="clock" class={`${size}`} style={{ color: "var(--text-weaker)" }} />;
  }
}

// Helper function for status colors - exported for potential external use
export function getStatusColor(status: TestStatus): string {
  switch (status) {
    case "passed":
      return "var(--cortex-success)";
    case "failed":
      return "var(--cortex-error)";
    case "skipped":
      return "var(--cortex-warning)";
    case "running":
      return "var(--cortex-info)";
    case "pending":
    default:
      return "var(--text-weaker)";
  }
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return "";
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

function formatLastRunTime(timestamp: number | null | undefined): string {
  if (!timestamp) return "";
  
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 1000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function countTests(files: TestFile[]): { total: number; passed: number; failed: number; skipped: number; running: number } {
  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let running = 0;

  const countInSuite = (suite: TestSuite) => {
    for (const test of suite.tests) {
      total++;
      if (test.status === "passed") passed++;
      else if (test.status === "failed") failed++;
      else if (test.status === "skipped") skipped++;
      else if (test.status === "running") running++;
    }
    for (const nested of suite.suites) {
      countInSuite(nested);
    }
  };

  for (const file of files) {
    for (const test of file.tests) {
      total++;
      if (test.status === "passed") passed++;
      else if (test.status === "failed") failed++;
      else if (test.status === "skipped") skipped++;
      else if (test.status === "running") running++;
    }
    for (const suite of file.suites) {
      countInSuite(suite);
    }
  }

  return { total, passed, failed, skipped, running };
}

function computeSuiteStatus(suite: TestSuite): TestStatus {
  const statuses: TestStatus[] = [];
  
  for (const test of suite.tests) {
    statuses.push(test.status);
  }
  for (const nested of suite.suites) {
    statuses.push(computeSuiteStatus(nested));
  }
  
  if (statuses.length === 0) return "pending";
  if (statuses.some(s => s === "running")) return "running";
  if (statuses.some(s => s === "failed")) return "failed";
  if (statuses.every(s => s === "passed")) return "passed";
  if (statuses.every(s => s === "skipped")) return "skipped";
  if (statuses.some(s => s === "passed") || statuses.some(s => s === "skipped")) {
    return statuses.some(s => s === "failed") ? "failed" : "passed";
  }
  return "pending";
}

function computeFileStatus(file: TestFile): TestStatus {
  const statuses: TestStatus[] = [];
  
  for (const test of file.tests) {
    statuses.push(test.status);
  }
  for (const suite of file.suites) {
    statuses.push(computeSuiteStatus(suite));
  }
  
  if (statuses.length === 0) return "pending";
  if (statuses.some(s => s === "running")) return "running";
  if (statuses.some(s => s === "failed")) return "failed";
  if (statuses.every(s => s === "passed")) return "passed";
  if (statuses.every(s => s === "skipped")) return "skipped";
  return "pending";
}

function filterTestsByStatus(files: TestFile[], statusFilter: StatusFilter, searchQuery: string): TestFile[] {
  const query = searchQuery.toLowerCase().trim();
  
  const filterTest = (test: TestCase): boolean => {
    const matchesStatus = statusFilter === "all" || test.status === statusFilter;
    const matchesQuery = !query || test.name.toLowerCase().includes(query) || test.fullName.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  };

  const filterSuite = (suite: TestSuite): TestSuite | null => {
    const filteredTests = suite.tests.filter(filterTest);
    const filteredSuites = suite.suites
      .map(filterSuite)
      .filter((s): s is TestSuite => s !== null);

    if (filteredTests.length === 0 && filteredSuites.length === 0) {
      const matchesQuery = !query || suite.name.toLowerCase().includes(query);
      if (!matchesQuery) return null;
    }

    return {
      ...suite,
      tests: filteredTests,
      suites: filteredSuites,
    };
  };

  const filterFile = (file: TestFile): TestFile | null => {
    const filteredTests = file.tests.filter(filterTest);
    const filteredSuites = file.suites
      .map(filterSuite)
      .filter((s): s is TestSuite => s !== null);

    if (filteredTests.length === 0 && filteredSuites.length === 0) {
      const matchesQuery = !query || file.name.toLowerCase().includes(query);
      if (!matchesQuery) return null;
    }

    return {
      ...file,
      tests: filteredTests,
      suites: filteredSuites,
    };
  };

  return files.map(filterFile).filter((f): f is TestFile => f !== null);
}

// ============================================================================
// TestCaseItem Component
// ============================================================================

interface TestCaseItemProps {
  test: TestCase;
  depth: number;
  isSelected: boolean;
  onSelect: () => void;
  onRun: () => void;
  onDebug?: () => void;
  onGoToSource: () => void;
}

function TestCaseItem(props: TestCaseItemProps) {
  return (
    <div
      class="test-item group"
      classList={{ "test-item--selected": props.isSelected }}
      style={{ "padding-left": `${props.depth * 16 + 8}px` }}
      onClick={props.onSelect}
      onDblClick={props.onGoToSource}
      tabIndex={0}
      role="treeitem"
      aria-selected={props.isSelected}
    >
      <span class="test-item-status">
        {getStatusIcon(props.test.status)}
      </span>
      
      <span class="test-item-icon">
        <Icon name="bullseye" class="w-3.5 h-3.5" style={{ color: "var(--text-weaker)" }} />
      </span>
      
      <span class="test-item-name" title={props.test.fullName}>
        {props.test.name}
      </span>
      
      <Show when={props.test.duration !== undefined}>
        <span class="test-item-duration">
          {formatDuration(props.test.duration)}
        </span>
      </Show>
      
      <div class="test-item-actions">
        <IconButton
          class="test-item-action"
          onClick={(e) => { e.stopPropagation(); props.onRun(); }}
          tooltip="Run Test"
          size="sm"
        >
          <Icon name="play" class="w-3 h-3" />
        </IconButton>
        <Show when={props.onDebug}>
          <IconButton
            class="test-item-action"
            onClick={(e) => { e.stopPropagation(); props.onDebug?.(); }}
            tooltip="Debug Test"
            size="sm"
          >
            <Icon name="bullseye" class="w-3 h-3" />
          </IconButton>
        </Show>
        <IconButton
          class="test-item-action"
          onClick={(e) => { e.stopPropagation(); props.onGoToSource(); }}
          tooltip="Go to Source"
          size="sm"
        >
          <Icon name="arrow-up-right-from-square" class="w-3 h-3" />
        </IconButton>
      </div>
    </div>
  );
}

// ============================================================================
// TestSuiteItem Component
// ============================================================================

interface TestSuiteItemProps {
  suite: TestSuite;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  selectedTestId: string | null;
  onToggle: () => void;
  onSelect: () => void;
  onRun: () => void;
  onSelectTest: (testId: string) => void;
  onRunTest: (test: TestCase) => void;
  onRunSuite: (suite: TestSuite) => void;
  onDebugTest?: (test: TestCase) => void;
  onGoToSource: (filePath: string, lineNumber?: number) => void;
}

function TestSuiteItem(props: TestSuiteItemProps) {
  const status = createMemo(() => computeSuiteStatus(props.suite));
  const testCount = createMemo(() => {
    let count = props.suite.tests.length;
    const countNested = (s: TestSuite): number => {
      return s.tests.length + s.suites.reduce((acc, nested) => acc + countNested(nested), 0);
    };
    count += props.suite.suites.reduce((acc, nested) => acc + countNested(nested), 0);
    return count;
  });

  return (
    <div class="test-suite-node">
      <div
        class="test-item group"
        classList={{ "test-item--selected": props.isSelected }}
        style={{ "padding-left": `${props.depth * 16 + 8}px` }}
        onClick={() => { props.onSelect(); props.onToggle(); }}
        tabIndex={0}
        role="treeitem"
        aria-expanded={props.isExpanded}
        aria-selected={props.isSelected}
      >
        <span
          class="test-item-chevron"
          classList={{ "test-item-chevron--expanded": props.isExpanded }}
        >
          <Icon name="chevron-right" class="w-3 h-3" />
        </span>
        
        <span class="test-item-status">
          {getStatusIcon(status())}
        </span>
        
        <span class="test-item-name" title={props.suite.name}>
          {props.suite.name}
        </span>
        
        <span class="test-item-count">
          {testCount()}
        </span>
        
        <Show when={props.suite.duration !== undefined}>
          <span class="test-item-duration">
            {formatDuration(props.suite.duration)}
          </span>
        </Show>
        
        <div class="test-item-actions">
          <IconButton
            class="test-item-action"
            onClick={(e) => { e.stopPropagation(); props.onRun(); }}
            tooltip="Run Suite"
            size="sm"
          >
            <Icon name="play" class="w-3 h-3" />
          </IconButton>
        </div>
      </div>
      
      <Show when={props.isExpanded}>
        <div class="test-suite-children" role="group">
          <For each={props.suite.tests}>
            {(test) => (
              <TestCaseItem
                test={test}
                depth={props.depth + 1}
                isSelected={props.selectedTestId === test.id}
                onSelect={() => props.onSelectTest(test.id)}
                onRun={() => props.onRunTest(test)}
                onDebug={props.onDebugTest ? () => props.onDebugTest?.(test) : undefined}
                onGoToSource={() => props.onGoToSource(test.filePath, test.lineNumber)}
              />
            )}
          </For>
          <For each={props.suite.suites}>
            {(nested) => (
              <TestSuiteItemInner
                suite={nested}
                depth={props.depth + 1}
                selectedTestId={props.selectedTestId}
                onSelectTest={props.onSelectTest}
                onRunTest={props.onRunTest}
                onRunSuite={props.onRunSuite}
                onDebugTest={props.onDebugTest}
                onGoToSource={props.onGoToSource}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// TestSuiteItemInner Component (for nested suites with their own expand state)
// ============================================================================

interface TestSuiteItemInnerProps {
  suite: TestSuite;
  depth: number;
  selectedTestId: string | null;
  onSelectTest: (testId: string) => void;
  onRunTest: (test: TestCase) => void;
  onRunSuite: (suite: TestSuite) => void;
  onDebugTest?: (test: TestCase) => void;
  onGoToSource: (filePath: string, lineNumber?: number) => void;
}

function TestSuiteItemInner(props: TestSuiteItemInnerProps) {
  const [isExpanded, setIsExpanded] = createSignal(true);
  const [isSelected, setIsSelected] = createSignal(false);
  const status = createMemo(() => computeSuiteStatus(props.suite));
  const testCount = createMemo(() => {
    let count = props.suite.tests.length;
    const countNested = (s: TestSuite): number => {
      return s.tests.length + s.suites.reduce((acc, nested) => acc + countNested(nested), 0);
    };
    count += props.suite.suites.reduce((acc, nested) => acc + countNested(nested), 0);
    return count;
  });

  return (
    <div class="test-suite-node">
      <div
        class="test-item group"
        classList={{ "test-item--selected": isSelected() }}
        style={{ "padding-left": `${props.depth * 16 + 8}px` }}
        onClick={() => { setIsSelected(true); setIsExpanded(!isExpanded()); }}
        tabIndex={0}
        role="treeitem"
        aria-expanded={isExpanded()}
        aria-selected={isSelected()}
      >
        <span
          class="test-item-chevron"
          classList={{ "test-item-chevron--expanded": isExpanded() }}
        >
          <Icon name="chevron-right" class="w-3 h-3" />
        </span>
        
        <span class="test-item-status">
          {getStatusIcon(status())}
        </span>
        
        <span class="test-item-name" title={props.suite.name}>
          {props.suite.name}
        </span>
        
        <span class="test-item-count">
          {testCount()}
        </span>
        
        <Show when={props.suite.duration !== undefined}>
          <span class="test-item-duration">
            {formatDuration(props.suite.duration)}
          </span>
        </Show>
        
        <div class="test-item-actions">
          <IconButton
            class="test-item-action"
            onClick={(e) => { e.stopPropagation(); props.onRunSuite(props.suite); }}
            tooltip="Run Suite"
            size="sm"
          >
            <Icon name="play" class="w-3 h-3" />
          </IconButton>
        </div>
      </div>
      
      <Show when={isExpanded()}>
        <div class="test-suite-children" role="group">
          <For each={props.suite.tests}>
            {(test) => (
              <TestCaseItem
                test={test}
                depth={props.depth + 1}
                isSelected={props.selectedTestId === test.id}
                onSelect={() => props.onSelectTest(test.id)}
                onRun={() => props.onRunTest(test)}
                onDebug={props.onDebugTest ? () => props.onDebugTest?.(test) : undefined}
                onGoToSource={() => props.onGoToSource(test.filePath, test.lineNumber)}
              />
            )}
          </For>
          <For each={props.suite.suites}>
            {(nested) => (
              <TestSuiteItemInner
                suite={nested}
                depth={props.depth + 1}
                selectedTestId={props.selectedTestId}
                onSelectTest={props.onSelectTest}
                onRunTest={props.onRunTest}
                onRunSuite={props.onRunSuite}
                onDebugTest={props.onDebugTest}
                onGoToSource={props.onGoToSource}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// TestFileItem Component
// ============================================================================

interface TestFileItemProps {
  file: TestFile;
  isExpanded: boolean;
  isSelected: boolean;
  selectedTestId: string | null;
  onToggle: () => void;
  onSelect: () => void;
  onRun: () => void;
  onSelectTest: (testId: string) => void;
  onRunTest: (test: TestCase) => void;
  onRunSuite: (suite: TestSuite) => void;
  onDebugTest?: (test: TestCase) => void;
  onGoToSource: (filePath: string, lineNumber?: number) => void;
}

function TestFileItem(props: TestFileItemProps) {
  const status = createMemo(() => computeFileStatus(props.file));
  const testCount = createMemo(() => {
    let count = props.file.tests.length;
    const countInSuite = (s: TestSuite): number => {
      return s.tests.length + s.suites.reduce((acc, nested) => acc + countInSuite(nested), 0);
    };
    count += props.file.suites.reduce((acc, suite) => acc + countInSuite(suite), 0);
    return count;
  });

  const [expandedSuites, setExpandedSuites] = createSignal<Set<string>>(new Set());

  const toggleSuite = (suiteId: string) => {
    setExpandedSuites(prev => {
      const next = new Set(prev);
      if (next.has(suiteId)) {
        next.delete(suiteId);
      } else {
        next.add(suiteId);
      }
      return next;
    });
  };

  // Auto-expand suites when file expands
  createEffect(() => {
    if (props.isExpanded && expandedSuites().size === 0) {
      setExpandedSuites(new Set(props.file.suites.map(s => s.id)));
    }
  });

  return (
    <div class="test-file-node">
      <div
        class="test-item group"
        classList={{ "test-item--selected": props.isSelected }}
        style={{ "padding-left": tokens.spacing.md }}
        onClick={() => { props.onSelect(); props.onToggle(); }}
        tabIndex={0}
        role="treeitem"
        aria-expanded={props.isExpanded}
        aria-selected={props.isSelected}
      >
        <span
          class="test-item-chevron"
          classList={{ "test-item-chevron--expanded": props.isExpanded }}
        >
          <Icon name="chevron-right" class="w-3 h-3" />
        </span>
        
        <span class="test-item-status">
          {getStatusIcon(status())}
        </span>
        
        <span class="test-item-icon">
          <Icon name="file" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
        </span>
        
        <span class="test-item-name" title={props.file.path}>
          {props.file.name}
        </span>
        
        <span class="test-item-count">
          {testCount()}
        </span>
        
        <Show when={props.file.duration !== undefined}>
          <span class="test-item-duration">
            {formatDuration(props.file.duration)}
          </span>
        </Show>
        
        <div class="test-item-actions">
          <IconButton
            class="test-item-action"
            onClick={(e) => { e.stopPropagation(); props.onRun(); }}
            tooltip="Run File Tests"
            size="sm"
          >
            <Icon name="play" class="w-3 h-3" />
          </IconButton>
          <IconButton
            class="test-item-action"
            onClick={(e) => { e.stopPropagation(); props.onGoToSource(props.file.path); }}
            tooltip="Go to File"
            size="sm"
          >
            <Icon name="arrow-up-right-from-square" class="w-3 h-3" />
          </IconButton>
        </div>
      </div>
      
      <Show when={props.isExpanded}>
        <div class="test-file-children" role="group">
          <For each={props.file.tests}>
            {(test) => (
              <TestCaseItem
                test={test}
                depth={1}
                isSelected={props.selectedTestId === test.id}
                onSelect={() => props.onSelectTest(test.id)}
                onRun={() => props.onRunTest(test)}
                onDebug={props.onDebugTest ? () => props.onDebugTest?.(test) : undefined}
                onGoToSource={() => props.onGoToSource(test.filePath, test.lineNumber)}
              />
            )}
          </For>
          <For each={props.file.suites}>
            {(suite) => (
              <TestSuiteItem
                suite={suite}
                depth={1}
                isExpanded={expandedSuites().has(suite.id)}
                isSelected={false}
                selectedTestId={props.selectedTestId}
                onToggle={() => toggleSuite(suite.id)}
                onSelect={() => {}}
                onRun={() => props.onRunSuite(suite)}
                onSelectTest={props.onSelectTest}
                onRunTest={props.onRunTest}
                onRunSuite={props.onRunSuite}
                onDebugTest={props.onDebugTest}
                onGoToSource={props.onGoToSource}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// StatusFilterButton Component
// ============================================================================

export interface StatusFilterButtonProps {
  filter: StatusFilter;
  currentFilter: StatusFilter;
  count: number;
  onClick: () => void;
  icon: any;
  label: string;
  color?: string;
}

// Exported for potential reuse in other test UIs
export function StatusFilterButton(props: StatusFilterButtonProps) {
  return (
    <Button
      class="test-status-filter"
      classList={{ "test-status-filter--active": props.currentFilter === props.filter }}
      onClick={props.onClick}
      title={`Show ${props.label} (${props.count})`}
      variant="ghost"
      size="sm"
    >
      <span style={{ color: props.color }}>{props.icon}</span>
      <span class="test-status-filter-count">{props.count}</span>
    </Button>
  );
}

// ============================================================================
// Main TestExplorer Component
// ============================================================================

export function TestExplorer(props: TestExplorerProps) {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [showSearch, setShowSearch] = createSignal(false);
  const [statusFilter, setStatusFilter] = createSignal<StatusFilter>("all");
  const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(new Set());
  const [selectedFileId, setSelectedFileId] = createSignal<string | null>(null);
  const [selectedTestId, setSelectedTestId] = createSignal<string | null>(null);
  const [showFilterMenu, setShowFilterMenu] = createSignal(false);

  let searchInputRef: HTMLInputElement | undefined;
  let filterMenuRef: HTMLDivElement | undefined;

  const files = createMemo(() => props.files || []);
  const counts = createMemo(() => countTests(files()));
  const totalDuration = createMemo(() => {
    return files().reduce((acc, f) => acc + (f.duration || 0), 0);
  });

  const filteredFiles = createMemo(() => {
    return filterTestsByStatus(files(), statusFilter(), searchQuery());
  });

  const hasFailedTests = createMemo(() => counts().failed > 0);
  const hasRunningTests = createMemo(() => counts().running > 0 || props.isRunning);

  // Auto-focus search input when shown
  createEffect(() => {
    if (showSearch() && searchInputRef) {
      searchInputRef.focus();
    }
  });

  // Close filter menu on outside click
  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterMenuRef && !filterMenuRef.contains(e.target as Node)) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
  });

  const toggleFile = (fileId: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedFiles(new Set(files().map(f => f.id)));
  };

  const collapseAll = () => {
    setExpandedFiles(new Set<string>());
  };

  const handleRunAll = () => {
    props.onRunAll?.();
  };

  const handleRunFailed = () => {
    props.onRunFailed?.();
  };

  const handleStopTests = () => {
    props.onStopTests?.();
  };

  const handleRunFile = (file: TestFile) => {
    props.onRunFile?.(file);
  };

  const handleRunSuite = (suite: TestSuite) => {
    props.onRunSuite?.(suite);
  };

  const handleRunTest = (test: TestCase) => {
    props.onRunTest?.(test);
  };

  const handleDebugTest = (test: TestCase) => {
    props.onDebugTest?.(test);
  };

  const handleGoToSource = (filePath: string, lineNumber?: number) => {
    props.onGoToTest?.(filePath, lineNumber);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && showSearch()) {
      setShowSearch(false);
      setSearchQuery("");
    }
  };

  return (
    <div class="test-explorer" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div class="test-explorer-header">
        <span class="test-explorer-title">Tests</span>
        <div class="test-explorer-actions">
          <IconButton
            class="test-explorer-action"
            onClick={() => setShowSearch(!showSearch())}
            tooltip="Search tests (Ctrl+F)"
            active={showSearch()}
            size="sm"
          >
            <Icon name="magnifying-glass" class="w-3.5 h-3.5" />
          </IconButton>
          
          <div class="test-explorer-filter-container" ref={filterMenuRef}>
            <IconButton
              class="test-explorer-action"
              onClick={() => setShowFilterMenu(!showFilterMenu())}
              tooltip="Filter tests"
              active={statusFilter() !== "all"}
              size="sm"
            >
              <Icon name="filter" class="w-3.5 h-3.5" />
            </IconButton>
            
            <Show when={showFilterMenu()}>
              <div class="test-explorer-filter-menu">
                <Button
                  class="test-explorer-filter-item"
                  classList={{ "test-explorer-filter-item--active": statusFilter() === "all" }}
                  onClick={() => { setStatusFilter("all"); setShowFilterMenu(false); }}
                  variant="ghost"
                  size="sm"
                >
                  <Icon name="minus" class="w-3.5 h-3.5" />
                  <span>All</span>
                  <span class="test-explorer-filter-count">{counts().total}</span>
                </Button>
                <Button
                  class="test-explorer-filter-item"
                  classList={{ "test-explorer-filter-item--active": statusFilter() === "passed" }}
                  onClick={() => { setStatusFilter("passed"); setShowFilterMenu(false); }}
                  variant="ghost"
                  size="sm"
                >
                  <Icon name="check" class="w-3.5 h-3.5 text-green-400" />
                  <span>Passed</span>
                  <span class="test-explorer-filter-count">{counts().passed}</span>
                </Button>
                <Button
                  class="test-explorer-filter-item"
                  classList={{ "test-explorer-filter-item--active": statusFilter() === "failed" }}
                  onClick={() => { setStatusFilter("failed"); setShowFilterMenu(false); }}
                  variant="ghost"
                  size="sm"
                >
                  <Icon name="xmark" class="w-3.5 h-3.5 text-red-400" />
                  <span>Failed</span>
                  <span class="test-explorer-filter-count">{counts().failed}</span>
                </Button>
                <Button
                  class="test-explorer-filter-item"
                  classList={{ "test-explorer-filter-item--active": statusFilter() === "skipped" }}
                  onClick={() => { setStatusFilter("skipped"); setShowFilterMenu(false); }}
                  variant="ghost"
                  size="sm"
                >
                  <Icon name="forward-step" class="w-3.5 h-3.5 text-yellow-400" />
                  <span>Skipped</span>
                  <span class="test-explorer-filter-count">{counts().skipped}</span>
                </Button>
                <Button
                  class="test-explorer-filter-item"
                  classList={{ "test-explorer-filter-item--active": statusFilter() === "running" }}
                  onClick={() => { setStatusFilter("running"); setShowFilterMenu(false); }}
                  variant="ghost"
                  size="sm"
                >
                  <Icon name="play" class="w-3.5 h-3.5 text-blue-400" />
                  <span>Running</span>
                  <span class="test-explorer-filter-count">{counts().running}</span>
                </Button>
              </div>
            </Show>
          </div>
          
          <IconButton
            class="test-explorer-action"
            onClick={expandAll}
            tooltip="Expand All"
            size="sm"
          >
            <Icon name="folder" class="w-3.5 h-3.5" />
          </IconButton>
          
          <IconButton
            class="test-explorer-action"
            onClick={collapseAll}
            tooltip="Collapse All"
            size="sm"
          >
            <Icon name="folder-minus" class="w-3.5 h-3.5" />
          </IconButton>
          
          <IconButton
            class="test-explorer-action"
            onClick={handleRunAll}
            disabled={hasRunningTests()}
            tooltip="Run All Tests"
            size="sm"
          >
            <Icon name="play" class="w-3.5 h-3.5" />
          </IconButton>
          
          <Show when={props.onToggleWatchMode}>
            <IconButton
              class="test-explorer-action"
              classList={{
                "test-explorer-action--active": props.watchMode,
                "test-explorer-action--watch": props.watchMode,
              }}
              onClick={() => props.onToggleWatchMode?.()}
              tooltip={props.watchMode ? "Watch Mode Active (click to disable)" : "Enable Watch Mode (auto-run on file change)"}
              active={props.watchMode}
              size="sm"
            >
              <Icon name="wave-pulse" class="w-3.5 h-3.5" />
            </IconButton>
          </Show>

          <Show when={props.onToggleContinuousRun}>
            <IconButton
              class="test-explorer-action"
              classList={{
                "test-explorer-action--active": props.continuousRun,
                "test-explorer-action--continuous": props.continuousRun,
              }}
              onClick={() => props.onToggleContinuousRun?.()}
              tooltip={props.continuousRun ? "Continuous Testing Active (click to disable)" : "Enable Continuous Testing (auto-run on save)"}
              active={props.continuousRun}
              size="sm"
            >
              <Icon name="bolt" class="w-3.5 h-3.5" />
            </IconButton>
          </Show>
          
          <Show when={props.onToggleCoverage}>
            <IconButton
              class="test-explorer-action"
              classList={{
                "test-explorer-action--active": props.showCoverage,
                "test-explorer-action--coverage": props.showCoverage,
              }}
              onClick={() => props.onToggleCoverage?.()}
              tooltip={props.showCoverage ? "Hide Coverage Overlay" : "Show Coverage Overlay"}
              active={props.showCoverage}
              size="sm"
            >
              {props.showCoverage ? <Icon name="eye" class="w-3.5 h-3.5" /> : <Icon name="eye-slash" class="w-3.5 h-3.5" />}
            </IconButton>
          </Show>

          <Show when={props.onRunWithCoverage}>
            <IconButton
              class="test-explorer-action"
              onClick={() => props.onRunWithCoverage?.()}
              disabled={hasRunningTests()}
              tooltip="Run Tests with Coverage"
              size="sm"
            >
              <Icon name="bullseye" class="w-3.5 h-3.5" />
            </IconButton>
          </Show>
          
          <Show when={hasRunningTests()}>
            <IconButton
              class="test-explorer-action test-explorer-action--danger"
              onClick={handleStopTests}
              tooltip="Stop Tests"
              size="sm"
            >
              <Icon name="stop" class="w-3.5 h-3.5" />
            </IconButton>
          </Show>
          
          <Show when={hasFailedTests() && !hasRunningTests()}>
            <IconButton
              class="test-explorer-action test-explorer-action--warning"
              onClick={handleRunFailed}
              tooltip="Re-run Failed Tests"
              size="sm"
            >
              <Icon name="rotate" class="w-3.5 h-3.5" />
            </IconButton>
          </Show>
        </div>
      </div>

      {/* Search Bar */}
      <Show when={showSearch()}>
        <div class="test-explorer-search">
          <div class="test-explorer-search-wrapper">
            <Icon name="magnifying-glass" class="w-3.5 h-3.5" style={{ color: "var(--text-weaker)" }} />
            <input
              ref={searchInputRef}
              type="text"
              class="test-explorer-search-input"
              placeholder="Filter tests by name..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
            />
            <Show when={searchQuery()}>
              <IconButton
                class="test-explorer-search-clear"
                onClick={() => setSearchQuery("")}
                tooltip="Clear"
                size="sm"
              >
                <Icon name="xmark" class="w-3 h-3" />
              </IconButton>
            </Show>
          </div>
        </div>
      </Show>

      {/* Summary Bar */}
      <Show when={counts().total > 0}>
        <div class="test-explorer-summary">
          <div class="test-explorer-summary-stats">
            <span class="test-summary-stat test-summary-stat--total">
              {counts().total} tests
            </span>
            <Show when={counts().passed > 0}>
              <span class="test-summary-stat test-summary-stat--passed">
                <Icon name="check" class="w-3 h-3" />
                {counts().passed}
              </span>
            </Show>
            <Show when={counts().failed > 0}>
              <span class="test-summary-stat test-summary-stat--failed">
                <Icon name="xmark" class="w-3 h-3" />
                {counts().failed}
              </span>
            </Show>
            <Show when={counts().skipped > 0}>
              <span class="test-summary-stat test-summary-stat--skipped">
                <Icon name="forward-step" class="w-3 h-3" />
                {counts().skipped}
              </span>
            </Show>
          </div>
          <Show when={totalDuration() > 0}>
            <span class="test-explorer-summary-duration">
              <Icon name="clock" class="w-3 h-3" />
              {formatDuration(totalDuration())}
            </span>
          </Show>
        </div>
      </Show>

      {/* Watch Mode Indicator */}
      <Show when={props.watchMode}>
        <div class="test-explorer-status-bar test-explorer-watch-bar">
          <div class="test-explorer-status-indicator">
            <Icon name="wave-pulse" class="w-3 h-3" />
            <span>Watch Mode</span>
          </div>
          <span class="test-explorer-status-hint">Watching for file changes...</span>
        </div>
      </Show>

      {/* Continuous Testing Indicator */}
      <Show when={props.continuousRun && !props.watchMode}>
        <div class="test-explorer-status-bar test-explorer-continuous-bar">
          <div class="test-explorer-status-indicator">
            <Icon name="bolt" class="w-3 h-3" />
            <span>Continuous Testing</span>
          </div>
          <Show when={props.lastAutoRunTime}>
            <span class="test-explorer-status-time">
              Last run: {formatLastRunTime(props.lastAutoRunTime)}
            </span>
          </Show>
        </div>
      </Show>

      {/* Coverage Summary */}
      <Show when={props.showCoverage && props.coveragePercentage !== undefined}>
        <div class="test-explorer-status-bar test-explorer-coverage-bar">
          <div class="test-explorer-status-indicator">
            <Icon name="eye" class="w-3 h-3" />
            <span>Coverage</span>
          </div>
          <div class="test-explorer-coverage-summary">
            <div class="test-explorer-coverage-progress">
              <div 
                class="test-explorer-coverage-fill"
                classList={{
                  "test-explorer-coverage-fill--low": (props.coveragePercentage || 0) < 50,
                  "test-explorer-coverage-fill--medium": (props.coveragePercentage || 0) >= 50 && (props.coveragePercentage || 0) < 80,
                  "test-explorer-coverage-fill--high": (props.coveragePercentage || 0) >= 80,
                }}
                style={{ width: `${props.coveragePercentage || 0}%` }}
              />
            </div>
            <span class="test-explorer-coverage-percent">
              {props.coveragePercentage?.toFixed(1) || 0}%
            </span>
          </div>
        </div>
      </Show>

      {/* Content */}
      <div class="test-explorer-content" role="tree" aria-label="Test explorer">
        <Show
          when={filteredFiles().length > 0}
          fallback={
            <div class="test-explorer-empty">
              <Show
                when={files().length === 0}
                fallback={
                  <>
                    <Icon name="magnifying-glass" class="w-8 h-8" style={{ color: "var(--text-weaker)", opacity: 0.5 }} />
                    <p class="test-explorer-empty-title">No matching tests</p>
                    <p class="test-explorer-empty-hint">
                      Try adjusting your search or filter
                    </p>
                  </>
                }
              >
                <Icon name="circle-exclamation" class="w-8 h-8" style={{ color: "var(--text-weaker)", opacity: 0.5 }} />
                <p class="test-explorer-empty-title">No tests found</p>
                <p class="test-explorer-empty-hint">
                  Run your test framework to discover tests
                </p>
              </Show>
            </div>
          }
        >
          <For each={filteredFiles()}>
            {(file) => (
              <TestFileItem
                file={file}
                isExpanded={expandedFiles().has(file.id)}
                isSelected={selectedFileId() === file.id}
                selectedTestId={selectedTestId()}
                onToggle={() => toggleFile(file.id)}
                onSelect={() => setSelectedFileId(file.id)}
                onRun={() => handleRunFile(file)}
                onSelectTest={setSelectedTestId}
                onRunTest={handleRunTest}
                onRunSuite={handleRunSuite}
                onDebugTest={props.onDebugTest ? handleDebugTest : undefined}
                onGoToSource={handleGoToSource}
              />
            )}
          </For>
        </Show>
      </div>

      {/* Inline Styles */}
      <style>{`
        .test-explorer {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--background-base);
        }

        .test-explorer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-md) var(--space-panel-header-x);
          border-bottom: 1px solid var(--border-weak);
          min-height: var(--height-button-md);
        }

        .test-explorer-title {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-weak);
        }

        .test-explorer-actions {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .test-explorer-action {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: var(--cortex-radius-sm);
          color: var(--text-weak);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background-color 0.1s, color 0.1s;
        }

        .test-explorer-action:hover:not(:disabled) {
          background: var(--surface-raised);
          color: var(--text-base);
        }

        .test-explorer-action:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .test-explorer-action--active {
          background: var(--surface-raised);
          color: var(--text-base);
        }

        .test-explorer-action--danger {
          color: var(--cortex-error);
        }

        .test-explorer-action--danger:hover {
          background: rgba(248, 113, 113, 0.15);
          color: var(--cortex-error);
        }

        .test-explorer-action--warning {
          color: var(--cortex-warning);
        }

        .test-explorer-action--warning:hover {
          background: rgba(251, 191, 36, 0.15);
          color: var(--cortex-warning);
        }

        .test-explorer-action--watch {
          color: var(--cortex-info);
          animation: watch-pulse 2s ease-in-out infinite;
        }

        .test-explorer-action--watch:hover {
          background: rgba(59, 130, 246, 0.15);
          color: var(--cortex-info);
        }

        .test-explorer-action--continuous {
          color: var(--cortex-success);
          animation: continuous-pulse 2s ease-in-out infinite;
        }

        .test-explorer-action--continuous:hover {
          background: rgba(34, 197, 94, 0.15);
          color: var(--cortex-success);
        }

        .test-explorer-action--coverage {
          color: var(--cortex-info);
        }

        .test-explorer-action--coverage:hover {
          background: rgba(168, 85, 247, 0.15);
          color: var(--cortex-info);
        }

        @keyframes continuous-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        @keyframes watch-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .test-explorer-status-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 12px;
          border-bottom: 1px solid var(--border-weak);
        }

        .test-explorer-watch-bar {
          background: rgba(59, 130, 246, 0.1);
          border-bottom-color: rgba(59, 130, 246, 0.2);
        }

        .test-explorer-continuous-bar {
          background: rgba(34, 197, 94, 0.1);
          border-bottom-color: rgba(34, 197, 94, 0.2);
        }

        .test-explorer-coverage-bar {
          background: rgba(168, 85, 247, 0.1);
          border-bottom-color: rgba(168, 85, 247, 0.2);
        }

        .test-explorer-status-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 500;
        }

        .test-explorer-watch-bar .test-explorer-status-indicator {
          color: var(--cortex-info);
        }

        .test-explorer-watch-bar .test-explorer-status-indicator svg {
          animation: watch-pulse 2s ease-in-out infinite;
        }

        .test-explorer-continuous-bar .test-explorer-status-indicator {
          color: var(--cortex-success);
        }

        .test-explorer-continuous-bar .test-explorer-status-indicator svg {
          animation: continuous-pulse 2s ease-in-out infinite;
        }

        .test-explorer-coverage-bar .test-explorer-status-indicator {
          color: var(--cortex-info);
        }

        .test-explorer-status-time,
        .test-explorer-status-hint {
          font-size: 10px;
          color: var(--text-weaker);
        }

        .test-explorer-coverage-summary {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .test-explorer-coverage-progress {
          width: 60px;
          height: 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: var(--cortex-radius-sm);
          overflow: hidden;
        }

        .test-explorer-coverage-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .test-explorer-coverage-fill--low {
          background: var(--cortex-error);
        }

        .test-explorer-coverage-fill--medium {
          background: var(--cortex-warning);
        }

        .test-explorer-coverage-fill--high {
          background: var(--cortex-success);
        }

        .test-explorer-coverage-percent {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-weak);
          min-width: 36px;
          text-align: right;
        }

        .test-explorer-filter-container {
          position: relative;
        }

        .test-explorer-filter-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          min-width: 140px;
          padding: 4px 0;
          background: var(--surface-raised);
          border: 1px solid var(--border-base);
          border-radius: var(--cortex-radius-md);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 100;
        }

        .test-explorer-filter-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 6px 12px;
          font-size: 12px;
          color: var(--text-base);
          background: transparent;
          border: none;
          text-align: left;
          cursor: pointer;
          transition: background-color 0.1s;
        }

        .test-explorer-filter-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .test-explorer-filter-item--active {
          background: rgba(255, 255, 255, 0.08);
        }

        .test-explorer-filter-count {
          margin-left: auto;
          font-size: 11px;
          color: var(--text-weaker);
        }

        .test-explorer-search {
          padding: 8px 8px 0 8px;
          margin-bottom: 8px;
          background: var(--surface-base);
        }

        .test-explorer-search-wrapper {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 4px 8px;
          background: var(--input-background, var(--surface-sunken));
          border: 1px solid var(--input-border, var(--border-weak));
          border-radius: var(--cortex-radius-sm);
          transition: border-color 0.1s ease;
        }

        .test-explorer-search-wrapper:focus-within {
          border-color: var(--cortex-info);
        }

        .test-explorer-search-wrapper svg:first-child {
          margin-right: 8px;
          flex-shrink: 0;
        }

        .test-explorer-search-input {
          flex: 1;
          padding: 0;
          font-size: 13px;
          color: var(--text-base);
          background: transparent;
          border: none;
          outline: none;
        }

        .test-explorer-search-input::placeholder {
          color: var(--text-weaker);
        }

        .test-explorer-search-clear {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          margin-left: 4px;
          border-radius: 50%;
          color: var(--text-weak);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background-color 0.1s, color 0.1s;
        }

        .test-explorer-search-clear:hover {
          background: var(--surface-raised);
          color: var(--text-base);
        }

        .test-explorer-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          border-bottom: 1px solid var(--border-weak);
          background: var(--surface-base);
        }

        .test-explorer-summary-stats {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .test-summary-stat {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 500;
        }

        .test-summary-stat--total {
          color: var(--text-weak);
        }

        .test-summary-stat--passed {
          color: var(--cortex-success);
        }

        .test-summary-stat--failed {
          color: var(--cortex-error);
        }

        .test-summary-stat--skipped {
          color: var(--cortex-warning);
        }

        .test-explorer-summary-duration {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--text-weaker);
        }

        .test-explorer-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 4px 0;
        }

        .test-explorer-content::-webkit-scrollbar {
          width: 4px;
        }

        .test-explorer-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .test-explorer-content::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: var(--cortex-radius-sm);
        }

        .test-explorer-content:hover::-webkit-scrollbar-thumb {
          background: var(--border-base);
        }

        .test-explorer-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          text-align: center;
        }

        .test-explorer-empty-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-weak);
          margin: 12px 0 4px;
        }

        .test-explorer-empty-hint {
          font-size: 12px;
          color: var(--text-weaker);
          margin: 0;
        }

        .test-file-node,
        .test-suite-node {
          user-select: none;
        }

        .test-item {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 26px;
          padding-right: 8px;
          font-size: 12px;
          color: var(--text-base);
          cursor: pointer;
          transition: background-color 0.1s;
        }

        .test-item:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        .test-item:focus-visible {
          outline: none;
          background: rgba(255, 255, 255, 0.06);
          box-shadow: inset 2px 0 0 var(--text-weak);
        }

        .test-item--selected {
          background: rgba(255, 255, 255, 0.08);
        }

        .test-item--selected:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .test-item-chevron {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          flex-shrink: 0;
          color: var(--text-weaker);
          transition: transform 0.15s ease;
        }

        .test-item-chevron--expanded {
          transform: rotate(90deg);
        }

        .test-item-status {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .test-item-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .test-item-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }

        .test-item-count {
          flex-shrink: 0;
          padding: 1px 6px;
          font-size: 10px;
          font-weight: 500;
          color: var(--text-weaker);
          background: var(--surface-raised);
          border-radius: var(--cortex-radius-lg);
        }

        .test-item-duration {
          flex-shrink: 0;
          font-size: 10px;
          color: var(--text-weaker);
          font-family: "SF Mono", "Fira Code", Consolas, monospace;
        }

        .test-item-actions {
          display: flex;
          align-items: center;
          gap: 2px;
          opacity: 0;
          transition: opacity 0.1s;
        }

        .test-item:hover .test-item-actions,
        .test-item--selected .test-item-actions {
          opacity: 1;
        }

        .test-item-action {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: var(--cortex-radius-sm);
          color: var(--text-weak);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background-color 0.1s, color 0.1s;
        }

        .test-item-action:hover {
          background: var(--surface-raised);
          color: var(--text-base);
        }

        .test-file-children,
        .test-suite-children {
          /* Children container */
        }

        .test-status-filter {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 6px;
          border-radius: var(--cortex-radius-sm);
          font-size: 11px;
          color: var(--text-weak);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background-color 0.1s;
        }

        .test-status-filter:hover {
          background: var(--surface-raised);
        }

        .test-status-filter--active {
          background: var(--surface-raised);
          color: var(--text-base);
        }

        .test-status-filter-count {
          font-size: 10px;
          color: var(--text-weaker);
        }

        .text-green-400 { color: var(--cortex-success); }
        .text-red-400 { color: var(--cortex-error); }
        .text-yellow-400 { color: var(--cortex-warning); }
        .text-blue-400 { color: var(--cortex-info); }
      `}</style>
    </div>
  );
}

