import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWindowLabel, getStorageItem, setStorageItem, initializeWindowStorage } from "../windowStorage";

describe("windowStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(window, "location", {
      value: { search: "" },
      writable: true,
    });
  });

  describe("getWindowLabel", () => {
    it("returns main by default", () => {
      expect(getWindowLabel()).toBe("main");
    });
    it("returns window param from URL", () => {
      Object.defineProperty(window, "location", {
        value: { search: "?window=secondary" },
        writable: true,
      });
      expect(getWindowLabel()).toBe("secondary");
    });
  });

  describe("getStorageItem", () => {
    it("returns null for missing key", () => {
      expect(getStorageItem("missing")).toBeNull();
    });
    it("returns localStorage value", () => {
      localStorage.setItem("test_main", "value");
      expect(getStorageItem("test")).toBe("value");
    });
    it("falls back to global key", () => {
      localStorage.setItem("test", "global");
      expect(getStorageItem("test")).toBe("global");
    });
    it("uses sessionStorage when flag set", () => {
      sessionStorage.setItem("test_main", "session_val");
      expect(getStorageItem("test", true)).toBe("session_val");
    });
  });

  describe("setStorageItem", () => {
    it("sets localStorage value with window key", () => {
      setStorageItem("mykey", "myval");
      expect(localStorage.getItem("mykey_main")).toBe("myval");
      expect(localStorage.getItem("mykey")).toBe("myval");
    });
    it("sets sessionStorage when flag set", () => {
      setStorageItem("mykey", "myval", true);
      expect(sessionStorage.getItem("mykey_main")).toBe("myval");
      expect(sessionStorage.getItem("mykey")).toBe("myval");
    });
  });

  describe("initializeWindowStorage", () => {
    it("stores project from URL params", () => {
      Object.defineProperty(window, "location", {
        value: { search: "?project=/path/to/project" },
        writable: true,
      });
      initializeWindowStorage();
      expect(localStorage.getItem("cortex_current_project_main")).toBe("/path/to/project");
      expect(localStorage.getItem("cortex_current_project")).toBe("/path/to/project");
    });
    it("does nothing without project param", () => {
      initializeWindowStorage();
      expect(localStorage.getItem("cortex_current_project_main")).toBeNull();
    });
  });
});
