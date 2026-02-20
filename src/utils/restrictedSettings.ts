/**
 * =============================================================================
 * RESTRICTED SETTINGS - Workspace Trust Security
 * =============================================================================
 * 
 * Defines settings that are restricted in untrusted workspaces for security.
 * These settings could potentially be exploited by malicious workspace configs.
 * 
 * Used by:
 * - SettingsContext to determine if settings can be applied from workspace
 * - SettingsEditor to display restriction warnings
 * - WorkspaceTrustContext to enforce restrictions
 * =============================================================================
 */

// ============================================================================
// Types
// ============================================================================

/** Setting restriction severity level */
export type RestrictionSeverity = "disabled" | "warning";

/** Setting restriction definition */
export interface SettingRestriction {
  /** Setting key pattern (supports wildcards with *) */
  key: string;
  /** Human-readable reason for the restriction */
  reason: string;
  /** Whether the setting is completely disabled or just shows a warning */
  severity: RestrictionSeverity;
  /** Link to documentation about this restriction */
  documentationUrl?: string;
}

// ============================================================================
// Restricted Settings Registry
// ============================================================================

/**
 * Settings that are restricted in untrusted workspaces for security reasons.
 * These settings could potentially be exploited by malicious workspace configurations.
 */
export const RESTRICTED_SETTINGS: SettingRestriction[] = [
  // ==========================================================================
  // Terminal restrictions - prevent arbitrary code execution
  // ==========================================================================
  {
    key: "terminal.integrated.shell.*",
    reason: "Shell execution is restricted in untrusted workspaces to prevent arbitrary code execution.",
    severity: "disabled",
  },
  {
    key: "terminal.integrated.shellArgs.*",
    reason: "Shell arguments are restricted in untrusted workspaces.",
    severity: "disabled",
  },
  {
    key: "terminal.integrated.env.*",
    reason: "Environment variables are restricted to prevent sensitive data exposure.",
    severity: "disabled",
  },
  {
    key: "terminal.shellPath",
    reason: "Custom shell paths are restricted in untrusted workspaces.",
    severity: "disabled",
  },
  {
    key: "terminal.shellArgs",
    reason: "Shell arguments are restricted in untrusted workspaces.",
    severity: "disabled",
  },
  {
    key: "terminal.env",
    reason: "Environment variables are restricted to prevent sensitive data exposure.",
    severity: "disabled",
  },
  {
    key: "terminal.cwd",
    reason: "Working directory setting is restricted in untrusted workspaces.",
    severity: "disabled",
  },

  // ==========================================================================
  // Task restrictions - prevent automatic code execution
  // ==========================================================================
  {
    key: "task.allowAutomaticTasks",
    reason: "Automatic tasks are restricted to prevent unintended code execution.",
    severity: "disabled",
  },
  {
    key: "task.runOnSave",
    reason: "Run on save is restricted in untrusted workspaces.",
    severity: "disabled",
  },
  {
    key: "task.problemMatchers",
    reason: "Problem matchers from workspace settings are restricted.",
    severity: "disabled",
  },

  // ==========================================================================
  // Git restrictions - prevent credential and repository attacks
  // ==========================================================================
  {
    key: "git.autoRepositoryDetection",
    reason: "Automatic repository detection is restricted to prevent credential theft.",
    severity: "warning",
  },
  {
    key: "git.autofetch",
    reason: "Auto-fetch is restricted in untrusted workspaces.",
    severity: "warning",
  },
  {
    key: "git.fetchOnPull",
    reason: "Fetch on pull is restricted in untrusted workspaces.",
    severity: "warning",
  },

  // ==========================================================================
  // Debug restrictions - prevent arbitrary process launching
  // ==========================================================================
  {
    key: "debug.javascript.autoAttachFilter",
    reason: "Debug auto-attach is restricted in untrusted workspaces.",
    severity: "disabled",
  },
  {
    key: "debug.allowBreakpointsEverywhere",
    reason: "Debug breakpoints setting is restricted.",
    severity: "warning",
  },
  {
    key: "launch",
    reason: "Launch configurations are restricted in untrusted workspaces.",
    severity: "disabled",
  },
  {
    key: "launch.*",
    reason: "Launch configurations are restricted in untrusted workspaces.",
    severity: "disabled",
  },

  // ==========================================================================
  // Extension restrictions
  // ==========================================================================
  {
    key: "extensions.autoInstall",
    reason: "Automatic extension installation is restricted.",
    severity: "disabled",
  },
  {
    key: "extensions.autoUpdate",
    reason: "Extension auto-update from workspace settings is restricted.",
    severity: "warning",
  },
  {
    key: "extensions.recommendations",
    reason: "Extension recommendations from workspace may suggest malicious extensions.",
    severity: "warning",
  },

  // ==========================================================================
  // File operation restrictions
  // ==========================================================================
  {
    key: "files.hotExit",
    reason: "Hot exit settings may expose sensitive unsaved data.",
    severity: "warning",
  },
  {
    key: "files.watcherExclude",
    reason: "File watcher exclusions may hide important changes.",
    severity: "warning",
  },

  // ==========================================================================
  // Editor restrictions - external tool execution
  // ==========================================================================
  {
    key: "editor.formatOnSave",
    reason: "Format on save may execute external formatters.",
    severity: "warning",
  },
  {
    key: "editor.formatOnType",
    reason: "Format on type may execute external formatters.",
    severity: "warning",
  },
  {
    key: "editor.formatOnPaste",
    reason: "Format on paste may execute external formatters.",
    severity: "warning",
  },
  {
    key: "editor.codeActionsOnSave",
    reason: "Code actions may execute untrusted code.",
    severity: "warning",
  },
  {
    key: "editor.defaultFormatter",
    reason: "Default formatter from workspace settings may execute untrusted code.",
    severity: "warning",
  },

  // ==========================================================================
  // AI/Completion restrictions
  // ==========================================================================
  {
    key: "ai.inlineSuggestEnabled",
    reason: "AI suggestions may send code to external services.",
    severity: "warning",
  },
  {
    key: "ai.copilotEnabled",
    reason: "Copilot integration may send code to external services.",
    severity: "warning",
  },
  {
    key: "ai.supermavenEnabled",
    reason: "Supermaven integration may send code to external services.",
    severity: "warning",
  },

  // ==========================================================================
  // Search restrictions
  // ==========================================================================
  {
    key: "search.exclude",
    reason: "Search exclusions from workspace settings may hide important files.",
    severity: "warning",
  },

  // ==========================================================================
  // Remote/SSH restrictions
  // ==========================================================================
  {
    key: "remote.autoForwardPorts",
    reason: "Auto port forwarding is restricted in untrusted workspaces.",
    severity: "disabled",
  },
  {
    key: "remote.portsAttributes",
    reason: "Port attributes from workspace settings are restricted.",
    severity: "disabled",
  },

  // ==========================================================================
  // Security-sensitive settings
  // ==========================================================================
  {
    key: "security.*",
    reason: "Security settings cannot be overridden from workspace.",
    severity: "disabled",
  },
  {
    key: "http.proxy",
    reason: "Proxy settings from workspace may redirect traffic.",
    severity: "disabled",
  },
  {
    key: "http.proxyAuthorization",
    reason: "Proxy authorization from workspace settings is restricted.",
    severity: "disabled",
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a setting key matches a restricted pattern (supports wildcards)
 */
export function matchesRestrictedPattern(settingKey: string, pattern: string): boolean {
  const normalizedKey = settingKey.toLowerCase().trim();
  const normalizedPattern = pattern.toLowerCase().trim();

  // Handle wildcard patterns
  if (normalizedPattern.endsWith(".*")) {
    const prefix = normalizedPattern.slice(0, -2);
    return normalizedKey === prefix || normalizedKey.startsWith(prefix + ".");
  }

  // Handle exact match
  return normalizedKey === normalizedPattern;
}

/**
 * Check if a setting is restricted in untrusted workspaces
 */
export function isSettingRestricted(settingKey: string): boolean {
  return RESTRICTED_SETTINGS.some((r) => matchesRestrictedPattern(settingKey, r.key));
}

/**
 * Get the restriction info for a setting (if restricted)
 */
export function getSettingRestriction(settingKey: string): SettingRestriction | undefined {
  return RESTRICTED_SETTINGS.find((r) => matchesRestrictedPattern(settingKey, r.key));
}

/**
 * Get the restriction reason for a setting
 */
export function getSettingRestrictionReason(settingKey: string): string | undefined {
  return getSettingRestriction(settingKey)?.reason;
}

/**
 * Get all restricted setting keys (patterns)
 */
export function getRestrictedSettingKeys(): string[] {
  return RESTRICTED_SETTINGS.map((r) => r.key);
}

/**
 * Check if a restricted setting can be edited (warning severity only)
 */
export function canEditRestrictedSetting(settingKey: string): boolean {
  const restriction = getSettingRestriction(settingKey);
  return restriction ? restriction.severity === "warning" : true;
}

/**
 * Check if a restricted setting is completely disabled (not just warning)
 */
export function isSettingDisabled(settingKey: string): boolean {
  const restriction = getSettingRestriction(settingKey);
  return restriction?.severity === "disabled";
}

/**
 * Get all restrictions for a given section (e.g., "terminal", "git")
 */
export function getRestrictionsForSection(section: string): SettingRestriction[] {
  const normalizedSection = section.toLowerCase();
  return RESTRICTED_SETTINGS.filter((r) => {
    const key = r.key.toLowerCase();
    return key === normalizedSection || key.startsWith(normalizedSection + ".");
  });
}

/**
 * Filter workspace settings to remove restricted ones in untrusted mode
 */
export function filterRestrictedSettings<T extends Record<string, unknown>>(
  settings: T,
  prefix: string = ""
): T {
  const result = { ...settings } as Record<string, unknown>;

  for (const key of Object.keys(result)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const restriction = getSettingRestriction(fullKey);

    if (restriction?.severity === "disabled") {
      delete result[key];
    } else if (typeof result[key] === "object" && result[key] !== null && !Array.isArray(result[key])) {
      // Recursively filter nested objects
      result[key] = filterRestrictedSettings(
        result[key] as Record<string, unknown>,
        fullKey
      );
    }
  }

  return result as T;
}

// ============================================================================
// Export Default
// ============================================================================

export default {
  RESTRICTED_SETTINGS,
  isSettingRestricted,
  getSettingRestriction,
  getSettingRestrictionReason,
  getRestrictedSettingKeys,
  canEditRestrictedSetting,
  isSettingDisabled,
  getRestrictionsForSection,
  filterRestrictedSettings,
};
