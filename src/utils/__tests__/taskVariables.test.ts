import { describe, it, expect } from "vitest";
import {
  substituteVariables,
  findUnresolvedVariables,
  getAvailableVariables,
  validateInputValue,
  parseInputDefinitions,
  InputValidationError,
  InputCancelledError,
  substituteTaskCommand,
} from "../taskVariables";

const ctx = {
  workspaceFolder: "/home/user/project",
  workspaceFolderBasename: "project",
  file: "/home/user/project/src/main.ts",
  relativeFile: "src/main.ts",
  fileBasename: "main.ts",
  fileBasenameNoExtension: "main",
  fileDirname: "/home/user/project/src",
  fileExtname: ".ts",
  lineNumber: "1",
  selectedText: "hello",
  env: { HOME: "/home/user", PATH: "/usr/bin" },
};

describe("taskVariables", () => {
  describe("substituteVariables", () => {
    it("substitutes workspaceFolder", () => {
      expect(substituteVariables("${workspaceFolder}", ctx)).toBe("/home/user/project");
    });

    it("substitutes fileBasename", () => {
      expect(substituteVariables("${fileBasename}", ctx)).toBe("main.ts");
    });

    it("substitutes multiple variables", () => {
      const result = substituteVariables("${workspaceFolder}/${relativeFile}", ctx);
      expect(result).toBe("/home/user/project/src/main.ts");
    });

    it("substitutes env variables", () => {
      const result = substituteVariables("${env:HOME}", ctx);
      expect(result).toBe("/home/user");
    });

    it("leaves unknown variables unchanged", () => {
      const result = substituteVariables("${unknownVar}", ctx);
      expect(result).toContain("unknownVar");
    });

    it("handles no variables", () => {
      expect(substituteVariables("plain text", ctx)).toBe("plain text");
    });

    it("substitutes selectedText", () => {
      expect(substituteVariables("${selectedText}", ctx)).toBe("hello");
    });

    it("substitutes fileExtname", () => {
      expect(substituteVariables("${fileExtname}", ctx)).toBe(".ts");
    });

    it("substitutes fileBasenameNoExtension", () => {
      expect(substituteVariables("${fileBasenameNoExtension}", ctx)).toBe("main");
    });

    it("substitutes fileDirname", () => {
      expect(substituteVariables("${fileDirname}", ctx)).toBe("/home/user/project/src");
    });

    it("substitutes workspaceFolderBasename", () => {
      expect(substituteVariables("${workspaceFolderBasename}", ctx)).toBe("project");
    });
  });

  describe("substituteTaskCommand", () => {
    it("substitutes in command and args", () => {
      const result = substituteTaskCommand(
        "${workspaceFolder}/build.sh",
        ["--file", "${fileBasename}"],
        ctx
      );
      expect(result.command).toBe("/home/user/project/build.sh");
      expect(result.args[1]).toBe("main.ts");
    });

    it("handles undefined args", () => {
      const result = substituteTaskCommand("${workspaceFolder}/build.sh", undefined, ctx);
      expect(result.args).toEqual([]);
    });
  });

  describe("findUnresolvedVariables", () => {
    it("finds unresolved variables", () => {
      const result = findUnresolvedVariables("${workspaceFolder} ${unknown}");
      expect(result).toContain("${workspaceFolder}");
      expect(result).toContain("${unknown}");
    });

    it("returns empty for no variables", () => {
      expect(findUnresolvedVariables("plain text")).toEqual([]);
    });

    it("finds env variables", () => {
      const result = findUnresolvedVariables("${env:HOME}");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("getAvailableVariables", () => {
    it("returns list of available variables", () => {
      const vars = getAvailableVariables();
      expect(vars.length).toBeGreaterThan(0);
      expect(vars.some((v) => v.name === "workspaceFolder")).toBe(true);
      expect(vars.some((v) => v.name === "file")).toBe(true);
    });

    it("each variable has name and description", () => {
      const vars = getAvailableVariables();
      for (const v of vars) {
        expect(v.name).toBeTruthy();
        expect(v.description).toBeTruthy();
      }
    });
  });

  describe("validateInputValue", () => {
    it("returns null for valid string input", () => {
      expect(validateInputValue("test", { type: "promptString" } as any)).toBeNull();
    });

    it("returns null for valid pickString input", () => {
      expect(validateInputValue("a", { type: "pickString", options: ["a", "b"] } as any)).toBeNull();
    });

    it("returns error for invalid pickString value", () => {
      const result = validateInputValue("c", { type: "pickString", options: ["a", "b"] } as any);
      expect(result).toBeTruthy();
    });

    it("returns error for empty password", () => {
      const result = validateInputValue("", { type: "promptString", password: true } as any);
      expect(result).toBeTruthy();
    });
  });

  describe("parseInputDefinitions", () => {
    it("parses input definitions", () => {
      const defs = parseInputDefinitions([
        { id: "name", type: "promptString", description: "Enter name" },
        { id: "choice", type: "pickString", description: "Pick one", options: ["a", "b"] },
      ]);
      expect(defs.name).toBeDefined();
      expect(defs.name.id).toBe("name");
      expect(defs.choice).toBeDefined();
    });

    it("handles empty array", () => {
      const defs = parseInputDefinitions([]);
      expect(Object.keys(defs)).toHaveLength(0);
    });
  });

  describe("InputValidationError", () => {
    it("creates validation error", () => {
      const err = new InputValidationError("invalid");
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe("invalid");
    });
  });

  describe("InputCancelledError", () => {
    it("creates cancelled error", () => {
      const err = new InputCancelledError();
      expect(err).toBeInstanceOf(Error);
    });
  });
});
