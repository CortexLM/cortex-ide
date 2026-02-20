/**
 * useTerminalAutoReply - Hook to handle auto-replies in a terminal
 *
 * Watches terminal output and automatically sends responses when
 * configured patterns are matched.
 */

import { createSignal, onCleanup, createMemo, Accessor } from "solid-js";
import type { AutoReplyRule } from "@/components/terminal/TerminalAutoReplies";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useTerminalAutoReply hook
 */
export interface UseTerminalAutoReplyOptions {
  /** Terminal ID to watch */
  terminalId: string;
  /** Terminal name (for filtering) */
  terminalName?: string;
  /** List of auto-reply rules */
  rules: Accessor<AutoReplyRule[]>;
  /** Callback when an auto-reply is triggered */
  onAutoReply?: (rule: AutoReplyRule, matchedText: string) => void;
  /** Callback to write to the terminal */
  writeToTerminal: (data: string) => Promise<void>;
  /** Whether auto-reply is globally enabled */
  enabled?: Accessor<boolean>;
  /** Buffer size for output matching (default: 1000 chars) */
  bufferSize?: number;
}

/**
 * Return type for the hook
 */
export interface UseTerminalAutoReplyReturn {
  /** Process incoming terminal output */
  processOutput: (data: string) => void;
  /** Get list of recent matches */
  recentMatches: Accessor<RecentMatch[]>;
  /** Clear recent matches */
  clearMatches: () => void;
  /** Temporarily disable auto-reply for this terminal */
  pause: () => void;
  /** Resume auto-reply */
  resume: () => void;
  /** Whether auto-reply is currently paused */
  isPaused: Accessor<boolean>;
  /** Statistics */
  stats: Accessor<AutoReplyStats>;
}

/**
 * Information about a recent auto-reply match
 */
export interface RecentMatch {
  ruleId: string;
  ruleName: string;
  matchedText: string;
  replySent: string;
  timestamp: number;
}

/**
 * Auto-reply statistics
 */
export interface AutoReplyStats {
  totalMatches: number;
  matchesByRule: Record<string, number>;
  lastMatchTime: number | null;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_BUFFER_SIZE = 1000;
const MAX_RECENT_MATCHES = 50;

// ============================================================================
// Hook Implementation
// ============================================================================

export function useTerminalAutoReply(options: UseTerminalAutoReplyOptions): UseTerminalAutoReplyReturn {
  const {
    terminalId,
    terminalName = "",
    rules,
    onAutoReply,
    writeToTerminal,
    enabled = () => true,
    bufferSize = DEFAULT_BUFFER_SIZE,
  } = options;

  // State
  const [isPaused, setIsPaused] = createSignal(false);
  const [recentMatches, setRecentMatches] = createSignal<RecentMatch[]>([]);
  const [outputBuffer, setOutputBuffer] = createSignal("");
  const [stats, setStats] = createSignal<AutoReplyStats>({
    totalMatches: 0,
    matchesByRule: {},
    lastMatchTime: null,
  });

  // Pending delays for rules with delay > 0
  const pendingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  // Filter rules applicable to this terminal
  const applicableRules = createMemo(() => {
    const allRules = rules();
    return allRules.filter((rule) => {
      if (!rule.enabled) return false;

      // Check terminal filter
      if (rule.terminalFilter) {
        const filterLower = rule.terminalFilter.toLowerCase();
        const nameLower = terminalName.toLowerCase();
        const idLower = terminalId.toLowerCase();
        
        if (!nameLower.includes(filterLower) && !idLower.includes(filterLower)) {
          return false;
        }
      }

      return true;
    });
  });

  /**
   * Check if a rule matches the current buffer
   */
  const checkRuleMatch = (rule: AutoReplyRule, buffer: string): string | null => {
    try {
      const flags = rule.caseSensitive ? "g" : "gi";
      const regex = new RegExp(rule.pattern, flags);
      const match = buffer.match(regex);
      
      if (match) {
        return match[0];
      }
    } catch (e) {
      console.error(`[AutoReply] Invalid pattern in rule ${rule.id}:`, e);
    }
    return null;
  };

  /**
   * Execute an auto-reply
   */
  const executeReply = async (rule: AutoReplyRule, matchedText: string) => {
    try {
      // Send the reply
      await writeToTerminal(rule.reply);

      // Record the match
      const match: RecentMatch = {
        ruleId: rule.id,
        ruleName: rule.name,
        matchedText,
        replySent: rule.reply,
        timestamp: Date.now(),
      };

      setRecentMatches((prev) => {
        const updated = [match, ...prev];
        return updated.slice(0, MAX_RECENT_MATCHES);
      });

      // Update stats
      setStats((prev) => ({
        totalMatches: prev.totalMatches + 1,
        matchesByRule: {
          ...prev.matchesByRule,
          [rule.id]: (prev.matchesByRule[rule.id] || 0) + 1,
        },
        lastMatchTime: Date.now(),
      }));

      // Call callback
      onAutoReply?.(rule, matchedText);

      if (import.meta.env.DEV) console.log(`[AutoReply] Rule "${rule.name}" matched and replied in terminal ${terminalId}`);
    } catch (e) {
      console.error(`[AutoReply] Failed to send reply for rule ${rule.id}:`, e);
    }
  };

  /**
   * Process terminal output and check for matches
   */
  const processOutput = (data: string) => {
    if (!enabled() || isPaused()) return;

    // Update buffer with new data
    setOutputBuffer((prev) => {
      const updated = prev + data;
      // Trim buffer if too large
      if (updated.length > bufferSize) {
        return updated.slice(-bufferSize);
      }
      return updated;
    });

    const currentBuffer = outputBuffer() + data;
    const rulesToCheck = applicableRules();

    // Check each rule
    for (const rule of rulesToCheck) {
      // Skip if this rule already has a pending delayed reply
      if (pendingTimeouts.has(rule.id)) continue;

      const matchedText = checkRuleMatch(rule, currentBuffer);
      
      if (matchedText) {
        // Clear the buffer portion that was matched to avoid re-triggering
        setOutputBuffer((prev) => {
          const matchIndex = prev.lastIndexOf(matchedText);
          if (matchIndex >= 0) {
            return prev.slice(matchIndex + matchedText.length);
          }
          return prev;
        });

        if (rule.delay && rule.delay > 0) {
          // Schedule delayed reply
          const timeout = setTimeout(() => {
            pendingTimeouts.delete(rule.id);
            executeReply(rule, matchedText);
          }, rule.delay);
          
          pendingTimeouts.set(rule.id, timeout);
        } else {
          // Execute immediately
          executeReply(rule, matchedText);
        }

        // Only match one rule per output chunk to avoid conflicts
        break;
      }
    }
  };

  /**
   * Clear recent matches
   */
  const clearMatches = () => {
    setRecentMatches([]);
  };

  /**
   * Pause auto-reply
   */
  const pause = () => {
    setIsPaused(true);
    // Clear any pending timeouts
    pendingTimeouts.forEach((timeout) => clearTimeout(timeout));
    pendingTimeouts.clear();
  };

  /**
   * Resume auto-reply
   */
  const resume = () => {
    setIsPaused(false);
    // Clear buffer to avoid immediate triggers from old content
    setOutputBuffer("");
  };

  // Cleanup on unmount
  onCleanup(() => {
    pendingTimeouts.forEach((timeout) => clearTimeout(timeout));
    pendingTimeouts.clear();
  });

  return {
    processOutput,
    recentMatches,
    clearMatches,
    pause,
    resume,
    isPaused,
    stats,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Load auto-reply rules from localStorage
 */
export function loadAutoReplyRules(): AutoReplyRule[] {
  try {
    const stored = localStorage.getItem("cortex_terminal_auto_replies");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("[AutoReply] Failed to load rules:", e);
  }
  return [];
}

/**
 * Save auto-reply rules to localStorage
 */
export function saveAutoReplyRules(rules: AutoReplyRule[]): void {
  try {
    localStorage.setItem("cortex_terminal_auto_replies", JSON.stringify(rules));
  } catch (e) {
    console.error("[AutoReply] Failed to save rules:", e);
  }
}

/**
 * Update trigger count for a rule after it fires
 */
export function updateRuleTriggerCount(ruleId: string): void {
  try {
    const rules = loadAutoReplyRules();
    const rule = rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.triggerCount = (rule.triggerCount || 0) + 1;
      rule.lastTriggered = Date.now();
      saveAutoReplyRules(rules);
    }
  } catch (e) {
    console.error("[AutoReply] Failed to update trigger count:", e);
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default useTerminalAutoReply;
