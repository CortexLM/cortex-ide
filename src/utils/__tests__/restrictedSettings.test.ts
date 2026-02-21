import { describe, it, expect } from "vitest";
import {
  RESTRICTED_SETTINGS,
  matchesRestrictedPattern,
  isSettingRestricted,
  getSettingRestriction,
  getSettingRestrictionReason,
  getRestrictedSettingKeys,
  canEditRestrictedSetting,
  isSettingDisabled,
} from "../restrictedSettings";

describe("restrictedSettings", () => {
  describe("RESTRICTED_SETTINGS", () => {
    it("is a non-empty array", () => {
      expect(Array.isArray(RESTRICTED_SETTINGS)).toBe(true);
      expect(RESTRICTED_SETTINGS.length).toBeGreaterThan(0);
    });

    it("each has key, reason, and severity", () => {
      for (const r of RESTRICTED_SETTINGS) {
        expect(r.key).toBeTruthy();
        expect(r.reason).toBeTruthy();
        expect(["disabled", "warning"]).toContain(r.severity);
      }
    });
  });

  describe("matchesRestrictedPattern", () => {
    it("matches exact key", () => {
      const key = RESTRICTED_SETTINGS[0].key;
      expect(matchesRestrictedPattern(key, key)).toBe(true);
    });

    it("does not match unrelated key", () => {
      expect(matchesRestrictedPattern("unrelated.key", "other.key")).toBe(false);
    });
  });

  describe("isSettingRestricted", () => {
    it("returns true for restricted setting", () => {
      const key = RESTRICTED_SETTINGS[0].key;
      expect(isSettingRestricted(key)).toBe(true);
    });

    it("returns false for unrestricted setting", () => {
      expect(isSettingRestricted("editor.fontSize")).toBe(false);
    });
  });

  describe("getSettingRestriction", () => {
    it("returns restriction for restricted key", () => {
      const key = RESTRICTED_SETTINGS[0].key;
      const restriction = getSettingRestriction(key);
      expect(restriction).toBeDefined();
      expect(restriction!.key).toBe(key);
    });

    it("returns undefined for unrestricted key", () => {
      expect(getSettingRestriction("editor.fontSize")).toBeUndefined();
    });
  });

  describe("getSettingRestrictionReason", () => {
    it("returns reason for restricted key", () => {
      const key = RESTRICTED_SETTINGS[0].key;
      expect(getSettingRestrictionReason(key)).toBeTruthy();
    });

    it("returns undefined for unrestricted key", () => {
      expect(getSettingRestrictionReason("editor.fontSize")).toBeUndefined();
    });
  });

  describe("getRestrictedSettingKeys", () => {
    it("returns array of keys", () => {
      const keys = getRestrictedSettingKeys();
      expect(keys.length).toBeGreaterThan(0);
    });
  });

  describe("canEditRestrictedSetting", () => {
    it("returns false for disabled setting", () => {
      const disabled = RESTRICTED_SETTINGS.find((r) => r.severity === "disabled");
      if (disabled) {
        expect(canEditRestrictedSetting(disabled.key)).toBe(false);
      }
    });

    it("returns true for unrestricted setting", () => {
      expect(canEditRestrictedSetting("editor.fontSize")).toBe(true);
    });
  });

  describe("isSettingDisabled", () => {
    it("returns true for disabled setting", () => {
      const disabled = RESTRICTED_SETTINGS.find((r) => r.severity === "disabled");
      if (disabled) {
        expect(isSettingDisabled(disabled.key)).toBe(true);
      }
    });

    it("returns false for unrestricted setting", () => {
      expect(isSettingDisabled("editor.fontSize")).toBe(false);
    });
  });
});
