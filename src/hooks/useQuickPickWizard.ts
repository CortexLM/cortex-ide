/**
 * =============================================================================
 * USE QUICK PICK WIZARD - Multi-step Wizard Navigation Hook
 * =============================================================================
 * 
 * A SolidJS hook for managing multi-step wizards with back navigation support.
 * Designed to work with the QuickPick component for creating step-by-step
 * selection flows.
 * 
 * Features:
 * - Step-based navigation with history tracking
 * - Back navigation support (Alt+Left)
 * - State persistence between steps
 * - Validation support per step
 * - Conditional step skipping
 * - Reset and cleanup utilities
 * 
 * @example
 * ```tsx
 * const steps: WizardStep<NewFileState>[] = [
 *   {
 *     id: 'selectFolder',
 *     title: 'Select Folder',
 *     provideItems: async () => getFolders(),
 *     onAccept: (item, state) => ({ ...state, folder: item.data.path })
 *   },
 *   {
 *     id: 'enterName',
 *     title: 'Enter File Name',
 *     provideItems: async () => [],
 *     onAccept: (item, state) => ({ ...state, name: item.label })
 *   },
 *   {
 *     id: 'selectTemplate',
 *     title: 'Select Template',
 *     provideItems: async (state) => getTemplatesForExtension(state.name),
 *     onAccept: (item, state) => 'complete'
 *   }
 * ];
 * 
 * const wizard = useQuickPickWizard(steps, { folder: '', name: '' });
 * ```
 */

import { createSignal, createMemo, Accessor } from "solid-js";
import { createStore, SetStoreFunction, Store } from "solid-js/store";
import type { QuickPickItem } from "@/components/ui/QuickPick";

// =============================================================================
// Types
// =============================================================================

/**
 * Result of accepting an item in a wizard step.
 * Can return updated state or 'complete' to finish the wizard.
 */
export type WizardStepResult<T> = T | "complete" | "skip" | { nextStep: string; state: T };

/**
 * Validation function return type
 */
export type ValidationResult = string | null;

/**
 * Definition of a single wizard step
 */
export interface WizardStep<T, D = unknown> {
  /** Unique identifier for the step */
  id: string;
  
  /** Title displayed in the wizard header */
  title: string;
  
  /** Placeholder text for the input */
  placeholder?: string;
  
  /** 
   * Whether this step uses QuickInput instead of QuickPick.
   * If true, provideItems will not be called.
   */
  isInputStep?: boolean;
  
  /** Default value for input steps */
  defaultValue?: string | ((state: T) => string);
  
  /** 
   * Provide items for this step.
   * Receives the current wizard state.
   */
  provideItems: (state: T) => Promise<QuickPickItem<D>[]>;
  
  /**
   * Called when an item is accepted.
   * Returns new state, 'complete' to finish, 'skip' to skip, 
   * or { nextStep, state } to jump to a specific step.
   */
  onAccept: (item: QuickPickItem<D> | string, state: T) => WizardStepResult<T> | Promise<WizardStepResult<T>>;
  
  /**
   * Optional validation function.
   * Returns an error message or null if valid.
   */
  validate?: (state: T) => ValidationResult | Promise<ValidationResult>;
  
  /**
   * Optional function to determine if this step should be skipped.
   * If returns true, the step is skipped automatically.
   */
  shouldSkip?: (state: T) => boolean;
  
  /**
   * Optional items to show when the step is first loaded (before user types).
   * Useful for showing suggestions or history.
   */
  initialItems?: QuickPickItem<D>[] | ((state: T) => Promise<QuickPickItem<D>[]>);
  
  /**
   * Optional help text shown below the input.
   */
  helpText?: string | ((state: T) => string);
  
  /**
   * Whether to match on description when filtering (QuickPick only).
   */
  matchOnDescription?: boolean;
  
  /**
   * Whether to match on detail when filtering (QuickPick only).
   */
  matchOnDetail?: boolean;
}

/**
 * Options for the wizard hook
 */
export interface UseQuickPickWizardOptions<T> {
  /** Called when the wizard completes successfully */
  onComplete?: (finalState: T) => void;
  
  /** Called when the wizard is cancelled */
  onCancel?: () => void;
  
  /** Called when an error occurs */
  onError?: (error: Error, step: string) => void;
  
  /** Whether to reset state when going back (default: false) */
  resetOnBack?: boolean;
}

/**
 * Return type of the useQuickPickWizard hook
 */
export interface UseQuickPickWizardReturn<T> {
  /** The current step definition */
  currentStep: Accessor<WizardStep<T, any>>;
  
  /** Current step index (1-based for display) */
  stepNumber: Accessor<number>;
  
  /** Total number of steps */
  totalSteps: number;
  
  /** Whether the user can go back */
  canGoBack: Accessor<boolean>;
  
  /** Go back to the previous step */
  goBack: () => void;
  
  /** Go to a specific step by id */
  goToStep: (stepId: string) => void;
  
  /** Go to a specific step by index */
  goToStepIndex: (index: number) => void;
  
  /** The current wizard state */
  state: Store<T>;
  
  /** Update the wizard state */
  updateState: SetStoreFunction<T>;
  
  /** Reset the wizard to initial state */
  reset: () => void;
  
  /** Whether the wizard is complete */
  isComplete: Accessor<boolean>;
  
  /** Whether the wizard is currently processing */
  isProcessing: Accessor<boolean>;
  
  /** Current error message, if any */
  error: Accessor<string | null>;
  
  /** Clear the current error */
  clearError: () => void;
  
  /** Accept an item (or input value) for the current step */
  acceptItem: (item: QuickPickItem<any> | string) => Promise<void>;
  
  /** Get the step index by id */
  getStepIndex: (stepId: string) => number;
  
  /** Navigation history (step indices) */
  history: Accessor<number[]>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Create a multi-step wizard with back navigation support
 */
export function useQuickPickWizard<T extends object>(
  steps: WizardStep<T, any>[],
  initialState: T,
  options: UseQuickPickWizardOptions<T> = {}
): UseQuickPickWizardReturn<T> {
  const { onComplete, onCancel, onError, resetOnBack = false } = options;
  
  // Core state
  const [currentStepIndex, setCurrentStepIndex] = createSignal(0);
  const [state, setState] = createStore<T>({ ...initialState });
  const [history, setHistory] = createSignal<number[]>([]);
  const [isComplete, setIsComplete] = createSignal(false);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  
  // Derived state
  const currentStep = createMemo(() => steps[currentStepIndex()]);
  const stepNumber = createMemo(() => currentStepIndex() + 1);
  const canGoBack = createMemo(() => history().length > 0);
  
  /**
   * Get step index by id
   */
  const getStepIndex = (stepId: string): number => {
    return steps.findIndex(s => s.id === stepId);
  };
  
  /**
   * Go back to the previous step
   */
  const goBack = (): void => {
    const hist = history();
    if (hist.length === 0) {
      // If no history, cancel the wizard
      onCancel?.();
      return;
    }
    
    const previousIndex = hist[hist.length - 1];
    setHistory(hist.slice(0, -1));
    setCurrentStepIndex(previousIndex);
    setError(null);
    
    // Optionally reset state to initial when going back
    if (resetOnBack) {
      setState({ ...initialState });
    }
  };
  
  /**
   * Navigate to a specific step by id
   */
  const goToStep = (stepId: string): void => {
    const index = getStepIndex(stepId);
    if (index >= 0 && index < steps.length) {
      goToStepIndex(index);
    }
  };
  
  /**
   * Navigate to a specific step by index
   */
  const goToStepIndex = (index: number): void => {
    if (index >= 0 && index < steps.length && index !== currentStepIndex()) {
      setHistory([...history(), currentStepIndex()]);
      setCurrentStepIndex(index);
      setError(null);
    }
  };
  
  /**
   * Move to the next step, handling skips
   */
  const moveToNextStep = (): boolean => {
    let nextIndex = currentStepIndex() + 1;
    
    // Skip steps that should be skipped
    while (nextIndex < steps.length) {
      const nextStep = steps[nextIndex];
      if (nextStep.shouldSkip?.(state)) {
        nextIndex++;
        continue;
      }
      break;
    }
    
    if (nextIndex >= steps.length) {
      // Wizard complete
      setIsComplete(true);
      onComplete?.(state);
      return true;
    }
    
    setHistory([...history(), currentStepIndex()]);
    setCurrentStepIndex(nextIndex);
    return false;
  };
  
  /**
   * Accept an item or input value for the current step
   */
  const acceptItem = async (item: QuickPickItem<any> | string): Promise<void> => {
    const step = currentStep();
    if (!step) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Validate if validation function exists
      if (step.validate) {
        const validationError = await step.validate(state);
        if (validationError) {
          setError(validationError);
          setIsProcessing(false);
          return;
        }
      }
      
      // Call onAccept to get the result
      const result = await step.onAccept(item, state);
      
      if (result === "complete") {
        // Wizard is complete
        setIsComplete(true);
        onComplete?.(state);
      } else if (result === "skip") {
        // Skip to next step
        moveToNextStep();
      } else if (typeof result === "object" && "nextStep" in result) {
        // Jump to specific step with updated state
        setState(result.state as any);
        const targetIndex = getStepIndex(result.nextStep);
        if (targetIndex >= 0) {
          setHistory([...history(), currentStepIndex()]);
          setCurrentStepIndex(targetIndex);
        } else {
          // Invalid step, move to next
          moveToNextStep();
        }
      } else {
        // Update state and move to next step
        setState(result as any);
        moveToNextStep();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
      onError?.(error, step.id);
    } finally {
      setIsProcessing(false);
    }
  };
  
  /**
   * Reset the wizard to its initial state
   */
  const reset = (): void => {
    setCurrentStepIndex(0);
    setHistory([]);
    setState({ ...initialState } as any);
    setIsComplete(false);
    setIsProcessing(false);
    setError(null);
  };
  
  /**
   * Clear the current error
   */
  const clearError = (): void => {
    setError(null);
  };
  
  return {
    currentStep,
    stepNumber,
    totalSteps: steps.length,
    canGoBack,
    goBack,
    goToStep,
    goToStepIndex,
    state,
    updateState: setState,
    reset,
    isComplete,
    isProcessing,
    error,
    clearError,
    acceptItem,
    getStepIndex,
    history,
  };
}

// =============================================================================
// Utility Types and Helpers
// =============================================================================

/**
 * Helper to create a simple wizard step
 */
export function createWizardStep<T, D = unknown>(
  config: WizardStep<T, D>
): WizardStep<T, D> {
  return config;
}

/**
 * Helper to create an input-only wizard step
 */
export function createInputStep<T>(
  config: Omit<WizardStep<T, string>, "provideItems" | "isInputStep"> & {
    onAccept: (value: string, state: T) => WizardStepResult<T> | Promise<WizardStepResult<T>>;
  }
): WizardStep<T, string> {
  return {
    ...config,
    isInputStep: true,
    provideItems: async () => [], // Not used for input steps
    onAccept: (item, state) => {
      const value = typeof item === "string" ? item : item.label;
      return config.onAccept(value, state);
    },
  };
}

/**
 * Helper to combine multiple wizards sequentially
 */
export function combineWizardSteps<T>(...stepGroups: WizardStep<T, any>[][]): WizardStep<T, any>[] {
  return stepGroups.flat();
}

// =============================================================================
// Export
// =============================================================================

export default useQuickPickWizard;
