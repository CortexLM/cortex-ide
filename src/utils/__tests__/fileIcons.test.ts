import { describe, it, expect } from "vitest";
import { getFileIcon, getFolderIcon, getFolderIconExpanded } from "../fileIcons";

describe("fileIcons", () => {
  describe("getFileIcon", () => {
    it("returns icon for TypeScript file", () => {
      const icon = getFileIcon("main.ts");
      expect(icon).toBeTruthy();
    });

    it("returns icon for JavaScript file", () => {
      const icon = getFileIcon("index.js");
      expect(icon).toBeTruthy();
    });

    it("returns icon for JSON file", () => {
      const icon = getFileIcon("package.json");
      expect(icon).toBeTruthy();
    });

    it("returns icon for directory", () => {
      const icon = getFileIcon("src", true);
      expect(icon).toBeTruthy();
    });

    it("returns icon for unknown file type", () => {
      const icon = getFileIcon("unknown.xyz");
      expect(icon).toBeTruthy();
    });

    it("returns icon for dotfiles", () => {
      const icon = getFileIcon(".gitignore");
      expect(icon).toBeTruthy();
    });
  });

  describe("getFolderIcon", () => {
    it("returns icon for src folder", () => {
      expect(getFolderIcon("src")).toBeTruthy();
    });

    it("returns icon for node_modules", () => {
      expect(getFolderIcon("node_modules")).toBeTruthy();
    });

    it("returns icon for generic folder", () => {
      expect(getFolderIcon("myFolder")).toBeTruthy();
    });
  });

  describe("getFolderIconExpanded", () => {
    it("returns expanded icon for folder", () => {
      expect(getFolderIconExpanded("src")).toBeTruthy();
    });
  });
});
