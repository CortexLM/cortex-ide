/**
 * Testing Types
 *
 * Centralized type definitions for the Testing API, compatible with VS Code's Testing API.
 * Provides types for test controllers, test items, test runs, coverage, and related functionality.
 */

import type { Uri, Range, CancellationToken } from "./search";

// ============================================================================
// Position Type
// ============================================================================

/**
 * Represents a position in a document (0-based line and character).
 */
export interface Position {
  /** 0-based line number */
  line: number;
  /** 0-based character/column */
  character: number;
}

// ============================================================================
// Location Type
// ============================================================================

/**
 * Represents a location in a file (URI + Range).
 */
export interface Location {
  /** The URI of the file */
  uri: Uri;
  /** The range within the file */
  range: Range;
}

// ============================================================================
// Markdown String Type
// ============================================================================

/**
 * Represents a markdown-formatted string.
 */
export interface MarkdownString {
  /** The markdown content */
  value: string;
  /** Whether the markdown supports HTML tags */
  supportHtml?: boolean;
  /** Whether the markdown is trusted (allows command URIs) */
  isTrusted?: boolean;
  /** Base URI for resolving relative links */
  baseUri?: Uri;
}

// ============================================================================
// Test Tag
// ============================================================================

/**
 * A tag associated with a test item.
 * Tags can be used to filter tests or create specific run profiles.
 */
export interface TestTag {
  /** Unique identifier for the tag */
  readonly id: string;
}

// ============================================================================
// Test Item Collection
// ============================================================================

/**
 * Collection of test items, providing methods to manage child test items.
 */
export interface TestItemCollection {
  /** The number of items in the collection */
  readonly size: number;

  /**
   * Adds or replaces an item in the collection.
   * @param item The test item to add
   */
  add(item: TestItem): void;

  /**
   * Removes an item from the collection by its ID.
   * @param id The ID of the item to remove
   */
  delete(id: string): void;

  /**
   * Gets an item from the collection by its ID.
   * @param id The ID of the item to get
   * @returns The test item, or undefined if not found
   */
  get(id: string): TestItem | undefined;

  /**
   * Replaces all items in the collection with the given items.
   * @param items The new items to populate the collection with
   */
  replace(items: readonly TestItem[]): void;

  /**
   * Iterates over all items in the collection.
   * @param callback Function called for each item
   */
  forEach(callback: (item: TestItem, collection: TestItemCollection) => unknown): void;

  /**
   * Returns an iterator over [id, item] pairs.
   */
  [Symbol.iterator](): Iterator<[string, TestItem]>;
}

// ============================================================================
// Test Item
// ============================================================================

/**
 * A test item represents a single test or a group of tests in the test explorer.
 * Test items form a tree structure where items can have children.
 */
export interface TestItem {
  /** Unique identifier for this test item within its parent */
  readonly id: string;

  /** URI of the file containing this test */
  uri?: Uri;

  /** Human-readable label for the test */
  label: string;

  /** Optional description shown after the label */
  description?: string;

  /**
   * A string used for sorting this item relative to siblings.
   * If not set, the label is used.
   */
  sortText?: string;

  /** Range in the document where this test is defined */
  range?: Range;

  /**
   * An error message or markdown string associated with the test.
   * This is typically used to display issues with test discovery.
   */
  error?: string | MarkdownString;

  /**
   * Whether this test item is currently being resolved (loading children).
   * When true, the test explorer shows a loading indicator.
   */
  busy: boolean;

  /**
   * Whether children can be resolved lazily.
   * When true, the test controller's resolveHandler is called when the item is expanded.
   */
  canResolveChildren: boolean;

  /** Tags associated with this test item */
  readonly tags: readonly TestTag[];

  /** Collection of child test items */
  readonly children: TestItemCollection;

  /** Parent test item, if any */
  readonly parent?: TestItem;
}

// ============================================================================
// Test Run Profile Kind
// ============================================================================

/**
 * The kind of test run profile, determining what action to perform.
 */
export enum TestRunProfileKind {
  /** Run tests normally */
  Run = 1,
  /** Run tests with debugger attached */
  Debug = 2,
  /** Run tests with coverage collection */
  Coverage = 3,
}

// ============================================================================
// Test Run Profile
// ============================================================================

/**
 * A test run profile describes how tests are executed.
 * Each controller can have multiple profiles (e.g., Run, Debug, Coverage).
 */
export interface TestRunProfile {
  /** Human-readable label for this profile */
  label: string;

  /** The kind of profile (Run, Debug, or Coverage) */
  readonly kind: TestRunProfileKind;

  /** Whether this is the default profile for its kind */
  isDefault: boolean;

  /** Optional tag to filter which tests this profile applies to */
  tag?: TestTag;

  /** Optional handler called when the user wants to configure this profile */
  configureHandler?: () => void;

  /**
   * Handler called when tests should be run with this profile.
   * @param request The test run request containing tests to run
   * @param token Cancellation token
   */
  runHandler: (request: TestRunRequest, token: CancellationToken) => void | Promise<void>;

  /** Disposes of this run profile */
  dispose(): void;
}

// ============================================================================
// Test Run Request
// ============================================================================

/**
 * A request to run tests, specifying which tests to include/exclude.
 */
export interface TestRunRequest {
  /** Tests to include in the run. If undefined, all tests are included */
  readonly include?: readonly TestItem[];

  /** Tests to exclude from the run */
  readonly exclude?: readonly TestItem[];

  /** The profile used for this test run */
  readonly profile?: TestRunProfile;

  /**
   * Whether to preserve focus in the current editor.
   * If false, the test results view may steal focus.
   */
  readonly preserveFocus?: boolean;
}

// ============================================================================
// Test Message
// ============================================================================

/**
 * A message associated with a test result.
 * Used to report failures, errors, or other information.
 */
export interface TestMessage {
  /** The message content (plain text or markdown) */
  message: string | MarkdownString;

  /** Expected output for diff display (for assertion failures) */
  expectedOutput?: string;

  /** Actual output for diff display (for assertion failures) */
  actualOutput?: string;

  /** Location where the message originated */
  location?: Location;
}

// ============================================================================
// Test Run
// ============================================================================

/**
 * A test run represents an execution of tests.
 * Provides methods to report test results and output.
 */
export interface TestRun {
  /** Name of this test run */
  readonly name?: string;

  /** Cancellation token for this run */
  readonly token: CancellationToken;

  /** Whether results from this run will be persisted */
  readonly isPersisted: boolean;

  /**
   * Marks a test as enqueued (waiting to run).
   * @param test The test item
   */
  enqueued(test: TestItem): void;

  /**
   * Marks a test as started.
   * @param test The test item
   */
  started(test: TestItem): void;

  /**
   * Marks a test as skipped.
   * @param test The test item
   */
  skipped(test: TestItem): void;

  /**
   * Marks a test as failed.
   * @param test The test item
   * @param message Failure message(s)
   * @param duration Duration in milliseconds
   */
  failed(test: TestItem, message: TestMessage | readonly TestMessage[], duration?: number): void;

  /**
   * Marks a test as errored (unexpected error during execution).
   * @param test The test item
   * @param message Error message(s)
   * @param duration Duration in milliseconds
   */
  errored(test: TestItem, message: TestMessage | readonly TestMessage[], duration?: number): void;

  /**
   * Marks a test as passed.
   * @param test The test item
   * @param duration Duration in milliseconds
   */
  passed(test: TestItem, duration?: number): void;

  /**
   * Appends output to the test run.
   * @param output The output text
   * @param location Optional location associated with the output
   * @param test Optional test item associated with the output
   */
  appendOutput(output: string, location?: Location, test?: TestItem): void;

  /**
   * Adds file coverage data to the test run.
   * @param fileCoverage The coverage data for a file
   */
  addCoverage(fileCoverage: FileCoverage): void;

  /** Signals that the test run has completed */
  end(): void;
}

// ============================================================================
// Test Controller
// ============================================================================

/**
 * A test controller manages a collection of tests and their execution.
 * Each test framework typically creates one controller.
 */
export interface TestController {
  /** Unique identifier for this controller */
  readonly id: string;

  /** Human-readable label for this controller */
  label: string;

  /** The root test item collection for this controller */
  readonly items: TestItemCollection;

  /**
   * Creates a new run profile for this controller.
   * @param label Human-readable label for the profile
   * @param kind The kind of profile (Run, Debug, Coverage)
   * @param runHandler Handler called when tests are run with this profile
   * @param isDefault Whether this is the default profile for its kind
   * @param tag Optional tag to filter which tests this profile applies to
   * @returns The created run profile
   */
  createRunProfile(
    label: string,
    kind: TestRunProfileKind,
    runHandler: (request: TestRunRequest, token: CancellationToken) => void | Promise<void>,
    isDefault?: boolean,
    tag?: TestTag
  ): TestRunProfile;

  /**
   * Creates a new test item.
   * @param id Unique identifier within its parent
   * @param label Human-readable label
   * @param uri Optional URI of the file containing the test
   * @returns The created test item
   */
  createTestItem(id: string, label: string, uri?: Uri): TestItem;

  /**
   * Creates a new test run for reporting results.
   * @param request The test run request
   * @param name Optional name for the run
   * @param persist Whether to persist the results (default: true)
   * @returns The created test run
   */
  createTestRun(request: TestRunRequest, name?: string, persist?: boolean): TestRun;

  /**
   * Invalidates cached test results for the given items.
   * @param items Test items to invalidate, or undefined for all
   */
  invalidateTestResults(items?: TestItem | readonly TestItem[]): void;

  /**
   * Optional handler called when tests need to be resolved.
   * Used for lazy loading of test children.
   */
  resolveHandler?: (item: TestItem | undefined) => void | Promise<void>;

  /**
   * Optional handler called to refresh all tests.
   * If provided, a refresh button is shown in the test explorer.
   */
  refreshHandler?: (token: CancellationToken) => void | Promise<void>;

  /** Disposes of this test controller and all its resources */
  dispose(): void;
}

// ============================================================================
// Coverage Statistics
// ============================================================================

/**
 * Statistics about code coverage (covered/total counts).
 */
export interface CoverageStatistics {
  /** Number of items that were covered (executed) */
  covered: number;
  /** Total number of items */
  total: number;
}

// ============================================================================
// Statement Coverage
// ============================================================================

/**
 * Coverage information for a single statement.
 */
export interface StatementCoverage {
  /** Location of the statement */
  location: Range | Position;
  /** Number of times the statement was executed */
  executed: number;
}

// ============================================================================
// Branch Coverage
// ============================================================================

/**
 * Coverage information for a branch (e.g., if/else, switch case).
 */
export interface BranchCoverage {
  /** Location of the branch */
  location: Range | Position;
  /** Total number of times the branch point was reached */
  executed: number;
  /** Individual branch outcomes */
  branches: BranchOutcome[];
}

/**
 * Coverage information for a single branch outcome.
 */
export interface BranchOutcome {
  /** Number of times this branch was taken */
  executed: number;
  /** Optional location of this specific branch */
  location?: Range | Position;
  /** Optional label for this branch */
  label?: string;
}

// ============================================================================
// Declaration Coverage
// ============================================================================

/**
 * Coverage information for a declaration (function, method, class).
 */
export interface DeclarationCoverage {
  /** Name of the declaration */
  name: string;
  /** Location of the declaration */
  location: Range | Position;
  /** Number of times the declaration was executed */
  executed: number;
}

// ============================================================================
// File Coverage Detail
// ============================================================================

/**
 * Detailed coverage information for a specific item in a file.
 */
export type FileCoverageDetail = StatementCoverage | BranchCoverage | DeclarationCoverage;

// ============================================================================
// File Coverage
// ============================================================================

/**
 * Coverage information for a single file.
 */
export interface FileCoverage {
  /** URI of the file */
  readonly uri: Uri;

  /** Statement coverage statistics */
  statementCoverage: CoverageStatistics;

  /** Branch coverage statistics (optional) */
  branchCoverage?: CoverageStatistics;

  /** Declaration/function coverage statistics (optional) */
  declarationCoverage?: CoverageStatistics;

  /**
   * Detailed coverage information for items in the file.
   * Can be loaded lazily by implementing a loadDetailedCoverage method.
   */
  detailedCoverage?: FileCoverageDetail[];
}

// ============================================================================
// Test Result State (for UI)
// ============================================================================

/**
 * The state of a test result.
 */
export enum TestResultState {
  /** Test has not been run */
  Unset = 0,
  /** Test is queued to run */
  Queued = 1,
  /** Test is currently running */
  Running = 2,
  /** Test passed */
  Passed = 3,
  /** Test failed */
  Failed = 4,
  /** Test was skipped */
  Skipped = 5,
  /** Test errored (unexpected error) */
  Errored = 6,
}

// ============================================================================
// Test Result (for UI)
// ============================================================================

/**
 * A snapshot of a test result for display in the UI.
 */
export interface TestResult {
  /** The test item this result is for */
  readonly test: TestItem;
  /** The state of the test */
  readonly state: TestResultState;
  /** Duration of the test in milliseconds */
  readonly duration?: number;
  /** Messages associated with the result */
  readonly messages: readonly TestMessage[];
}

// ============================================================================
// Test Run Result (for UI)
// ============================================================================

/**
 * The complete results of a test run.
 */
export interface TestRunResult {
  /** Unique identifier for this run */
  readonly id: string;
  /** Name of the run */
  readonly name?: string;
  /** All test results in this run */
  readonly results: readonly TestResult[];
  /** When the run was completed (timestamp) */
  readonly completedAt?: number;
  /** Whether the run was cancelled */
  readonly cancelled: boolean;
}

// ============================================================================
// Test Explorer State (for UI)
// ============================================================================

/**
 * State for the test explorer view.
 */
export interface TestExplorerState {
  /** All registered test controllers */
  controllers: Map<string, TestController>;
  /** The currently active test run, if any */
  currentRun?: TestRun;
  /** Historical test run results */
  runHistory: TestRunResult[];
  /** Whether auto-run on save is enabled */
  autoRunOnSave: boolean;
  /** Filter pattern for tests */
  filter?: string;
  /** Selected test items */
  selectedItems: Set<string>;
  /** Expanded test items in the tree */
  expandedItems: Set<string>;
}

// ============================================================================
// Test Discovery Options
// ============================================================================

/**
 * Options for test discovery.
 */
export interface TestDiscoveryOptions {
  /** Whether to watch for file changes and update tests */
  watch?: boolean;
  /** Glob patterns for test files */
  include?: string[];
  /** Glob patterns to exclude */
  exclude?: string[];
}

// ============================================================================
// Factory Functions Type Definitions
// ============================================================================

/**
 * Factory for creating test tags.
 */
export interface TestTagFactory {
  (id: string): TestTag;
}

/**
 * Factory for creating test messages.
 */
export interface TestMessageFactory {
  (message: string | MarkdownString): TestMessage;
  diff(message: string | MarkdownString, expected: string, actual: string): TestMessage;
}


