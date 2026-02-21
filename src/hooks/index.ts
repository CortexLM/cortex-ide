// ============================================================================
// Keyboard Hooks
// ============================================================================

export { useKeyboard, createKeyboardShortcut } from "./useKeyboard";
export { useDebugKeyboard, getDebugStatusText, getDebugShortcutHints } from "./useDebugKeyboard";

// ============================================================================
// Agent Follow Hooks
// ============================================================================

export {
  useAgentFollowActions,
  useAgentToolTracking,
  useFollowModeSubscription,
  useLocationSubscription,
} from "./useAgentFollow";

// ============================================================================
// High-frequency Streaming Hooks
// ============================================================================

export {
  useAnimatedList,
  type AnimationState,
  type AnimatedItem,
  type UseAnimatedListOptions,
  type UseAnimatedListReturn,
  type ItemStyle,
} from "./useAnimatedList";

export {
  useHighFrequencyUpdates,
  useBlinkingCursor,
  useRAFDebounce,
  type CursorPosition,
  type LineInfo,
  type StreamingStats,
  type UseHighFrequencyUpdatesOptions,
  type UseHighFrequencyUpdatesReturn,
} from "./useHighFrequencyUpdates";

// ============================================================================
// Local Storage Hooks
// ============================================================================

export {
  useLocalStorage,
  useLocalStorageBoolean,
  useLocalStorageNumber,
  useLocalStorageString,
  useLocalStorageArray,
  type UseLocalStorageOptions,
  type UseLocalStorageReturn,
} from "./useLocalStorage";

// ============================================================================
// Debounce Hooks
// ============================================================================

export {
  useDebounce,
  useDebouncedCallback,
  useDebounceEffect,
  useRAFDebounce as useRAFDebounceFn,
  useDebounceState,
  type DebounceOptions,
  type RAFDebounceOptions,
  type DebouncedFunction,
} from "./useDebounce";

// ============================================================================
// Throttle Hooks
// ============================================================================

export {
  useThrottle,
  useThrottledCallback,
  useRAFThrottle,
  useThrottleState,
  useLeadingThrottle,
  useTrailingThrottle,
  type ThrottleOptions,
  type ThrottledFunction,
} from "./useThrottle";

// ============================================================================
// Event Listener Hooks
// ============================================================================

export {
  useEventListener,
  useWindowResize,
  useVisibilityChange,
  useWindowFocus,
  useScroll,
  useClickOutside,
  useMediaQuery,
  useKeyboardEvent,
  useMouseEvent,
  useCustomEvent,
  useCustomEventDispatcher,
  useInterval,
  useTimeout,
  useEventListeners,
  type EventListenerOptions,
  type EventHandler,
  type EventTarget as EventTargetType,
} from "./useEventListener";

// ============================================================================
// Tauri Event Hooks
// ============================================================================

export {
  useTauriListen,
  useTauriListeners,
  useTauriListenWhen,
} from "./useTauriListen";

// ============================================================================
// Resize Observer Hooks
// ============================================================================

export {
  useResizeObserver,
  useElementSize,
  useMultiResizeObserver,
  useWindowSize,
  useContainerQuery,
  type Size,
  type ResizeInfo,
  type ResizeObserverOptions,
  type UseResizeObserverReturn,
  type MultiResizeObserverOptions,
} from "./useResizeObserver";

// ============================================================================
// Intersection Observer Hooks
// ============================================================================

export {
  useIntersectionObserver,
  useInView,
  useLazyLoad,
  useInfiniteScroll,
  useVisibilityTracker,
  useMultiIntersectionObserver,
  type IntersectionInfo,
  type IntersectionObserverOptions,
  type UseIntersectionObserverReturn,
} from "./useIntersectionObserver";

// ============================================================================
// Previous Value Hooks
// ============================================================================

export {
  usePrevious,
  usePreviousDistinct,
  useHasChanged,
  useChangeCount,
  useHistory,
  useFirstRender,
  useLatest,
  useChangedProps,
  useDelta,
  type UsePreviousOptions,
  type UsePreviousDistinctOptions,
  type HistoryEntry,
  type UseHistoryOptions,
  type UseHistoryReturn,
} from "./usePrevious";

// ============================================================================
// Async Hooks
// ============================================================================

export {
  useAsync,
  useAsyncFn,
  useAsyncEffect,
  usePolling,
  clearCache,
  invalidateCache,
  getCachedData,
  prefetch,
  type AsyncStatus,
  type AsyncState,
  type UseAsyncOptions,
  type RetryOptions,
  type CacheOptions,
  type UseAsyncReturn,
} from "./useAsync";

// ============================================================================
// Inline Completions Hooks
// ============================================================================

export {
  useInlineCompletions,
  useInlineCompletionStatus,
  type UseInlineCompletionsOptions,
  type UseInlineCompletionsReturn,
} from "./useInlineCompletions";

// ============================================================================
// Quick Pick Wizard Hooks
// ============================================================================

export {
  useQuickPickWizard,
  createWizardStep,
  createInputStep,
  combineWizardSteps,
  type WizardStep,
  type WizardStepResult,
  type ValidationResult,
  type UseQuickPickWizardOptions,
  type UseQuickPickWizardReturn,
} from "./useQuickPickWizard";

// ============================================================================
// Terminal Command Detection Hooks
// ============================================================================

export {
  useCommandDetection,
  useCommandDecorationIntegration,
  type OSC633SequenceType,
  type OSC633Event,
  type DetectedCommand,
  type UseCommandDetectionOptions,
  type UseCommandDetectionReturn,
  type OSC633ParserLike,
  type UseCommandDecorationIntegrationOptions,
  type UseCommandDecorationIntegrationReturn,
} from "./useCommandDetection";

// ============================================================================
// Terminal Image Hooks
// ============================================================================

export {
  useTerminalImages,
  createImagePreloader,
  type TerminalImage,
  type UseTerminalImagesOptions,
  type UseTerminalImagesReturn,
} from "./useTerminalImages";

// ============================================================================
// Terminal Completion Hooks
// ============================================================================

export {
  useTerminalCompletion,
  createAdvancedCompletionSource,
  detectShellType,
  completionItemToSuggestion,
  type UseTerminalCompletionOptions,
  type UseTerminalCompletionResult,
} from "./useTerminalCompletion";

// ============================================================================
// Command Registry Hooks
// ============================================================================

export {
  useCommandRegistry,
  type CommandRegistration,
} from "./useCommandRegistry";

// ============================================================================
// Bracket Colorization Hooks
// ============================================================================

export {
  useBracketColorization,
  type BracketColorizationOptions,
  type UseBracketColorizationReturn,
} from "./useBracketColorization";

// ============================================================================
// LSP Feature Hooks
// ============================================================================

export {
  useLspFeature,
  type UseLspFeatureReturn,
  type UseLspFeatureOptions,
} from "./useLspFeature";

// ============================================================================
// Debug Session Hooks
// ============================================================================

export {
  useDebugSession,
  type DebugSessionConfig,
  type UseDebugSessionReturn,
} from "./useDebugSession";

// ============================================================================
// Diagnostics Hooks
// ============================================================================

export {
  useDiagnostics,
  type DiagnosticEntry,
  type UseDiagnosticsOptions,
  type UseDiagnosticsReturn,
} from "./useDiagnostics";

// ============================================================================
// Terminal Search Hooks
// ============================================================================

export {
  useTerminalSearch,
  type TerminalSearchMatch,
  type UseTerminalSearchReturn,
} from "./useTerminalSearch";

// ============================================================================
// Accessibility Hooks
// ============================================================================

export {
  useAccessibility,
  type UseAccessibilityReturn,
} from "./useAccessibility";
