/**
 * =============================================================================
 * SETTINGS MIGRATION - Migrate Settings Between Versions
 * =============================================================================
 * 
 * Handles forward migration of settings when the schema changes between
 * application versions. Supports:
 * - Renaming settings keys
 * - Restructuring nested settings
 * - Adding new required settings with defaults
 * - Removing deprecated settings
 * - Transforming value formats
 * 
 * Migrations are idempotent and can be run multiple times safely.
 * =============================================================================
 */

import type { CortexSettings } from "../context/SettingsContext";

// ============================================================================
// Types
// ============================================================================

/** A single settings migration step */
export interface SettingsMigration {
  /** Source version this migration applies from */
  fromVersion: number;
  /** Target version after migration */
  toVersion: number;
  /** Human-readable description of what this migration does */
  description: string;
  /** The migration function - should be pure and handle missing data gracefully */
  migrate: (settings: DeepPartial<CortexSettings>) => DeepPartial<CortexSettings>;
  /** Optional validation function to check if migration was successful */
  validate?: (settings: DeepPartial<CortexSettings>) => boolean;
}

/** Migration result */
export interface MigrationResult {
  /** The migrated settings object */
  settings: DeepPartial<CortexSettings>;
  /** Whether any migrations were applied */
  migrated: boolean;
  /** The final version number */
  finalVersion: number;
  /** List of migrations that were applied */
  appliedMigrations: MigrationApplied[];
  /** Any warnings or notes from the migration process */
  warnings: string[];
  /** Errors encountered (non-fatal) */
  errors: string[];
}

/** Record of an applied migration */
export interface MigrationApplied {
  /** Migration version range */
  fromVersion: number;
  toVersion: number;
  /** Description of what was done */
  description: string;
  /** Timestamp when applied */
  timestamp: number;
}

/** Migration history entry stored with settings */
export interface MigrationHistoryEntry {
  /** Version migrated from */
  fromVersion: number;
  /** Version migrated to */
  toVersion: number;
  /** When the migration was performed */
  timestamp: number;
  /** Description of the migration */
  description: string;
}

/** Deep partial type for flexible settings handling */
type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

// ============================================================================
// Current Settings Version
// ============================================================================

/** Current settings schema version - increment when adding breaking changes */
export const CURRENT_SETTINGS_VERSION = 5;

// ============================================================================
// Migration Definitions
// ============================================================================

/**
 * All settings migrations in order from oldest to newest.
 * Each migration should be independent and handle missing data gracefully.
 */
export const MIGRATIONS: SettingsMigration[] = [
  // Version 1 -> 2: Rename editor.tabSize to editor.indentSize (legacy migration)
  {
    fromVersion: 1,
    toVersion: 2,
    description: "Migrate editor.tabSize to editor.indentSize (deprecated - kept for historical settings)",
    migrate: (settings) => {
      const result = { ...settings };
      
      // Note: This migration was later reverted, but we keep it for settings
      // that may have been migrated during the brief period it was active.
      // Modern settings use tabSize, so we just ensure it exists.
      if (result.editor) {
        // If indentSize exists but tabSize doesn't, copy it back
        if ("indentSize" in result.editor && !("tabSize" in result.editor)) {
          (result.editor as Record<string, unknown>).tabSize = (result.editor as Record<string, unknown>).indentSize;
          delete (result.editor as Record<string, unknown>).indentSize;
        }
      }
      
      return result;
    },
  },

  // Version 2 -> 3: Restructure AI settings
  {
    fromVersion: 2,
    toVersion: 3,
    description: "Restructure AI settings - add inlineSuggest configuration object",
    migrate: (settings) => {
      const result = { ...settings };
      
      if (result.ai) {
        const ai = result.ai as Record<string, unknown>;
        
        // Migrate legacy inline suggest settings to new structure
        if (!ai.inlineSuggest) {
          ai.inlineSuggest = {
            enabled: ai.inlineSuggestEnabled ?? true,
            showToolbar: ai.inlineSuggestShowToolbar ?? true,
            suppressSuggestions: false,
            provider: "auto",
            debounceMs: 150,
            maxCompletionLength: 500,
            contextLinesBefore: 50,
            contextLinesAfter: 10,
            enableCache: true,
            cacheTtlMs: 60000,
          };
        }
        
        result.ai = ai;
      }
      
      return result;
    },
    validate: (settings) => {
      const ai = settings.ai as Record<string, unknown> | undefined;
      return ai?.inlineSuggest !== undefined;
    },
  },

  // Version 3 -> 4: Add breadcrumbs configuration object
  {
    fromVersion: 3,
    toVersion: 4,
    description: "Add detailed breadcrumbs configuration to theme settings",
    migrate: (settings) => {
      const result = { ...settings };
      
      if (result.theme) {
        const theme = result.theme as Record<string, unknown>;
        
        // Create breadcrumbs config if it doesn't exist
        if (!theme.breadcrumbs) {
          theme.breadcrumbs = {
            enabled: theme.breadcrumbsEnabled ?? true,
            filePath: "on",
            symbolPath: "on",
            icons: true,
          };
        }
        
        result.theme = theme;
      }
      
      return result;
    },
  },

  // Version 4 -> 5: Add SSH settings and restructure terminal settings
  {
    fromVersion: 4,
    toVersion: 5,
    description: "Add SSH settings section and accessibility options to terminal",
    migrate: (settings) => {
      const result = { ...settings };
      
      // Add SSH settings if not present
      const resultAny = result as Record<string, unknown>;
      if (!resultAny.ssh) {
        resultAny.ssh = {
          defaultUsername: "",
          defaultPort: 22,
          configFilePath: "",
          defaultKeyPath: "",
          connectionTimeout: 30,
          keepAliveInterval: 60,
          defaultAuthMethod: "key",
          useAgent: true,
          savedProfiles: [],
          autoReconnect: true,
          maxReconnectAttempts: 3,
          reconnectDelay: 5,
          compression: false,
          terminalType: "xterm-256color",
        };
      }
      
      // Add accessibility settings to terminal if not present
      if (result.terminal) {
        const terminal = result.terminal as Record<string, unknown>;
        
        if (terminal.accessibleViewEnabled === undefined) {
          terminal.accessibleViewEnabled = false;
        }
        if (terminal.screenReaderAnnounce === undefined) {
          terminal.screenReaderAnnounce = true;
        }
        
        result.terminal = terminal;
      }
      
      return result;
    },
  },
];

// ============================================================================
// Migration Engine
// ============================================================================

/**
 * Deep clone an object to avoid mutating the original
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(deepClone) as unknown as T;
  }
  
  const cloned: Record<string, unknown> = {};
  for (const key of Object.keys(obj as object)) {
    cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
  }
  return cloned as T;
}

/**
 * Get the settings version from a settings object
 */
export function getSettingsVersion(settings: DeepPartial<CortexSettings>): number {
  return (settings as { version?: number }).version ?? 1;
}

/**
 * Set the settings version
 */
function setSettingsVersion(settings: DeepPartial<CortexSettings>, version: number): void {
  (settings as { version: number }).version = version;
}

/**
 * Migrate settings from one version to another.
 * 
 * @param settings - The settings object to migrate
 * @param fromVersion - The version to migrate from (defaults to settings.version or 1)
 * @param toVersion - The version to migrate to (defaults to CURRENT_SETTINGS_VERSION)
 * @returns Migration result with the migrated settings and metadata
 */
export function migrateSettings(
  settings: DeepPartial<CortexSettings>,
  fromVersion?: number,
  toVersion: number = CURRENT_SETTINGS_VERSION
): MigrationResult {
  // Determine starting version
  const startVersion = fromVersion ?? getSettingsVersion(settings);
  
  // Clone settings to avoid mutation
  let current = deepClone(settings);
  let migrated = false;
  const appliedMigrations: MigrationApplied[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // If already at or past target version, no migration needed
  if (startVersion >= toVersion) {
    return {
      settings: current,
      migrated: false,
      finalVersion: startVersion,
      appliedMigrations: [],
      warnings: [],
      errors: [],
    };
  }
  
  // Apply migrations in order
  for (const migration of MIGRATIONS) {
    // Skip migrations that don't apply
    if (migration.fromVersion < startVersion || migration.toVersion > toVersion) {
      continue;
    }
    
    // Skip if current settings version is past this migration
    if (getSettingsVersion(current) >= migration.toVersion) {
      continue;
    }
    
    try {
      if (import.meta.env.DEV) console.log(
        `[SettingsMigration] Applying migration ${migration.fromVersion} -> ${migration.toVersion}: ${migration.description}`
      );
      
      // Apply the migration
      current = migration.migrate(current);
      
      // Validate if validator is provided
      if (migration.validate && !migration.validate(current)) {
        warnings.push(
          `Migration ${migration.fromVersion} -> ${migration.toVersion} validation failed, but continuing`
        );
      }
      
      // Update version
      setSettingsVersion(current, migration.toVersion);
      
      // Record the migration
      appliedMigrations.push({
        fromVersion: migration.fromVersion,
        toVersion: migration.toVersion,
        description: migration.description,
        timestamp: Date.now(),
      });
      
      migrated = true;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      errors.push(`Migration ${migration.fromVersion} -> ${migration.toVersion} failed: ${errorMsg}`);
      console.error(`[SettingsMigration] Migration failed:`, e);
      
      // Continue to next migration - partial migrations are better than none
    }
  }
  
  // Ensure final version is set
  setSettingsVersion(current, toVersion);
  
  return {
    settings: current,
    migrated,
    finalVersion: toVersion,
    appliedMigrations,
    warnings,
    errors,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if settings need migration
 */
export function needsMigration(
  settings: DeepPartial<CortexSettings>,
  targetVersion: number = CURRENT_SETTINGS_VERSION
): boolean {
  const currentVersion = getSettingsVersion(settings);
  return currentVersion < targetVersion;
}

/**
 * Get list of migrations that would be applied
 */
export function getPendingMigrations(
  settings: DeepPartial<CortexSettings>,
  targetVersion: number = CURRENT_SETTINGS_VERSION
): SettingsMigration[] {
  const currentVersion = getSettingsVersion(settings);
  
  return MIGRATIONS.filter(
    (m) => m.fromVersion >= currentVersion && m.toVersion <= targetVersion
  );
}

/**
 * Get migration description for user notification
 */
export function getMigrationSummary(result: MigrationResult): string {
  if (!result.migrated) {
    return "Settings are up to date.";
  }
  
  const migrationCount = result.appliedMigrations.length;
  const descriptions = result.appliedMigrations.map((m) => `- ${m.description}`);
  
  let summary = `Applied ${migrationCount} migration(s) to update settings to version ${result.finalVersion}:\n`;
  summary += descriptions.join("\n");
  
  if (result.warnings.length > 0) {
    summary += "\n\nWarnings:\n" + result.warnings.map((w) => `- ${w}`).join("\n");
  }
  
  if (result.errors.length > 0) {
    summary += "\n\nErrors (non-fatal):\n" + result.errors.map((e) => `- ${e}`).join("\n");
  }
  
  return summary;
}

/**
 * Store migration history in settings
 */
export function addMigrationHistory(
  settings: DeepPartial<CortexSettings>,
  result: MigrationResult
): DeepPartial<CortexSettings> {
  if (!result.migrated) return settings;
  
  const settingsWithHistory = { ...settings } as Record<string, unknown>;
  
  // Initialize migration history array if not present
  if (!Array.isArray(settingsWithHistory._migrationHistory)) {
    settingsWithHistory._migrationHistory = [];
  }
  
  // Add entries for each applied migration
  const history = settingsWithHistory._migrationHistory as MigrationHistoryEntry[];
  for (const applied of result.appliedMigrations) {
    history.push({
      fromVersion: applied.fromVersion,
      toVersion: applied.toVersion,
      timestamp: applied.timestamp,
      description: applied.description,
    });
  }
  
  return settingsWithHistory as DeepPartial<CortexSettings>;
}

/**
 * Get migration history from settings
 */
export function getMigrationHistory(
  settings: DeepPartial<CortexSettings>
): MigrationHistoryEntry[] {
  const settingsWithHistory = settings as Record<string, unknown>;
  
  if (Array.isArray(settingsWithHistory._migrationHistory)) {
    return settingsWithHistory._migrationHistory as MigrationHistoryEntry[];
  }
  
  return [];
}

/**
 * Create a backup of settings before migration
 */
export function createSettingsBackup(settings: DeepPartial<CortexSettings>): string {
  const backup = {
    ...settings,
    _backup: {
      timestamp: Date.now(),
      version: getSettingsVersion(settings),
    },
  };
  
  return JSON.stringify(backup, null, 2);
}

/**
 * Restore settings from a backup string
 */
export function restoreSettingsBackup(backupJson: string): DeepPartial<CortexSettings> {
  const backup = JSON.parse(backupJson);
  delete backup._backup;
  return backup;
}

// ============================================================================
// Export Default
// ============================================================================

export default {
  CURRENT_SETTINGS_VERSION,
  MIGRATIONS,
  migrateSettings,
  needsMigration,
  getPendingMigrations,
  getMigrationSummary,
  addMigrationHistory,
  getMigrationHistory,
  createSettingsBackup,
  restoreSettingsBackup,
};
