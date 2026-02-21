import { describe, it, expect, beforeEach } from "vitest";
import { getProjectPath, setProjectPath, clearProjectPath } from "../workspace";

describe("workspace", () => {
  beforeEach(() => {
    clearProjectPath();
  });

  describe("getProjectPath / setProjectPath", () => {
    it("returns empty string initially", () => {
      expect(getProjectPath()).toBe("");
    });

    it("sets and gets project path", () => {
      setProjectPath("/home/user/project");
      expect(getProjectPath()).toBe("/home/user/project");
    });
  });

  describe("clearProjectPath", () => {
    it("clears the project path", () => {
      setProjectPath("/home/user/project");
      clearProjectPath();
      expect(getProjectPath()).toBe("");
    });
  });
});
