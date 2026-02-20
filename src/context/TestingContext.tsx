import {
  createContext,
  useContext,
  ParentComponent,
  onMount,
  onCleanup,
  createMemo,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { getProjectPath } from "../utils/workspace";

// ============================================================================
// Test Framework Detection
// ============================================================================

export type TestFramework = "jest" | "vitest" | "mocha" | "pytest" | "cargo" | "unknown";

export interface TestFrameworkConfig {
  framework: TestFramework;
  configFile?: string;
  command: string;
  args: string[];
  testFilePatterns: string[];
  watchFlag?: string;
  coverageFlag?: string;
}

const FRAMEWORK_CONFIGS: Record<TestFramework, Omit<TestFrameworkConfig, "configFile">> = {
  jest: {
    framework: "jest",
    command: "npx",
    args: ["jest"],
    testFilePatterns: ["**/*.test.{js,jsx,ts,tsx}", "**/*.spec.{js,jsx,ts,tsx}", "**/__tests__/**/*.{js,jsx,ts,tsx}"],
    watchFlag: "--watch",
    coverageFlag: "--coverage",
  },
  vitest: {
    framework: "vitest",
    command: "npx",
    args: ["vitest", "run"],
    testFilePatterns: ["**/*.test.{js,jsx,ts,tsx}", "**/*.spec.{js,jsx,ts,tsx}"],
    watchFlag: "--watch",
    coverageFlag: "--coverage",
  },
  mocha: {
    framework: "mocha",
    command: "npx",
    args: ["mocha"],
    testFilePatterns: ["**/*.test.{js,ts}", "**/*.spec.{js,ts}", "**/test/**/*.{js,ts}"],
    watchFlag: "--watch",
    coverageFlag: "--coverage",
  },
  pytest: {
    framework: "pytest",
    command: "pytest",
    args: [],
    testFilePatterns: ["**/test_*.py", "**/*_test.py", "**/tests/**/*.py"],
    watchFlag: "--watch",
    coverageFlag: "--cov",
  },
  cargo: {
    framework: "cargo",
    command: "cargo",
    args: ["test"],
    testFilePatterns: ["**/tests/**/*.rs", "**/*_test.rs"],
    watchFlag: "",
    coverageFlag: "",
  },
  unknown: {
    framework: "unknown",
    command: "",
    args: [],
    testFilePatterns: [],
  },
};

// ============================================================================
// Test Types
// ============================================================================

export type TestStatus = "pending" | "running" | "passed" | "failed" | "skipped" | "error";

export interface TestItem {
  id: string;
  name: string;
  fullName: string;
  filePath: string;
  line?: number;
  column?: number;
  type: "file" | "suite" | "test";
  children: TestItem[];
  parentId?: string;
  status: TestStatus;
  duration?: number;
  errorMessage?: string;
  errorStack?: string;
  output?: string[];
}

export interface TestRunResult {
  testId: string;
  status: TestStatus;
  duration: number;
  errorMessage?: string;
  errorStack?: string;
  output: string[];
  startedAt: number;
  finishedAt: number;
}

export interface TestRun {
  id: string;
  startedAt: number;
  finishedAt?: number;
  status: "running" | "completed" | "cancelled" | "error";
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  errorTests: number;
  duration?: number;
  results: Map<string, TestRunResult>;
}

export interface CoverageData {
  totalLines: number;
  coveredLines: number;
  totalBranches: number;
  coveredBranches: number;
  totalFunctions: number;
  coveredFunctions: number;
  totalStatements: number;
  coveredStatements: number;
  files: CoverageFileData[];
  lastUpdated: number;
}

export interface CoverageFileData {
  filePath: string;
  lines: { total: number; covered: number; percentage: number };
  branches: { total: number; covered: number; percentage: number };
  functions: { total: number; covered: number; percentage: number };
  statements: { total: number; covered: number; percentage: number };
  uncoveredLines: number[];
}

// ============================================================================
// Line Coverage Types (for editor decorations)
// ============================================================================

export type LineCoverageStatus = "covered" | "uncovered" | "partial";

export interface LineCoverageData {
  lineNumber: number;
  status: LineCoverageStatus;
  hits: number;
  branches?: {
    covered: number;
    total: number;
  };
}

export interface FileCoverageDecorations {
  filePath: string;
  lines: LineCoverageData[];
  lastUpdated: number;
}

export type TestFilter = "all" | "passed" | "failed" | "skipped" | "running";

// ============================================================================
// Continuous Testing Settings
// ============================================================================

export interface ContinuousTestingSettings {
  enabled: boolean;
  runOnSave: boolean;
  debounceMs: number;
  runAffectedOnly: boolean;
}

const DEFAULT_CONTINUOUS_SETTINGS: ContinuousTestingSettings = {
  enabled: false,
  runOnSave: true,
  debounceMs: 500,
  runAffectedOnly: true,
};

// ============================================================================
// Testing State
// ============================================================================

interface TestingState {
  tests: TestItem[];
  testIndex: Map<string, TestItem>;
  currentRun: TestRun | null;
  runHistory: TestRun[];
  coverage: CoverageData | null;
  coverageDecorations: Map<string, FileCoverageDecorations>;
  showCoverageDecorations: boolean;
  isRunning: boolean;
  isDiscovering: boolean;
  selectedTestId: string | null;
  expandedNodes: Set<string>;
  filter: TestFilter;
  searchQuery: string;
  framework: TestFrameworkConfig | null;
  projectPath: string | null;
  watchMode: boolean;
  watcherId: string | null;
  showCoverage: boolean;
  autoRun: boolean;
  output: string[];
  continuousRun: boolean;
  continuousSettings: ContinuousTestingSettings;
  lastAutoRunTime: number | null;
  lastAutoRunFilePath: string | null;
}

interface TestingContextValue {
  state: TestingState;

  // Test discovery
  discoverTests: (projectPath: string) => Promise<void>;
  refreshTests: () => Promise<void>;
  detectFramework: (projectPath: string) => Promise<TestFrameworkConfig | null>;

  // Test execution
  runTest: (testId: string) => Promise<void>;
  runTests: (testIds: string[]) => Promise<void>;
  runAllTests: () => Promise<void>;
  runFailedTests: () => Promise<void>;
  runTestFile: (filePath: string) => Promise<void>;
  debugTest: (testId: string) => Promise<void>;
  stopTests: () => Promise<void>;

  // Results management
  clearResults: () => void;
  clearOutput: () => void;
  getTestResult: (testId: string) => TestRunResult | undefined;

  // Navigation
  goToTest: (testId: string) => void;
  selectTest: (testId: string | null) => void;
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
  toggleNode: (nodeId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;

  // Filtering
  setFilter: (filter: TestFilter) => void;
  setSearchQuery: (query: string) => void;

  // Settings
  setWatchMode: (enabled: boolean) => Promise<void>;
  toggleWatchMode: () => Promise<void>;
  setShowCoverage: (enabled: boolean) => void;
  setAutoRun: (enabled: boolean) => void;
  runWithCoverage: () => Promise<void>;

  // Continuous Testing
  toggleContinuousRun: () => void;
  setContinuousSettings: (settings: Partial<ContinuousTestingSettings>) => void;
  testOnSave: (filePath: string) => Promise<void>;

  // Coverage Decorations
  toggleCoverageDecorations: () => void;
  setShowCoverageDecorations: (enabled: boolean) => void;
  loadCoverageFromFile: (coveragePath: string) => Promise<void>;
  getCoverageForFile: (filePath: string) => FileCoverageDecorations | undefined;
  clearCoverageDecorations: () => void;

  // Computed
  filteredTests: () => TestItem[];
  testCounts: () => { total: number; passed: number; failed: number; skipped: number; running: number };
  coveragePercentage: () => number;
  failedTestIds: () => string[];
}

const TestingContext = createContext<TestingContextValue>();

// ============================================================================
// Provider
// ============================================================================

export const TestingProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<TestingState>({
    tests: [],
    testIndex: new Map(),
    currentRun: null,
    runHistory: [],
    coverage: null,
    coverageDecorations: new Map(),
    showCoverageDecorations: false,
    isRunning: false,
    isDiscovering: false,
    selectedTestId: null,
    expandedNodes: new Set(),
    filter: "all",
    searchQuery: "",
    framework: null,
    projectPath: null,
    watchMode: false,
    watcherId: null,
    showCoverage: false,
    autoRun: false,
    output: [],
    continuousRun: false,
    continuousSettings: { ...DEFAULT_CONTINUOUS_SETTINGS },
    lastAutoRunTime: null,
    lastAutoRunFilePath: null,
  });

  let unlistenTestEvent: UnlistenFn | null = null;
  let unlistenTestOutput: UnlistenFn | null = null;
  let currentTerminalId: string | null = null;
  let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const pendingSaveFiles: Set<string> = new Set();

  // ============================================================================
  // Framework Detection
  // ============================================================================

  const detectFramework = async (projectPath: string): Promise<TestFrameworkConfig | null> => {
    try {
      const result = await invoke<{
        framework: string;
        configFile?: string;
      }>("testing_detect_framework", { projectPath });

      const framework = result.framework as TestFramework;
      if (framework && framework !== "unknown") {
        const config: TestFrameworkConfig = {
          ...FRAMEWORK_CONFIGS[framework],
          configFile: result.configFile,
        };
        setState("framework", config);
        return config;
      }
    } catch (err) {
      console.debug("[Testing] Backend detection unavailable:", err);
    }

    // Fallback: detect based on common patterns (package.json, config files)
    return await detectFrameworkFallback(projectPath);
  };

  const detectFrameworkFallback = async (projectPath: string): Promise<TestFrameworkConfig | null> => {
    try {
      // Check package.json for JS/TS projects
      const packageJsonContent = await invoke<string>("fs_read_file", {
        path: `${projectPath}/package.json`,
      }).catch(() => null);

      if (packageJsonContent && packageJsonContent !== "undefined") {
        const packageJson = JSON.parse(packageJsonContent);
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        if (deps.vitest) {
          const config: TestFrameworkConfig = {
            ...FRAMEWORK_CONFIGS.vitest,
            configFile: await findConfigFile(projectPath, ["vitest.config.ts", "vitest.config.js", "vite.config.ts"]),
          };
          setState("framework", config);
          return config;
        }

        if (deps.jest) {
          const config: TestFrameworkConfig = {
            ...FRAMEWORK_CONFIGS.jest,
            configFile: await findConfigFile(projectPath, ["jest.config.js", "jest.config.ts", "jest.config.json"]),
          };
          setState("framework", config);
          return config;
        }

        if (deps.mocha) {
          const config: TestFrameworkConfig = {
            ...FRAMEWORK_CONFIGS.mocha,
            configFile: await findConfigFile(projectPath, [".mocharc.js", ".mocharc.json", ".mocharc.yml"]),
          };
          setState("framework", config);
          return config;
        }
      }

      // Check for Cargo.toml (Rust)
      const cargoExists = await invoke<boolean>("fs_exists", {
        path: `${projectPath}/Cargo.toml`,
      }).catch(() => false);

      if (cargoExists) {
        const config: TestFrameworkConfig = { ...FRAMEWORK_CONFIGS.cargo };
        setState("framework", config);
        return config;
      }

      // Check for pytest (Python)
      const pytestConfigs = ["pytest.ini", "pyproject.toml", "setup.cfg", "conftest.py"];
      for (const configFile of pytestConfigs) {
        const exists = await invoke<boolean>("fs_exists", {
          path: `${projectPath}/${configFile}`,
        }).catch(() => false);

        if (exists) {
          const config: TestFrameworkConfig = {
            ...FRAMEWORK_CONFIGS.pytest,
            configFile,
          };
          setState("framework", config);
          return config;
        }
      }
    } catch (error) {
      console.error("[Testing] Fallback framework detection failed:", error);
    }

    return null;
  };

  const findConfigFile = async (projectPath: string, candidates: string[]): Promise<string | undefined> => {
    for (const candidate of candidates) {
      try {
        const exists = await invoke<boolean>("fs_exists", {
          path: `${projectPath}/${candidate}`,
        });
        if (exists) {
          return candidate;
        }
      } catch (err) {
        console.debug("[Testing] Config check failed:", err);
        continue;
      }
    }
    return undefined;
  };

  // ============================================================================
  // Test Discovery
  // ============================================================================

  const discoverTests = async (projectPath: string) => {
    setState("isDiscovering", true);
    setState("projectPath", projectPath);

    try {
      // Detect framework first if not already detected
      if (!state.framework) {
        await detectFramework(projectPath);
      }

      if (!state.framework || state.framework.framework === "unknown") {
        console.warn("[Testing] No test framework detected");
        setState("isDiscovering", false);
        return;
      }

      // Try to discover tests via backend
      const result = await invoke<{
        tests: TestItem[];
      }>("testing_discover", {
        projectPath,
        framework: state.framework.framework,
        patterns: state.framework.testFilePatterns,
      });

      const testIndex = new Map<string, TestItem>();
      const buildIndex = (items: TestItem[]) => {
        for (const item of items) {
          testIndex.set(item.id, item);
          if (item.children.length > 0) {
            buildIndex(item.children);
          }
        }
      };

      buildIndex(result.tests);

      setState("tests", result.tests);
      setState("testIndex", testIndex);

      // Auto-expand file nodes
      const expandedNodes = new Set<string>();
      for (const test of result.tests) {
        if (test.type === "file") {
          expandedNodes.add(test.id);
        }
      }
      setState("expandedNodes", expandedNodes);
    } catch (error) {
      console.error("[Testing] Test discovery failed:", error);
      // Try fallback discovery
      await discoverTestsFallback(projectPath);
    }

    setState("isDiscovering", false);
  };

  const discoverTestsFallback = async (projectPath: string) => {
    if (!state.framework) return;

    try {
      // Use glob to find test files
      const files = await invoke<string[]>("glob_files", {
        basePath: projectPath,
        patterns: state.framework.testFilePatterns,
      });

      const tests: TestItem[] = files.map((filePath) => ({
        id: generateTestId(filePath),
        name: filePath.split("/").pop() || filePath,
        fullName: filePath,
        filePath,
        type: "file" as const,
        children: [],
        status: "pending" as TestStatus,
      }));

      const testIndex = new Map<string, TestItem>();
      for (const test of tests) {
        testIndex.set(test.id, test);
      }

      setState("tests", tests);
      setState("testIndex", testIndex);
    } catch (error) {
      console.error("[Testing] Fallback discovery failed:", error);
    }
  };

  const refreshTests = async () => {
    if (state.projectPath) {
      await discoverTests(state.projectPath);
    }
  };

  // ============================================================================
  // Test Execution
  // ============================================================================

  const runTest = async (testId: string) => {
    await runTests([testId]);
  };

  const runTests = async (testIds: string[]) => {
    if (!state.framework || !state.projectPath) {
      console.error("[Testing] No framework or project path configured");
      return;
    }

    if (state.isRunning) {
      console.warn("[Testing] Tests already running");
      return;
    }

    setState("isRunning", true);
    setState("output", []);

    const runId = crypto.randomUUID();
    const run: TestRun = {
      id: runId,
      startedAt: Date.now(),
      status: "running",
      totalTests: testIds.length,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      errorTests: 0,
      results: new Map(),
    };

    setState("currentRun", run);

    // Mark tests as running
    setState(
      produce((s) => {
        for (const testId of testIds) {
          const test = s.testIndex.get(testId);
          if (test) {
            test.status = "running";
          }
        }
      })
    );

    try {
      // Build test filter arguments based on framework
      const testArgs = buildTestArgs(testIds);

      const result = await invoke<{
        terminalId: string;
      }>("testing_run", {
        projectPath: state.projectPath,
        framework: state.framework.framework,
        command: state.framework.command,
        args: [...state.framework.args, ...testArgs],
        coverage: state.showCoverage,
        coverageFlag: state.framework.coverageFlag,
      });

      currentTerminalId = result.terminalId;
    } catch (error) {
      console.error("[Testing] Failed to start tests:", error);
      setState(
        produce((s) => {
          if (s.currentRun) {
            s.currentRun.status = "error";
            s.currentRun.finishedAt = Date.now();
          }
          s.isRunning = false;
        })
      );
    }
  };

  const buildTestArgs = (testIds: string[]): string[] => {
    if (!state.framework) return [];

    const framework = state.framework.framework;
    const tests = testIds.map((id) => state.testIndex.get(id)).filter(Boolean) as TestItem[];

    switch (framework) {
      case "jest":
        return tests.map((t) => (t.type === "file" ? t.filePath : `--testNamePattern="${escapeRegex(t.fullName)}"`));

      case "vitest":
        return tests.map((t) => (t.type === "file" ? t.filePath : `--testNamePattern="${escapeRegex(t.fullName)}"`));

      case "mocha":
        return tests.map((t) => (t.type === "file" ? t.filePath : `--grep="${escapeRegex(t.fullName)}"`));

      case "pytest":
        return tests.map((t) => {
          if (t.type === "file") return t.filePath;
          // pytest uses :: notation for test selection
          return `${t.filePath}::${t.name}`;
        });

      case "cargo":
        return tests.map((t) => (t.type === "file" ? `--test ${t.name.replace(".rs", "")}` : t.fullName));

      default:
        return [];
    }
  };

  const runAllTests = async () => {
    const allTestIds = getAllTestIds(state.tests);
    await runTests(allTestIds);
  };

  const runFailedTests = async () => {
    const failedIds = failedTestIds();
    if (failedIds.length > 0) {
      await runTests(failedIds);
    }
  };

  const runTestFile = async (filePath: string) => {
    const fileTest = state.tests.find((t) => t.filePath === filePath);
    if (fileTest) {
      await runTest(fileTest.id);
    }
  };

  const debugTest = async (testId: string) => {
    const test = state.testIndex.get(testId);
    if (!test || !state.framework || !state.projectPath) {
      console.error("[Testing] Cannot debug: test, framework, or project not found");
      return;
    }

    // Emit event for debug context to pick up
    window.dispatchEvent(
      new CustomEvent("testing:debug-test", {
        detail: {
          testId,
          testName: test.fullName,
          filePath: test.filePath,
          line: test.line,
          framework: state.framework.framework,
          projectPath: state.projectPath,
        },
      })
    );
  };

  const stopTests = async () => {
    if (!state.isRunning || !currentTerminalId) return;

    try {
      await invoke("testing_stop", {
        terminalId: currentTerminalId,
      });
    } catch (error) {
      console.error("[Testing] Failed to stop tests:", error);
    }

    setState(
      produce((s) => {
        if (s.currentRun) {
          s.currentRun.status = "cancelled";
          s.currentRun.finishedAt = Date.now();
        }
        s.isRunning = false;
      })
    );

    currentTerminalId = null;
  };

  // ============================================================================
  // Result Parsing
  // ============================================================================

  const parseTestOutput = (output: string) => {
    if (!state.framework) return;

    const framework = state.framework.framework;
    const lines = output.split("\n");

    switch (framework) {
      case "jest":
      case "vitest":
        parseJestVitestOutput(lines);
        break;
      case "mocha":
        parseMochaOutput(lines);
        break;
      case "pytest":
        parsePytestOutput(lines);
        break;
      case "cargo":
        parseCargoOutput(lines);
        break;
    }
  };

  const parseJestVitestOutput = (lines: string[]) => {
    // Jest/Vitest output patterns
    const passPattern = /✓|PASS|√/;
    const failPattern = /✕|FAIL|×/;
    const skipPattern = /○|SKIP|⊘/;
    const testNamePattern = /^\s*(✓|✕|○|√|×|⊘)\s+(.+?)(?:\s+\((\d+)\s*ms\))?$/;

    for (const line of lines) {
      const match = line.match(testNamePattern);
      if (match) {
        const [, statusChar, testName, durationStr] = match;
        const duration = durationStr ? parseInt(durationStr, 10) : undefined;

        let status: TestStatus = "pending";
        if (passPattern.test(statusChar)) status = "passed";
        else if (failPattern.test(statusChar)) status = "failed";
        else if (skipPattern.test(statusChar)) status = "skipped";

        updateTestResult(testName.trim(), status, duration);
      }
    }

    // Check for summary line
    const summaryPattern = /Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed/i;
    for (const line of lines) {
      const match = line.match(summaryPattern);
      if (match) {
        const [, passed, failed] = match;
        setState(
          produce((s) => {
            if (s.currentRun) {
              s.currentRun.passedTests = parseInt(passed, 10);
              s.currentRun.failedTests = parseInt(failed, 10);
            }
          })
        );
      }
    }
  };

  const parseMochaOutput = (lines: string[]) => {
    const passPattern = /✓|passing/;
    const testNamePattern = /^\s*(✓|✗)\s+(.+?)(?:\s+\((\d+)ms\))?$/;

    for (const line of lines) {
      const match = line.match(testNamePattern);
      if (match) {
        const [, statusChar, testName, durationStr] = match;
        const duration = durationStr ? parseInt(durationStr, 10) : undefined;

        const status: TestStatus = passPattern.test(statusChar) ? "passed" : "failed";
        updateTestResult(testName.trim(), status, duration);
      }
    }
  };

  const parsePytestOutput = (lines: string[]) => {
    // pytest output: test_file.py::test_name PASSED/FAILED/SKIPPED
    const testPattern = /^(.+?::[\w_]+)\s+(PASSED|FAILED|SKIPPED|ERROR)/;

    for (const line of lines) {
      const match = line.match(testPattern);
      if (match) {
        const [, testName, statusStr] = match;
        let status: TestStatus = "pending";
        if (statusStr === "PASSED") status = "passed";
        else if (statusStr === "FAILED") status = "failed";
        else if (statusStr === "SKIPPED") status = "skipped";
        else if (statusStr === "ERROR") status = "error";

        updateTestResult(testName, status);
      }
    }

    // Parse summary: X passed, Y failed, Z skipped
    const summaryPattern = /(\d+)\s+passed.*?(\d+)\s+failed/i;
    for (const line of lines) {
      const match = line.match(summaryPattern);
      if (match) {
        const [, passed, failed] = match;
        setState(
          produce((s) => {
            if (s.currentRun) {
              s.currentRun.passedTests = parseInt(passed, 10);
              s.currentRun.failedTests = parseInt(failed, 10);
            }
          })
        );
      }
    }
  };

  const parseCargoOutput = (lines: string[]) => {
    // cargo test output: test module::test_name ... ok/FAILED
    const testPattern = /^test\s+(.+?)\s+\.\.\.\s+(ok|FAILED|ignored)/;

    for (const line of lines) {
      const match = line.match(testPattern);
      if (match) {
        const [, testName, statusStr] = match;
        let status: TestStatus = "pending";
        if (statusStr === "ok") status = "passed";
        else if (statusStr === "FAILED") status = "failed";
        else if (statusStr === "ignored") status = "skipped";

        updateTestResult(testName, status);
      }
    }

    // Parse summary: X passed; Y failed; Z ignored
    const summaryPattern = /(\d+)\s+passed;\s+(\d+)\s+failed/;
    for (const line of lines) {
      const match = line.match(summaryPattern);
      if (match) {
        const [, passed, failed] = match;
        setState(
          produce((s) => {
            if (s.currentRun) {
              s.currentRun.passedTests = parseInt(passed, 10);
              s.currentRun.failedTests = parseInt(failed, 10);
            }
          })
        );
      }
    }
  };

  const updateTestResult = (testName: string, status: TestStatus, duration?: number) => {
    setState(
      produce((s) => {
        // Find test by name (exact or partial match)
        let test: TestItem | undefined;
        for (const t of s.testIndex.values()) {
          if (t.fullName === testName || t.name === testName || t.fullName.endsWith(testName)) {
            test = t;
            break;
          }
        }

        if (test) {
          test.status = status;
          test.duration = duration;

          if (s.currentRun) {
            const result: TestRunResult = {
              testId: test.id,
              status,
              duration: duration || 0,
              output: [],
              startedAt: s.currentRun.startedAt,
              finishedAt: Date.now(),
            };
            s.currentRun.results.set(test.id, result);

            // Update counts
            switch (status) {
              case "passed":
                s.currentRun.passedTests++;
                break;
              case "failed":
                s.currentRun.failedTests++;
                break;
              case "skipped":
                s.currentRun.skippedTests++;
                break;
              case "error":
                s.currentRun.errorTests++;
                break;
            }
          }
        }
      })
    );
  };

  const parseCoverage = (output: string) => {
    // Parse coverage output based on framework
    // This is a simplified implementation - real parsing would need framework-specific logic
    const coveragePattern = /All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/;
    const match = output.match(coveragePattern);

    if (match) {
      const [, stmts, branches, funcs, lines] = match;
      setState("coverage", {
        totalStatements: 100,
        coveredStatements: parseFloat(stmts),
        totalBranches: 100,
        coveredBranches: parseFloat(branches),
        totalFunctions: 100,
        coveredFunctions: parseFloat(funcs),
        totalLines: 100,
        coveredLines: parseFloat(lines),
        files: [],
        lastUpdated: Date.now(),
      });
    }
  };

  // ============================================================================
  // Coverage Decoration Parsing (LCOV & Istanbul)
  // ============================================================================

  /**
   * Parse LCOV format coverage data into line-level coverage decorations.
   * LCOV format:
   *   SF:<source file path>
   *   DA:<line number>,<execution count>
   *   BRDA:<line>,<block>,<branch>,<taken>
   *   end_of_record
   */
  const parseLcovCoverage = (lcovContent: string): Map<string, FileCoverageDecorations> => {
    const result = new Map<string, FileCoverageDecorations>();
    const records = lcovContent.split("end_of_record");
    
    for (const record of records) {
      const lines = record.trim().split("\n");
      if (lines.length === 0) continue;
      
      let currentFile = "";
      const lineData = new Map<number, { hits: number; branchCovered: number; branchTotal: number }>();
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Source file
        if (trimmed.startsWith("SF:")) {
          currentFile = trimmed.substring(3).trim();
          // Normalize path separators
          currentFile = currentFile.replace(/\\/g, "/");
        }
        
        // Line execution data: DA:<line number>,<execution count>
        if (trimmed.startsWith("DA:")) {
          const [lineNumStr, countStr] = trimmed.substring(3).split(",");
          const lineNum = parseInt(lineNumStr, 10);
          const count = parseInt(countStr, 10);
          
          if (!isNaN(lineNum) && !isNaN(count)) {
            const existing = lineData.get(lineNum) || { hits: 0, branchCovered: 0, branchTotal: 0 };
            existing.hits = count;
            lineData.set(lineNum, existing);
          }
        }
        
        // Branch data: BRDA:<line>,<block>,<branch>,<taken>
        if (trimmed.startsWith("BRDA:")) {
          const parts = trimmed.substring(5).split(",");
          if (parts.length >= 4) {
            const lineNum = parseInt(parts[0], 10);
            const taken = parts[3] === "-" ? 0 : parseInt(parts[3], 10);
            
            if (!isNaN(lineNum)) {
              const existing = lineData.get(lineNum) || { hits: 0, branchCovered: 0, branchTotal: 0 };
              existing.branchTotal++;
              if (taken > 0) {
                existing.branchCovered++;
              }
              lineData.set(lineNum, existing);
            }
          }
        }
      }
      
      if (currentFile && lineData.size > 0) {
        const coverageLines: LineCoverageData[] = [];
        
        for (const [lineNumber, data] of lineData) {
          let status: LineCoverageStatus;
          
          if (data.hits === 0) {
            status = "uncovered";
          } else if (data.branchTotal > 0 && data.branchCovered < data.branchTotal) {
            status = "partial";
          } else {
            status = "covered";
          }
          
          const lineEntry: LineCoverageData = {
            lineNumber,
            status,
            hits: data.hits,
          };
          
          if (data.branchTotal > 0) {
            lineEntry.branches = {
              covered: data.branchCovered,
              total: data.branchTotal,
            };
          }
          
          coverageLines.push(lineEntry);
        }
        
        // Sort by line number
        coverageLines.sort((a, b) => a.lineNumber - b.lineNumber);
        
        result.set(currentFile, {
          filePath: currentFile,
          lines: coverageLines,
          lastUpdated: Date.now(),
        });
      }
    }
    
    return result;
  };

  /**
   * Parse Istanbul/NYC JSON coverage format into line-level coverage decorations.
   * Istanbul format is a JSON object with file paths as keys, containing:
   *   statementMap, branchMap, fnMap, s, b, f
   */
  const parseIstanbulCoverage = (jsonContent: string): Map<string, FileCoverageDecorations> => {
    const result = new Map<string, FileCoverageDecorations>();
    
    try {
      const coverage = JSON.parse(jsonContent);
      
      for (const [filePath, fileData] of Object.entries(coverage)) {
        const data = fileData as {
          statementMap?: Record<string, { start: { line: number }; end: { line: number } }>;
          branchMap?: Record<string, { locations: Array<{ start: { line: number }; end: { line: number } }> }>;
          s?: Record<string, number>;
          b?: Record<string, number[]>;
        };
        
        if (!data.statementMap || !data.s) continue;
        
        const lineData = new Map<number, { hits: number; branchCovered: number; branchTotal: number }>();
        
        // Process statements
        for (const [stmtId, stmtRange] of Object.entries(data.statementMap)) {
          const lineNum = stmtRange.start.line;
          const hits = data.s[stmtId] || 0;
          
          const existing = lineData.get(lineNum) || { hits: 0, branchCovered: 0, branchTotal: 0 };
          existing.hits = Math.max(existing.hits, hits);
          lineData.set(lineNum, existing);
        }
        
        // Process branches
        if (data.branchMap && data.b) {
          for (const [branchId, branchInfo] of Object.entries(data.branchMap)) {
            const branchCounts = data.b[branchId] || [];
            const lineNum = branchInfo.locations[0]?.start.line;
            
            if (lineNum) {
              const existing = lineData.get(lineNum) || { hits: 0, branchCovered: 0, branchTotal: 0 };
              existing.branchTotal += branchCounts.length;
              existing.branchCovered += branchCounts.filter((c) => c > 0).length;
              lineData.set(lineNum, existing);
            }
          }
        }
        
        if (lineData.size > 0) {
          const coverageLines: LineCoverageData[] = [];
          
          for (const [lineNumber, lineInfo] of lineData) {
            let status: LineCoverageStatus;
            
            if (lineInfo.hits === 0) {
              status = "uncovered";
            } else if (lineInfo.branchTotal > 0 && lineInfo.branchCovered < lineInfo.branchTotal) {
              status = "partial";
            } else {
              status = "covered";
            }
            
            const lineEntry: LineCoverageData = {
              lineNumber,
              status,
              hits: lineInfo.hits,
            };
            
            if (lineInfo.branchTotal > 0) {
              lineEntry.branches = {
                covered: lineInfo.branchCovered,
                total: lineInfo.branchTotal,
              };
            }
            
            coverageLines.push(lineEntry);
          }
          
          coverageLines.sort((a, b) => a.lineNumber - b.lineNumber);
          
          // Normalize path
          const normalizedPath = filePath.replace(/\\/g, "/");
          
          result.set(normalizedPath, {
            filePath: normalizedPath,
            lines: coverageLines,
            lastUpdated: Date.now(),
          });
        }
      }
    } catch (error) {
      console.error("[Testing] Failed to parse Istanbul coverage:", error);
    }
    
    return result;
  };

  /**
   * Load coverage data from a file (supports lcov.info and coverage-final.json)
   */
  const loadCoverageFromFile = async (coveragePath: string): Promise<void> => {
    try {
      const result = await invoke<{ content: string }>("fs_read_file", {
        path: coveragePath,
      });
      
      if (!result || !result.content) {
        console.warn("[Testing] Empty coverage file:", coveragePath);
        return;
      }
      
      const content = result.content;
      const normalizedPath = coveragePath.toLowerCase().replace(/\\/g, "/");
      
      let decorations: Map<string, FileCoverageDecorations>;
      
      // Detect format based on file name or content
      if (normalizedPath.endsWith(".json") || content.trim().startsWith("{")) {
        decorations = parseIstanbulCoverage(content);
      } else {
        // Assume LCOV format (lcov.info, coverage.lcov, etc.)
        decorations = parseLcovCoverage(content);
      }
      
      if (decorations.size > 0) {
        setState("coverageDecorations", decorations);
        
        // Emit event to notify editor to update decorations
        window.dispatchEvent(
          new CustomEvent("testing:coverage-updated", {
            detail: {
              files: Array.from(decorations.keys()),
              timestamp: Date.now(),
            },
          })
        );
      }
    } catch (error) {
      console.error("[Testing] Failed to load coverage file:", error);
    }
  };

  /**
   * Toggle coverage decorations visibility
   */
  const toggleCoverageDecorations = () => {
    const newValue = !state.showCoverageDecorations;
    setState("showCoverageDecorations", newValue);
    
    // Emit event to notify editor
    window.dispatchEvent(
      new CustomEvent("testing:coverage-visibility-changed", {
        detail: { visible: newValue },
      })
    );
    
    // Persist setting
    try {
      localStorage.setItem("testing.showCoverageDecorations", JSON.stringify(newValue));
    } catch (err) {
      console.debug("[Testing] Storage save failed:", err);
    }
  };

  /**
   * Set coverage decorations visibility
   */
  const setShowCoverageDecorations = (enabled: boolean) => {
    setState("showCoverageDecorations", enabled);
    
    window.dispatchEvent(
      new CustomEvent("testing:coverage-visibility-changed", {
        detail: { visible: enabled },
      })
    );
    
    try {
      localStorage.setItem("testing.showCoverageDecorations", JSON.stringify(enabled));
    } catch (err) {
      console.debug("[Testing] Storage save failed:", err);
    }
  };

  /**
   * Get coverage decorations for a specific file
   */
  const getCoverageForFile = (filePath: string): FileCoverageDecorations | undefined => {
    const normalizedPath = filePath.replace(/\\/g, "/");
    
    // Try exact match first
    let coverage = state.coverageDecorations.get(normalizedPath);
    if (coverage) return coverage;
    
    // Try matching by filename for relative paths
    const fileName = normalizedPath.split("/").pop() || "";
    for (const [key, value] of state.coverageDecorations) {
      if (key.endsWith("/" + fileName) || key === fileName) {
        return value;
      }
    }
    
    return undefined;
  };

  /**
   * Clear all coverage decorations
   */
  const clearCoverageDecorations = () => {
    setState("coverageDecorations", new Map());
    
    window.dispatchEvent(
      new CustomEvent("testing:coverage-cleared", {
        detail: { timestamp: Date.now() },
      })
    );
  };

  /**
   * Load coverage decorations visibility setting from storage
   */
  const loadCoverageDecorationsSettings = () => {
    try {
      const stored = localStorage.getItem("testing.showCoverageDecorations");
      if (stored) {
        setState("showCoverageDecorations", JSON.parse(stored));
      }
    } catch (err) {
      console.debug("[Testing] Parse error:", err);
    }
  };

  // ============================================================================
  // Results Management
  // ============================================================================

  const clearResults = () => {
    setState(
      produce((s) => {
        for (const test of s.testIndex.values()) {
          test.status = "pending";
          test.duration = undefined;
          test.errorMessage = undefined;
          test.errorStack = undefined;
          test.output = undefined;
        }
        s.currentRun = null;
      })
    );
  };

  const clearOutput = () => {
    setState("output", []);
  };

  const getTestResult = (testId: string): TestRunResult | undefined => {
    return state.currentRun?.results.get(testId);
  };

  // ============================================================================
  // Navigation
  // ============================================================================

  const goToTest = (testId: string) => {
    const test = state.testIndex.get(testId);
    if (test && test.filePath) {
      window.dispatchEvent(
        new CustomEvent("editor:open-file", {
          detail: {
            path: test.filePath,
            line: test.line,
            column: test.column,
          },
        })
      );
    }
  };

  const selectTest = (testId: string | null) => {
    setState("selectedTestId", testId);
    if (testId) {
      // Expand parent nodes
      const test = state.testIndex.get(testId);
      if (test?.parentId) {
        setState(
          produce((s) => {
            let parentId = test.parentId;
            while (parentId) {
              s.expandedNodes.add(parentId);
              const parent = s.testIndex.get(parentId);
              parentId = parent?.parentId;
            }
          })
        );
      }
    }
  };

  const expandNode = (nodeId: string) => {
    setState(
      produce((s) => {
        s.expandedNodes.add(nodeId);
      })
    );
  };

  const collapseNode = (nodeId: string) => {
    setState(
      produce((s) => {
        s.expandedNodes.delete(nodeId);
      })
    );
  };

  const toggleNode = (nodeId: string) => {
    if (state.expandedNodes.has(nodeId)) {
      collapseNode(nodeId);
    } else {
      expandNode(nodeId);
    }
  };

  const expandAll = () => {
    setState(
      produce((s) => {
        for (const test of s.testIndex.values()) {
          if (test.children.length > 0) {
            s.expandedNodes.add(test.id);
          }
        }
      })
    );
  };

  const collapseAll = () => {
    setState("expandedNodes", new Set());
  };

  // ============================================================================
  // Filtering
  // ============================================================================

  const setFilter = (filter: TestFilter) => {
    setState("filter", filter);
  };

  const setSearchQuery = (query: string) => {
    setState("searchQuery", query);
  };

  const filteredTests = createMemo(() => {
    let tests = state.tests;

    // Apply status filter
    if (state.filter !== "all") {
      tests = filterTestsByStatus(tests, state.filter);
    }

    // Apply search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      tests = filterTestsByQuery(tests, query);
    }

    return tests;
  });

  const filterTestsByStatus = (tests: TestItem[], status: TestFilter): TestItem[] => {
    return tests
      .map((test) => {
        if (test.children.length > 0) {
          const filteredChildren = filterTestsByStatus(test.children, status);
          if (filteredChildren.length > 0 || test.status === status) {
            return { ...test, children: filteredChildren };
          }
          return null;
        }
        return test.status === status ? test : null;
      })
      .filter(Boolean) as TestItem[];
  };

  const filterTestsByQuery = (tests: TestItem[], query: string): TestItem[] => {
    return tests
      .map((test) => {
        const matches = test.name.toLowerCase().includes(query) || test.fullName.toLowerCase().includes(query);

        if (test.children.length > 0) {
          const filteredChildren = filterTestsByQuery(test.children, query);
          if (filteredChildren.length > 0 || matches) {
            return { ...test, children: filteredChildren };
          }
          return null;
        }
        return matches ? test : null;
      })
      .filter(Boolean) as TestItem[];
  };

  // ============================================================================
  // Settings
  // ============================================================================

  const setWatchMode = async (enabled: boolean) => {
    if (enabled && !state.watchMode) {
      // Start watch mode
      if (state.projectPath && state.framework) {
        try {
          const watcherId = await invoke<string>("testing_watch", {
            path: state.projectPath,
            framework: state.framework.framework,
            pattern: null,
          });
          setState("watcherId", watcherId);
          setState("watchMode", true);
        } catch (error) {
          console.error("[Testing] Failed to start watch mode:", error);
          setState("watchMode", false);
          setState("watcherId", null);
        }
      }
    } else if (!enabled && state.watchMode) {
      // Stop watch mode
      if (state.watcherId) {
        try {
          await invoke("testing_stop_watch", { watcherId: state.watcherId });
        } catch (error) {
          console.error("[Testing] Failed to stop watch mode:", error);
        }
      }
      setState("watchMode", false);
      setState("watcherId", null);
    }
  };

  const toggleWatchMode = async () => {
    await setWatchMode(!state.watchMode);
  };

  const setShowCoverage = (enabled: boolean) => {
    setState("showCoverage", enabled);
  };

  const setAutoRun = (enabled: boolean) => {
    setState("autoRun", enabled);
  };

  // Run tests with coverage
  const runWithCoverage = async () => {
    if (!state.framework || !state.projectPath) {
      console.error("[Testing] No framework or project path configured");
      return;
    }

    setState("isRunning", true);
    setState("output", []);

    try {
      const result = await invoke<{
        files: Array<{
          path: string;
          lines: Array<{ line: number; hits: number; branch_coverage?: { covered: number; total: number } }>;
          line_rate: number;
          branch_rate: number;
          functions_hit: number;
          functions_total: number;
        }>;
        summary: {
          lines_total: number;
          lines_covered: number;
          lines_percentage: number;
          branches_total: number;
          branches_covered: number;
          branches_percentage: number;
          functions_total: number;
          functions_covered: number;
          functions_percentage: number;
        };
      }>("testing_coverage", {
        path: state.projectPath,
        framework: state.framework.framework,
        testPattern: null,
      });

      // Convert to our coverage data format
      const coverageData: CoverageData = {
        totalLines: result.summary.lines_total,
        coveredLines: result.summary.lines_covered,
        totalBranches: result.summary.branches_total,
        coveredBranches: result.summary.branches_covered,
        totalFunctions: result.summary.functions_total,
        coveredFunctions: result.summary.functions_covered,
        totalStatements: result.summary.lines_total,
        coveredStatements: result.summary.lines_covered,
        files: result.files.map((f) => ({
          filePath: f.path,
          lines: { total: 0, covered: 0, percentage: f.line_rate * 100 },
          branches: { total: 0, covered: 0, percentage: f.branch_rate * 100 },
          functions: { total: f.functions_total, covered: f.functions_hit, percentage: f.functions_total > 0 ? (f.functions_hit / f.functions_total) * 100 : 0 },
          statements: { total: 0, covered: 0, percentage: f.line_rate * 100 },
          uncoveredLines: f.lines.filter((l) => l.hits === 0).map((l) => l.line),
        })),
        lastUpdated: Date.now(),
      };

      setState("coverage", coverageData);

      // Convert to decorations format
      const decorations = new Map<string, FileCoverageDecorations>();
      for (const file of result.files) {
        decorations.set(file.path.replace(/\\/g, "/"), {
          filePath: file.path,
          lines: file.lines.map((l) => ({
            lineNumber: l.line,
            status: l.hits > 0 ? (l.branch_coverage && l.branch_coverage.covered < l.branch_coverage.total ? "partial" : "covered") : "uncovered",
            hits: l.hits,
            branches: l.branch_coverage ? { covered: l.branch_coverage.covered, total: l.branch_coverage.total } : undefined,
          })),
          lastUpdated: Date.now(),
        });
      }
      setState("coverageDecorations", decorations);

      // Auto-show coverage decorations
      setState("showCoverageDecorations", true);
      
      window.dispatchEvent(
        new CustomEvent("testing:coverage-updated", {
          detail: {
            files: Array.from(decorations.keys()),
            timestamp: Date.now(),
          },
        })
      );
    } catch (error) {
      console.error("[Testing] Coverage run failed:", error);
      setState(
        produce((s) => {
          s.output.push(`Coverage run failed: ${error}`);
        })
      );
    }

    setState("isRunning", false);
  };

  // ============================================================================
  // Continuous Testing
  // ============================================================================

  const toggleContinuousRun = () => {
    const newValue = !state.continuousRun;
    setState("continuousRun", newValue);
    setState("continuousSettings", "enabled", newValue);
    
    // Persist setting to localStorage
    try {
      const settings = localStorage.getItem("testing.continuousRun") || "{}";
      const parsed = JSON.parse(settings);
      parsed.enabled = newValue;
      localStorage.setItem("testing.continuousRun", JSON.stringify(parsed));
    } catch (err) {
      console.debug("[Testing] Continuous run parse error:", err);
      localStorage.setItem("testing.continuousRun", JSON.stringify({ enabled: newValue }));
    }
  };

  const setContinuousSettings = (settings: Partial<ContinuousTestingSettings>) => {
    setState("continuousSettings", (prev) => ({ ...prev, ...settings }));
    
    if (settings.enabled !== undefined) {
      setState("continuousRun", settings.enabled);
    }
    
    // Persist settings to localStorage
    try {
      const stored = localStorage.getItem("testing.continuousRun") || "{}";
      const parsed = JSON.parse(stored);
      const updated = { ...parsed, ...settings };
      localStorage.setItem("testing.continuousRun", JSON.stringify(updated));
    } catch (err) {
      console.debug("[Testing] Continuous run parse error:", err);
      localStorage.setItem("testing.continuousRun", JSON.stringify(settings));
    }
  };

  const findAffectedTests = (filePath: string): string[] => {
    const affectedTestIds: string[] = [];
    const normalizedPath = filePath.replace(/\\/g, "/");
    const fileName = normalizedPath.split("/").pop() || "";
    const fileNameWithoutExt = fileName.replace(/\.[^.]+$/, "");
    
    // Check if the saved file is a test file
    const isTestFile = state.framework?.testFilePatterns.some((pattern) => {
      const regexPattern = pattern
        .replace(/\*\*/g, ".*")
        .replace(/\*/g, "[^/]*")
        .replace(/\./g, "\\.")
        .replace(/\{([^}]+)\}/g, (_, group) => `(${group.replace(/,/g, "|")})`);
      const regex = new RegExp(regexPattern);
      return regex.test(normalizedPath);
    });
    
    if (isTestFile) {
      // If it's a test file, find the test by file path
      const fileTest = state.tests.find((t) => {
        const testPath = t.filePath.replace(/\\/g, "/");
        return testPath === normalizedPath || testPath.endsWith(fileName);
      });
      if (fileTest) {
        affectedTestIds.push(fileTest.id);
      }
    } else {
      // For source files, find related test files
      // Common patterns: Component.tsx -> Component.test.tsx, utils.ts -> utils.spec.ts
      const testPatterns = [
        `${fileNameWithoutExt}.test`,
        `${fileNameWithoutExt}.spec`,
        `${fileNameWithoutExt}_test`,
        `test_${fileNameWithoutExt}`,
      ];
      
      for (const test of state.tests) {
        const testFileName = test.filePath.split("/").pop()?.split("\\").pop() || "";
        const testFileNameWithoutExt = testFileName.replace(/\.[^.]+$/, "");
        
        // Check if test file name matches any pattern
        for (const pattern of testPatterns) {
          if (testFileNameWithoutExt.toLowerCase() === pattern.toLowerCase()) {
            affectedTestIds.push(test.id);
            break;
          }
        }
        
        // Also check if the test file is in a __tests__ directory with same name
        if (test.filePath.includes("__tests__") && testFileNameWithoutExt === fileNameWithoutExt) {
          if (!affectedTestIds.includes(test.id)) {
            affectedTestIds.push(test.id);
          }
        }
      }
      
      // If no specific tests found, consider running all tests for the file's directory
      if (affectedTestIds.length === 0 && !state.continuousSettings.runAffectedOnly) {
        return getAllTestIds(state.tests);
      }
    }
    
    return affectedTestIds;
  };

  const testOnSave = async (filePath: string): Promise<void> => {
    // Early return if continuous testing is not enabled or already running
    if (!state.continuousRun || !state.continuousSettings.runOnSave) {
      return;
    }
    
    if (state.isRunning) {
      // Queue the file path for later if already running
      pendingSaveFiles.add(filePath);
      return;
    }
    
    // Clear any existing debounce timer
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
    }
    
    // Add file to pending saves for debouncing
    pendingSaveFiles.add(filePath);
    
    // Debounce rapid saves
    saveDebounceTimer = setTimeout(async () => {
      const filesToProcess = Array.from(pendingSaveFiles);
      pendingSaveFiles.clear();
      
      // Collect all affected tests from all saved files
      const allAffectedTestIds = new Set<string>();
      for (const file of filesToProcess) {
        const affected = findAffectedTests(file);
        affected.forEach((id) => allAffectedTestIds.add(id));
      }
      
      const testIdsToRun = Array.from(allAffectedTestIds);
      
      // Guard against empty filesToProcess array
      const lastFilePath = filesToProcess.length > 0 ? filesToProcess[filesToProcess.length - 1] : null;
      
      if (testIdsToRun.length > 0) {
        // Update last auto-run info
        setState("lastAutoRunTime", Date.now());
        if (lastFilePath) setState("lastAutoRunFilePath", lastFilePath);
        
        // Run the affected tests
        await runTests(testIdsToRun);
      } else if (!state.continuousSettings.runAffectedOnly) {
        // If no specific affected tests and runAffectedOnly is false, run all tests
        setState("lastAutoRunTime", Date.now());
        if (lastFilePath) setState("lastAutoRunFilePath", lastFilePath);
        await runAllTests();
      }
    }, state.continuousSettings.debounceMs);
  };

  const loadContinuousSettings = () => {
    try {
      const stored = localStorage.getItem("testing.continuousRun");
      if (stored) {
        const parsed = JSON.parse(stored);
        setState("continuousSettings", (prev) => ({ ...prev, ...parsed }));
        setState("continuousRun", parsed.enabled ?? false);
      }
    } catch (err) {
      console.debug("[Testing] Parse error:", err);
    }
  };

  // ============================================================================
  // Computed Values
  // ============================================================================

  const testCounts = createMemo(() => {
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let running = 0;

    const countTests = (items: TestItem[]) => {
      for (const item of items) {
        if (item.type === "test") {
          total++;
          switch (item.status) {
            case "passed":
              passed++;
              break;
            case "failed":
            case "error":
              failed++;
              break;
            case "skipped":
              skipped++;
              break;
            case "running":
              running++;
              break;
          }
        }
        if (item.children.length > 0) {
          countTests(item.children);
        }
      }
    };

    countTests(state.tests);
    return { total, passed, failed, skipped, running };
  });

  const coveragePercentage = createMemo(() => {
    if (!state.coverage) return 0;
    const { totalLines, coveredLines } = state.coverage;
    if (totalLines === 0) return 0;
    return Math.round((coveredLines / totalLines) * 100);
  });

  const failedTestIds = createMemo(() => {
    const ids: string[] = [];
    const collectFailed = (items: TestItem[]) => {
      for (const item of items) {
        if (item.status === "failed" || item.status === "error") {
          ids.push(item.id);
        }
        if (item.children.length > 0) {
          collectFailed(item.children);
        }
      }
    };
    collectFailed(state.tests);
    return ids;
  });

  // ============================================================================
  // Helpers
  // ============================================================================

  const generateTestId = (path: string, name?: string): string => {
    const base = path.replace(/[^a-zA-Z0-9]/g, "_");
    return name ? `${base}_${name.replace(/[^a-zA-Z0-9]/g, "_")}` : base;
  };

  const getAllTestIds = (items: TestItem[]): string[] => {
    const ids: string[] = [];
    for (const item of items) {
      if (item.type === "test") {
        ids.push(item.id);
      }
      if (item.children.length > 0) {
        ids.push(...getAllTestIds(item.children));
      }
    }
    return ids;
  };

  const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleTestEvent = (event: { type: string; data: unknown }) => {
    switch (event.type) {
      case "test_started":
        setState("isRunning", true);
        break;

      case "test_result": {
        const data = event.data as { testName: string; status: TestStatus; duration?: number };
        updateTestResult(data.testName, data.status, data.duration);
        break;
      }

      case "test_output": {
        const data = event.data as { output: string };
        setState(
          produce((s) => {
            s.output.push(data.output);
            if (s.output.length > 5000) {
              s.output = s.output.slice(-5000);
            }
          })
        );
        parseTestOutput(data.output);
        break;
      }

      case "test_complete": {
        const data = event.data as { exitCode: number };
        setState(
          produce((s) => {
            if (s.currentRun) {
              s.currentRun.status = data.exitCode === 0 ? "completed" : "error";
              s.currentRun.finishedAt = Date.now();
              s.currentRun.duration = s.currentRun.finishedAt - s.currentRun.startedAt;
              s.runHistory.unshift(s.currentRun);
              if (s.runHistory.length > 50) {
                s.runHistory = s.runHistory.slice(0, 50);
              }
            }
            s.isRunning = false;
          })
        );
        currentTerminalId = null;
        break;
      }

      case "coverage_update": {
        const data = event.data as { output: string };
        parseCoverage(data.output);
        break;
      }
    }
  };

  const handleTerminalOutput = (e: Event) => {
    const data = (e as CustomEvent).detail;
    if (currentTerminalId && data.terminal_id === currentTerminalId) {
      setState(
        produce((s) => {
          s.output.push(data.content);
          if (s.output.length > 5000) {
            s.output = s.output.slice(-5000);
          }
        })
      );
      parseTestOutput(data.content);
    }
  };

  const handleTerminalStatus = (e: Event) => {
    const data = (e as CustomEvent).detail;
    if (currentTerminalId && data.terminal_id === currentTerminalId) {
      if (data.status === "stopped") {
        handleTestEvent({
          type: "test_complete",
          data: { exitCode: data.exit_code || 0 },
        });
      }
    }
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  // Event handlers defined outside onMount for cleanup
  const handleRunAllTests = () => runAllTests();
  const handleRunFailedTests = () => runFailedTests();
  const handleStopTests = () => stopTests();
  const handleRefreshTests = () => refreshTests();
  const handleToggleWatch = () => toggleWatchMode();
  const handleRunCoverage = () => runWithCoverage();
  const handleToggleCoverage = () => toggleCoverageDecorations();
  const handleShowCoverage = () => setShowCoverageDecorations(true);
  const handleHideCoverage = () => setShowCoverageDecorations(false);
  const handleClearResults = () => clearResults();
  const handleFileSaved = (e: Event) => {
    const data = (e as CustomEvent).detail;
    const filePath = data?.path || "";
    
    // Continuous testing takes precedence
    if (state.continuousRun) {
      testOnSave(filePath);
      return;
    }
    
    // Legacy autoRun behavior
    if (state.autoRun && !state.isRunning) {
      // Check if saved file is a test file or source file
      const isTestFile = state.framework?.testFilePatterns.some((pattern) => {
        const regex = new RegExp(pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"));
        return regex.test(filePath);
      });
      if (isTestFile) {
        runTestFile(filePath);
      }
    }
  };

  // Register cleanup synchronously
  onCleanup(() => {
    unlistenTestEvent?.();
    unlistenTestOutput?.();
    window.removeEventListener("cortex:terminal_output", handleTerminalOutput);
    window.removeEventListener("cortex:terminal_status", handleTerminalStatus);
    window.removeEventListener("testing:run-all", handleRunAllTests);
    window.removeEventListener("testing:run-failed", handleRunFailedTests);
    window.removeEventListener("testing:stop", handleStopTests);
    window.removeEventListener("testing:refresh", handleRefreshTests);
    window.removeEventListener("testing:toggle-watch", handleToggleWatch);
    window.removeEventListener("testing:run-coverage", handleRunCoverage);
    window.removeEventListener("testing:toggle-coverage", handleToggleCoverage);
    window.removeEventListener("testing:show-coverage", handleShowCoverage);
    window.removeEventListener("testing:hide-coverage", handleHideCoverage);
    window.removeEventListener("testing:clear-results", handleClearResults);
    window.removeEventListener("editor:file-saved", handleFileSaved);
    
    // Clean up debounce timer
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = null;
    }
    
    // Stop watch mode if active
    if (state.watcherId) {
      invoke("testing_stop_watch", { watcherId: state.watcherId }).catch(() => {});
    }
  });

  onMount(() => {
    // ESSENTIAL - Register fast window event listeners immediately (no async)
    window.addEventListener("cortex:terminal_output", handleTerminalOutput);
    window.addEventListener("cortex:terminal_status", handleTerminalStatus);
    window.addEventListener("testing:run-all", handleRunAllTests);
    window.addEventListener("testing:run-failed", handleRunFailedTests);
    window.addEventListener("testing:stop", handleStopTests);
    window.addEventListener("testing:refresh", handleRefreshTests);
    window.addEventListener("testing:toggle-watch", handleToggleWatch);
    window.addEventListener("testing:run-coverage", handleRunCoverage);
    window.addEventListener("testing:toggle-coverage", handleToggleCoverage);
    window.addEventListener("testing:show-coverage", handleShowCoverage);
    window.addEventListener("testing:hide-coverage", handleHideCoverage);
    window.addEventListener("testing:clear-results", handleClearResults);
    window.addEventListener("editor:file-saved", handleFileSaved);
    
    // ESSENTIAL - Load settings from localStorage (fast, synchronous)
    loadContinuousSettings();
    loadCoverageDecorationsSettings();

    // DEFERRED - Set up Tauri event listeners after first paint
    // Testing events won't fire until user explicitly runs tests
    const initDeferredListeners = async () => {
      // Listen for test events from backend
      unlistenTestEvent = await listen<{ type: string; data: unknown }>("testing:event", (event) => {
        handleTestEvent(event.payload);
      });

      unlistenTestOutput = await listen<{ output: string }>("testing:output", (event) => {
        handleTestEvent({ type: "test_output", data: event.payload });
      });
    };

    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(initDeferredListeners, { timeout: 2000 });
    } else {
      setTimeout(initDeferredListeners, 100);
    }

    // DEFERRED - Auto-discover tests (slow operation)
    const projectPath = getProjectPath();
    if (projectPath) {
      setTimeout(() => discoverTests(projectPath), 1500);
    }
  });

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: TestingContextValue = {
    state,
    discoverTests,
    refreshTests,
    detectFramework,
    runTest,
    runTests,
    runAllTests,
    runFailedTests,
    runTestFile,
    debugTest,
    stopTests,
    clearResults,
    clearOutput,
    getTestResult,
    goToTest,
    selectTest,
    expandNode,
    collapseNode,
    toggleNode,
    expandAll,
    collapseAll,
    setFilter,
    setSearchQuery,
    setWatchMode,
    toggleWatchMode,
    setShowCoverage,
    setAutoRun,
    runWithCoverage,
    toggleContinuousRun,
    setContinuousSettings,
    testOnSave,
    toggleCoverageDecorations,
    setShowCoverageDecorations,
    loadCoverageFromFile,
    getCoverageForFile,
    clearCoverageDecorations,
    filteredTests,
    testCounts,
    coveragePercentage,
    failedTestIds,
  };

  return <TestingContext.Provider value={value}>{props.children}</TestingContext.Provider>;
};

export function useTesting() {
  const ctx = useContext(TestingContext);
  if (!ctx) {
    throw new Error("useTesting must be used within TestingProvider");
  }
  return ctx;
}
