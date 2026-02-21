import { describe, it, expect } from "vitest";
import { dirname, basename, extname, joinPath } from "../fileUtils";

describe("fileUtils", () => {
  describe("dirname", () => {
    it("returns directory from path", () => {
      expect(dirname("/home/user/file.txt")).toBe("/home/user");
    });
    it("returns . for bare filename", () => {
      expect(dirname("file.txt")).toBe(".");
    });
    it("returns / for root file", () => {
      expect(dirname("/file.txt")).toBe("/");
    });
    it("handles Windows paths", () => {
      expect(dirname("C:\\Users\\file.txt")).toBe("C:/Users");
    });
  });

  describe("basename", () => {
    it("returns filename from path", () => {
      expect(basename("/home/user/file.txt")).toBe("file.txt");
    });
    it("strips extension when provided", () => {
      expect(basename("/home/user/file.txt", ".txt")).toBe("file");
    });
    it("handles Windows paths", () => {
      expect(basename("C:\\Users\\file.txt")).toBe("file.txt");
    });
  });

  describe("extname", () => {
    it("returns extension with dot", () => {
      expect(extname("file.txt")).toBe(".txt");
    });
    it("returns empty for no extension", () => {
      expect(extname("Makefile")).toBe("");
    });
    it("returns last extension for multiple dots", () => {
      expect(extname("file.test.ts")).toBe(".ts");
    });
    it("returns empty for dotfiles", () => {
      expect(extname(".gitignore")).toBe("");
    });
  });

  describe("joinPath", () => {
    it("joins with forward slash", () => {
      expect(joinPath("/home/user", "file.txt")).toBe("/home/user/file.txt");
    });
    it("joins with backslash for Windows paths", () => {
      expect(joinPath("C:\\Users", "file.txt")).toBe("C:\\Users\\file.txt");
    });
    it("removes trailing separator", () => {
      expect(joinPath("/home/user/", "file.txt")).toBe("/home/user/file.txt");
    });
  });
});
