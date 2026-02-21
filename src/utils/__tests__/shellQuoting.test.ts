import { describe, it, expect } from "vitest";
import {
  detectShellType,
  needsQuoting,
  escapeString,
  strongQuote,
  weakQuote,
  quoteString,
  buildShellCommand,
  parseShellCommand,
  getDefaultShell,
  quotePowerShell,
  quoteCmd,
  escapeRegExp,
  joinCommands,
  createCdCommand,
  quoteEnvVar,
  createEnvAssignment,
} from "../shellQuoting";

describe("shellQuoting", () => {
  describe("detectShellType", () => {
    it("detects bash", () => {
      expect(detectShellType("/bin/bash")).toBe("bash");
      expect(detectShellType("/usr/bin/bash")).toBe("bash");
      expect(detectShellType("C:\\git\\bin\\bash.exe")).toBe("bash");
    });
    it("detects zsh", () => {
      expect(detectShellType("/bin/zsh")).toBe("zsh");
    });
    it("detects fish", () => {
      expect(detectShellType("/usr/bin/fish")).toBe("fish");
    });
    it("detects powershell", () => {
      expect(detectShellType("pwsh")).toBe("pwsh");
      expect(detectShellType("powershell.exe")).toBe("pwsh");
    });
    it("detects cmd", () => {
      expect(detectShellType("cmd.exe")).toBe("cmd");
    });
    it("detects sh", () => {
      expect(detectShellType("/bin/sh")).toBe("sh");
    });
    it("returns unknown for unrecognized", () => {
      expect(detectShellType("/usr/bin/something")).toBe("unknown");
    });
    it("detects WSL bash", () => {
      expect(detectShellType("/usr/bin/wsl")).toBe("bash");
    });
    it("detects cygwin bash", () => {
      expect(detectShellType("C:\\cygwin\\bin\\bash.exe")).toBe("bash");
    });
  });

  describe("needsQuoting", () => {
    it("returns true for empty string", () => {
      expect(needsQuoting("", "bash")).toBe(true);
    });
    it("returns true for string with spaces", () => {
      expect(needsQuoting("hello world", "bash")).toBe(true);
    });
    it("returns false for simple word", () => {
      expect(needsQuoting("hello", "bash")).toBe(false);
    });
    it("returns true for special characters", () => {
      expect(needsQuoting("hello$world", "bash")).toBe(true);
      expect(needsQuoting("file&name", "cmd")).toBe(true);
    });
  });

  describe("escapeString", () => {
    it("escapes special characters", () => {
      expect(escapeString("hello world", "\\", " ")).toBe("hello\\ world");
    });
    it("escapes escape character itself", () => {
      expect(escapeString("back\\slash", "\\", "")).toBe("back\\\\slash");
    });
  });

  describe("strongQuote", () => {
    it("wraps in single quotes", () => {
      expect(strongQuote("hello", "'")).toBe("'hello'");
    });
    it("escapes single quotes inside single-quoted string", () => {
      expect(strongQuote("it's", "'")).toBe("'it'\\''s'");
    });
    it("wraps in double quotes", () => {
      expect(strongQuote("hello", '"')).toBe('"hello"');
    });
  });

  describe("weakQuote", () => {
    it("wraps in double quotes for bash", () => {
      expect(weakQuote("hello", '"', "bash")).toBe('"hello"');
    });
    it("escapes $ in bash double quotes", () => {
      const result = weakQuote("$HOME", '"', "bash");
      expect(result).toBe('"\\$HOME"');
    });
  });

  describe("quoteString", () => {
    it("returns empty-quoted for empty string", () => {
      expect(quoteString("", "bash")).toBe("''");
    });
    it("returns unquoted simple string", () => {
      expect(quoteString("hello", "bash")).toBe("hello");
    });
    it("quotes string with spaces", () => {
      const result = quoteString("hello world", "bash");
      expect(result).toContain("hello");
      expect(result).toContain("world");
    });
    it("uses escape type when specified", () => {
      const result = quoteString("hello world", "bash", "escape");
      expect(result).toBe("hello\\ world");
    });
    it("uses strong type when specified", () => {
      const result = quoteString("hello world", "bash", "strong");
      expect(result).toBe("'hello world'");
    });
  });

  describe("buildShellCommand", () => {
    it("builds command with arguments", () => {
      const result = buildShellCommand("echo", ["hello", "world"], "bash");
      expect(result).toBe("echo hello world");
    });
    it("quotes arguments with spaces", () => {
      const result = buildShellCommand("echo", ["hello world"], "bash");
      expect(result).toContain("echo");
      expect(result).toContain("hello world");
    });
    it("handles ShellQuotedString args", () => {
      const result = buildShellCommand("echo", [{ value: "hello world", quoting: "strong" as const }], "bash");
      expect(result).toBe("echo 'hello world'");
    });
  });

  describe("parseShellCommand", () => {
    it("splits simple command", () => {
      expect(parseShellCommand("echo hello world", "bash")).toEqual(["echo", "hello", "world"]);
    });
    it("respects single quotes", () => {
      expect(parseShellCommand("echo 'hello world'", "bash")).toEqual(["echo", "hello world"]);
    });
    it("respects double quotes", () => {
      expect(parseShellCommand('echo "hello world"', "bash")).toEqual(["echo", "hello world"]);
    });
    it("handles escaped spaces", () => {
      expect(parseShellCommand("echo hello\\ world", "bash")).toEqual(["echo", "hello world"]);
    });
    it("handles empty input", () => {
      expect(parseShellCommand("", "bash")).toEqual([]);
    });
  });

  describe("getDefaultShell", () => {
    it("returns shell info", () => {
      const result = getDefaultShell();
      expect(result).toHaveProperty("path");
      expect(result).toHaveProperty("type");
    });
  });

  describe("quotePowerShell", () => {
    it("returns empty strong quotes for empty string", () => {
      expect(quotePowerShell("", true)).toBe("''");
    });
    it("returns empty weak quotes for empty string", () => {
      expect(quotePowerShell("", false)).toBe('""');
    });
    it("returns unquoted simple string", () => {
      expect(quotePowerShell("hello")).toBe("hello");
    });
    it("escapes single quotes in strong mode", () => {
      expect(quotePowerShell("it's", true)).toBe("'it''s'");
    });
    it("escapes special chars in weak mode", () => {
      const result = quotePowerShell("$var", false);
      expect(result).toContain("`$var");
    });
  });

  describe("quoteCmd", () => {
    it("returns empty quotes for empty string", () => {
      expect(quoteCmd("")).toBe('""');
    });
    it("returns unquoted simple string", () => {
      expect(quoteCmd("hello")).toBe("hello");
    });
    it("quotes string with spaces", () => {
      expect(quoteCmd("hello world")).toBe('"hello world"');
    });
    it("doubles percent signs", () => {
      expect(quoteCmd("%PATH%")).toBe('"%%PATH%%"');
    });
  });

  describe("escapeRegExp", () => {
    it("escapes regex special characters", () => {
      expect(escapeRegExp("hello.world")).toBe("hello\\.world");
      expect(escapeRegExp("a+b*c?")).toBe("a\\+b\\*c\\?");
      expect(escapeRegExp("[test]")).toBe("\\[test\\]");
    });
  });

  describe("joinCommands", () => {
    it("returns empty for empty array", () => {
      expect(joinCommands([], "bash")).toBe("");
    });
    it("returns single command unchanged", () => {
      expect(joinCommands(["echo hi"], "bash")).toBe("echo hi");
    });
    it("joins with && for and operator", () => {
      expect(joinCommands(["cmd1", "cmd2"], "bash", "and")).toBe("cmd1 && cmd2");
    });
    it("joins with || for or operator", () => {
      expect(joinCommands(["cmd1", "cmd2"], "bash", "or")).toBe("cmd1 || cmd2");
    });
    it("joins with ; for sequence in bash", () => {
      expect(joinCommands(["cmd1", "cmd2"], "bash", "sequence")).toBe("cmd1 ; cmd2");
    });
    it("joins with & for sequence in cmd", () => {
      expect(joinCommands(["cmd1", "cmd2"], "cmd", "sequence")).toBe("cmd1 & cmd2");
    });
  });

  describe("createCdCommand", () => {
    it("creates cd command for bash", () => {
      const result = createCdCommand("/my/path", "make", "bash");
      expect(result).toContain("cd");
      expect(result).toContain("make");
    });
    it("creates cd /d command for cmd", () => {
      const result = createCdCommand("C:\\path", "dir", "cmd");
      expect(result).toContain("cd /d");
    });
  });

  describe("quoteEnvVar", () => {
    it("formats for bash", () => {
      expect(quoteEnvVar("HOME", "bash")).toBe("$HOME");
    });
    it("formats for cmd", () => {
      expect(quoteEnvVar("PATH", "cmd")).toBe("%PATH%");
    });
    it("formats for powershell", () => {
      expect(quoteEnvVar("PATH", "powershell")).toBe("$env:PATH");
    });
    it("formats for fish", () => {
      expect(quoteEnvVar("PATH", "fish")).toBe("$PATH");
    });
  });

  describe("createEnvAssignment", () => {
    it("creates bash assignment", () => {
      expect(createEnvAssignment("VAR", "val", "bash")).toContain("VAR=");
    });
    it("creates bash export", () => {
      expect(createEnvAssignment("VAR", "val", "bash", true)).toContain("export VAR=");
    });
    it("creates cmd set", () => {
      expect(createEnvAssignment("VAR", "val", "cmd")).toBe("set VAR=val");
    });
    it("creates powershell assignment", () => {
      expect(createEnvAssignment("VAR", "val", "powershell")).toContain("$env:VAR");
    });
    it("creates fish set", () => {
      expect(createEnvAssignment("VAR", "val", "fish")).toContain("set VAR");
    });
    it("creates fish export", () => {
      expect(createEnvAssignment("VAR", "val", "fish", true)).toContain("set -x VAR");
    });
  });
});
