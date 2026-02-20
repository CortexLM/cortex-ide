/**
 * useBracketColorization Hook
 *
 * SolidJS hook for managing bracket pair colorization and bracket guide
 * settings. Provides reactive accessors, toggle helpers, and a computed
 * Monaco editor options object ready for `editor.updateOptions()`.
 */

import { createMemo } from "solid-js";
import { useSettings } from "@/context/SettingsContext";

// ============================================================================
// Types
// ============================================================================

export interface BracketColorizationOptions {
  enabled: boolean;
  guidesEnabled: boolean;
  independentColorPoolPerBracketType: boolean;
  highlightActiveBracketPair: boolean;
}

export interface UseBracketColorizationReturn {
  /** Computed bracket colorization options */
  options: () => BracketColorizationOptions;
  /** Whether bracket pair colorization is enabled */
  isEnabled: () => boolean;
  /** Whether bracket pair guides are enabled */
  guidesEnabled: () => boolean;
  /** Toggle bracket pair colorization on/off */
  toggle: () => void;
  /** Toggle bracket pair guides on/off */
  toggleGuides: () => void;
  /** Set bracket pair colorization enabled state */
  setEnabled: (enabled: boolean) => void;
  /** Set bracket pair guides enabled state */
  setGuidesEnabled: (enabled: boolean) => void;
  /** Computed Monaco editor options for bracket colorization and guides */
  getMonacoOptions: () => Record<string, unknown>;
}

// ============================================================================
// Hook
// ============================================================================

export function useBracketColorization(): UseBracketColorizationReturn {
  const { effectiveSettings, updateEditorSetting } = useSettings();

  const isEnabled = createMemo(() => effectiveSettings().editor.bracketPairColorization ?? true);
  const guidesEnabled = createMemo(() => effectiveSettings().editor.guidesBracketPairs ?? true);

  const options = createMemo<BracketColorizationOptions>(() => ({
    enabled: isEnabled(),
    guidesEnabled: guidesEnabled(),
    independentColorPoolPerBracketType: true,
    highlightActiveBracketPair: guidesEnabled(),
  }));

  const toggle = () => {
    updateEditorSetting("bracketPairColorization", !isEnabled());
  };

  const toggleGuides = () => {
    updateEditorSetting("guidesBracketPairs", !guidesEnabled());
  };

  const setEnabled = (enabled: boolean) => {
    updateEditorSetting("bracketPairColorization", enabled);
  };

  const setGuidesEnabled = (enabled: boolean) => {
    updateEditorSetting("guidesBracketPairs", enabled);
  };

  const getMonacoOptions = createMemo(() => ({
    bracketPairColorization: {
      enabled: isEnabled(),
      independentColorPoolPerBracketType: true,
    },
    guides: {
      bracketPairs: guidesEnabled(),
      bracketPairsHorizontal: guidesEnabled() ? "active" as const : false as const,
      highlightActiveBracketPair: guidesEnabled(),
      indentation: true,
    },
  }));

  return {
    options,
    isEnabled,
    guidesEnabled,
    toggle,
    toggleGuides,
    setEnabled,
    setGuidesEnabled,
    getMonacoOptions,
  };
}
