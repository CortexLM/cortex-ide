import { describe, it, expect } from "vitest";
import {
  CURRENT_SETTINGS_VERSION,
  MIGRATIONS,
  getSettingsVersion,
  needsMigration,
  getPendingMigrations,
  migrateSettings,
} from "../settingsMigration";

describe("settingsMigration", () => {
  describe("CURRENT_SETTINGS_VERSION", () => {
    it("is a positive number", () => {
      expect(CURRENT_SETTINGS_VERSION).toBeGreaterThan(0);
    });
  });

  describe("MIGRATIONS", () => {
    it("is an array", () => {
      expect(Array.isArray(MIGRATIONS)).toBe(true);
    });

    it("each migration has description and migrate function", () => {
      for (const m of MIGRATIONS) {
        expect(m.description).toBeTruthy();
        expect(typeof m.migrate).toBe("function");
      }
    });
  });

  describe("getSettingsVersion", () => {
    it("returns 1 for empty settings", () => {
      expect(getSettingsVersion({})).toBe(1);
    });

    it("returns version from settings", () => {
      expect(getSettingsVersion({ version: 3 } as any)).toBe(3);
    });
  });

  describe("needsMigration", () => {
    it("returns true for old settings", () => {
      expect(needsMigration({})).toBe(true);
    });

    it("returns false for current version", () => {
      expect(needsMigration({ version: CURRENT_SETTINGS_VERSION } as any)).toBe(false);
    });
  });

  describe("getPendingMigrations", () => {
    it("returns migrations for old version", () => {
      const pending = getPendingMigrations({});
      expect(pending.length).toBeGreaterThan(0);
    });

    it("returns no migrations for current version", () => {
      const pending = getPendingMigrations({ version: CURRENT_SETTINGS_VERSION } as any);
      expect(pending).toHaveLength(0);
    });
  });

  describe("migrateSettings", () => {
    it("returns migrated settings", () => {
      const result = migrateSettings({ version: CURRENT_SETTINGS_VERSION } as any);
      expect(result).toBeDefined();
      expect(result.settings).toBeDefined();
      expect(result.finalVersion).toBe(CURRENT_SETTINGS_VERSION);
    });

    it("applies no migrations when already current", () => {
      const result = migrateSettings({ version: CURRENT_SETTINGS_VERSION } as any);
      expect(result.migrated).toBe(false);
      expect(result.appliedMigrations).toHaveLength(0);
    });
  });
});
