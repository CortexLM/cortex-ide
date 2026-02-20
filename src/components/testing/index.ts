// Test Explorer exports
export { TestExplorer } from "./TestExplorer";
export type {
  TestExplorerProps,
  TestFile,
  TestSuite,
  TestCase,
  TestStatus,
} from "./TestExplorer";

// Coverage Bar exports
export {
  CoverageBar,
  CoverageStats,
  CoverageBadge,
  CoverageRing,
  CoverageChange,
  MiniCoverageBar,
  getCoverageStatus,
  getCoverageColor,
  getCoverageBackgroundColor,
  DEFAULT_THRESHOLDS,
} from "./CoverageBars";
export type {
  CoverageBarProps,
  CoverageStatsProps,
  CoverageBadgeProps,
  CoverageRingProps,
  CoverageChangeProps,
  MiniCoverageBarProps,
  CoverageThresholds,
  CoverageStatus,
} from "./CoverageBars";

// Coverage View exports
export {
  CoverageView,
} from "./CoverageView";
export type {
  CoverageViewProps,
  FileCoverage,
  CoverageSummary,
  CoverageTrend,
  CoverageReport,
} from "./CoverageView";

// Test Coverage Overlay (Monaco editor decorations)
export {
  TestCoverageOverlay,
  useCoverageOverlay,
} from "./TestCoverageOverlay";
export type {
  TestCoverageOverlayProps,
} from "./TestCoverageOverlay";

// Test Decorations (Monaco editor gutter icons)
export {
  TestDecorations,
  useTestDecorations,
} from "./TestDecorations";
export type {
  TestDecorationsProps,
} from "./TestDecorations";

// Test Output Panel
export {
  TestOutputPanel,
} from "./TestOutputPanel";
export type {
  TestOutputPanelProps,
} from "./TestOutputPanel";

// Enhanced Testing Panels
export { TestResults } from "./TestResults";
export { CoverageOverlay } from "./CoverageOverlay";
export { TestOutput } from "./TestOutput";
