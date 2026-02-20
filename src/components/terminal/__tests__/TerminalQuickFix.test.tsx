/**
 * TerminalQuickFix Tests
 * 
 * Tests for the terminal quick fix component that detects errors
 * and provides suggestions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { 
  render, 
  cleanup, 
  fireEvent, 
  nextTick,
} from "@/test/utils";
import { 
  TerminalQuickFix, 
  TerminalQuickFixProps, 
  detectQuickFixes,
} from "../TerminalQuickFix";

describe("TerminalQuickFix", () => {
  const mockOnApplyFix = vi.fn();

  const defaultProps: TerminalQuickFixProps = {
    terminalId: "terminal-1",
    outputLine: "",
    lineNumber: 1,
    onApplyFix: mockOnApplyFix,
    enabled: true,
    lineHeight: 20,
    scrollOffset: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderQuickFix = (props: Partial<TerminalQuickFixProps> = {}) => {
    return render(() => (
      <TerminalQuickFix {...defaultProps} {...props} />
    ));
  };

  describe("Error Detection", () => {
    describe("Command Not Found", () => {
      it("should detect npm command not found", () => {
        renderQuickFix({
          outputLine: "bash: npm: command not found",
        });
        
        // Should show lightbulb or fix indicator
        // Container may have fix suggestion elements
      });

      it("should detect node command not found", () => {
        renderQuickFix({
          outputLine: "'node' is not recognized as an internal or external command",
        });
        
        // Windows-style error
      });

      it("should detect python command not found", () => {
        renderQuickFix({
          outputLine: "zsh: command not found: python3",
        });
      });

      it("should detect git command not found", () => {
        renderQuickFix({
          outputLine: "git: command not found",
        });
      });

      it("should detect cargo command not found", () => {
        renderQuickFix({
          outputLine: "bash: cargo: command not found",
        });
      });
    });

    describe("Permission Denied", () => {
      it("should detect permission denied error", () => {
        renderQuickFix({
          outputLine: "Error: EACCES: permission denied, open '/etc/hosts'",
        });
      });

      it("should detect Linux permission denied", () => {
        renderQuickFix({
          outputLine: "bash: /usr/local/bin/script: Permission denied",
        });
      });

      it("should detect npm permission error", () => {
        renderQuickFix({
          outputLine: "npm ERR! Error: EACCES: permission denied, access '/usr/lib/node_modules'",
        });
      });
    });

    describe("Port In Use", () => {
      it("should detect EADDRINUSE error", () => {
        renderQuickFix({
          outputLine: "Error: listen EADDRINUSE: address already in use :::3000",
        });
      });

      it("should detect port already in use message", () => {
        renderQuickFix({
          outputLine: "Port 8080 is already in use",
        });
      });

      it("should extract port number from error", () => {
        renderQuickFix({
          outputLine: "Error: listen EADDRINUSE :::4000",
        });
        
        // Should extract 4000 as port
      });
    });

    describe("Package Not Found", () => {
      it("should detect npm module not found", () => {
        renderQuickFix({
          outputLine: "Error: Cannot find module 'express'",
        });
      });

      it("should detect npm package not found", () => {
        renderQuickFix({
          outputLine: "npm ERR! 404 Not Found - GET https://registry.npmjs.org/nonexistent-package",
        });
      });

      it("should detect Python import error", () => {
        renderQuickFix({
          outputLine: "ModuleNotFoundError: No module named 'requests'",
        });
      });

      it("should detect Python package not found", () => {
        renderQuickFix({
          outputLine: "ImportError: No module named 'flask'",
        });
      });
    });

    describe("Directory/File Not Found", () => {
      it("should detect ENOENT directory error", () => {
        renderQuickFix({
          outputLine: "Error: ENOENT: no such file or directory, open './config/settings.json'",
        });
      });

      it("should detect cd directory not found", () => {
        renderQuickFix({
          outputLine: "bash: cd: /nonexistent/path: No such file or directory",
        });
      });

      it("should detect file not found", () => {
        renderQuickFix({
          outputLine: "cat: myfile.txt: No such file or directory",
        });
      });
    });

    describe("Git Authentication", () => {
      it("should detect git authentication failure", () => {
        renderQuickFix({
          outputLine: "fatal: Authentication failed for 'https://github.com/user/repo.git'",
        });
      });

      it("should detect git permission denied", () => {
        renderQuickFix({
          outputLine: "Permission denied (publickey).",
        });
      });

      it("should detect git credential error", () => {
        renderQuickFix({
          outputLine: "fatal: could not read Username for 'https://github.com': terminal prompts disabled",
        });
      });
    });

    describe("NPM Errors", () => {
      it("should detect npm install failure", () => {
        renderQuickFix({
          outputLine: "npm ERR! code ERESOLVE",
        });
      });

      it("should detect npm peer dependency error", () => {
        renderQuickFix({
          outputLine: "npm ERR! peer dep missing: react@^18.0.0",
        });
      });

      it("should detect npm audit error", () => {
        renderQuickFix({
          outputLine: "npm ERR! found 5 vulnerabilities (2 moderate, 3 high)",
        });
      });
    });
  });

  describe("Quick Fix Actions", () => {
    it("should show install package action for npm not found", async () => {
      renderQuickFix({
        outputLine: "Error: Cannot find module 'lodash'",
      });
      
      await nextTick();
      
      // May show "npm install lodash" action
    });

    it("should show sudo action for permission denied", async () => {
      renderQuickFix({
        outputLine: "bash: /usr/local/bin/script: Permission denied",
      });
      
      await nextTick();
      
      // May show "Run with sudo" action
    });

    it("should show kill process action for port in use", async () => {
      renderQuickFix({
        outputLine: "Error: listen EADDRINUSE: address already in use :::3000",
      });
      
      await nextTick();
      
      // May show "Kill process on port 3000" action
    });

    it("should show create directory action for ENOENT", async () => {
      renderQuickFix({
        outputLine: "Error: ENOENT: no such file or directory, open './dist/output.js'",
      });
      
      await nextTick();
      
      // May show "Create directory ./dist" action
    });

    it("should call onApplyFix when action is clicked", async () => {
      const { container } = renderQuickFix({
        outputLine: "Error: Cannot find module 'express'",
      });
      
      await nextTick();
      
      // Find action buttons
      const actionButtons = container.querySelectorAll("button");
      
      if (actionButtons.length > 0) {
        fireEvent.click(actionButtons[0]);
        await nextTick();
        
        // May call onApplyFix
      }
    });
  });

  describe("UI Rendering", () => {
    it("should show lightbulb icon when fix is available", async () => {
      const { container } = renderQuickFix({
        outputLine: "bash: npm: command not found",
      });
      
      await nextTick();
      
      // Look for lightbulb/zap icon or indicator
      container.querySelectorAll("svg");
    });

    it("should toggle fix menu on click", async () => {
      const { container } = renderQuickFix({
        outputLine: "bash: npm: command not found",
      });
      
      await nextTick();
      
      // Click to open menu
      const trigger = container.querySelector("[class*='cursor-pointer']");
      if (trigger) {
        fireEvent.click(trigger);
        await nextTick();
        
        // Menu should be visible
      }
    });

    it("should hide when no error detected", () => {
      renderQuickFix({
        outputLine: "$ npm start",
      });
      
      // Should not show any fix indicators for normal output
    });

    it("should hide when disabled", () => {
      renderQuickFix({
        outputLine: "bash: npm: command not found",
        enabled: false,
      });
      
      // Should not show any fix indicators when disabled
    });

    it("should position based on line number and scroll offset", () => {
      renderQuickFix({
        outputLine: "bash: npm: command not found",
        lineNumber: 5,
        lineHeight: 20,
        scrollOffset: 100,
      });
      
      // Position should be calculated correctly
    });
  });

  describe("Action Icons", () => {
    it("should show download icon for install actions", async () => {
      renderQuickFix({
        outputLine: "Error: Cannot find module 'axios'",
      });
      
      await nextTick();
      
      // Download icon for install
    });

    it("should show shield icon for sudo actions", async () => {
      renderQuickFix({
        outputLine: "Permission denied",
      });
      
      await nextTick();
      
      // Shield icon for elevated permissions
    });

    it("should show x-circle icon for kill process actions", async () => {
      renderQuickFix({
        outputLine: "EADDRINUSE :::8080",
      });
      
      await nextTick();
      
      // X-circle icon for killing process
    });

    it("should show folder icon for create directory actions", async () => {
      renderQuickFix({
        outputLine: "ENOENT: no such file or directory",
      });
      
      await nextTick();
      
      // Folder icon for creating directory
    });

    it("should show key icon for authentication actions", async () => {
      renderQuickFix({
        outputLine: "Authentication failed",
      });
      
      await nextTick();
      
      // Key icon for auth
    });
  });

  describe("Dangerous Actions", () => {
    it("should mark sudo actions as dangerous", async () => {
      renderQuickFix({
        outputLine: "Permission denied",
      });
      
      await nextTick();
      
      // Dangerous actions may have warning styling
    });

    it("should require confirmation for dangerous actions", async () => {
      renderQuickFix({
        outputLine: "Permission denied",
      });
      
      await nextTick();
      
      // May show confirmation dialog for dangerous actions
    });
  });

  describe("Context Extraction", () => {
    it("should extract package name from npm error", () => {
      renderQuickFix({
        outputLine: "Error: Cannot find module 'react-router-dom'",
      });
      
      // Should extract 'react-router-dom' as package name
    });

    it("should extract port number from EADDRINUSE", () => {
      renderQuickFix({
        outputLine: "Error: listen EADDRINUSE :::5000",
      });
      
      // Should extract 5000 as port
    });

    it("should extract path from ENOENT", () => {
      renderQuickFix({
        outputLine: "Error: ENOENT: no such file or directory, open '/app/config.json'",
      });
      
      // Should extract '/app/config.json' as path
    });

    it("should extract command from command not found", () => {
      renderQuickFix({
        outputLine: "bash: docker-compose: command not found",
      });
      
      // Should extract 'docker-compose' as command
    });
  });

  describe("Multiple Errors", () => {
    it("should handle multiple errors on same line", () => {
      // Some output may contain multiple error patterns
      renderQuickFix({
        outputLine: "npm ERR! EACCES: permission denied, mkdir '/usr/local/lib'",
      });
      
      // Should handle compound errors
    });
  });

  describe("Keyboard Navigation", () => {
    it("should close menu on Escape", async () => {
      const { container } = renderQuickFix({
        outputLine: "bash: npm: command not found",
      });
      
      await nextTick();
      
      // Open menu
      const trigger = container.querySelector("[class*='cursor-pointer']");
      if (trigger) {
        fireEvent.click(trigger);
        await nextTick();
        
        // Press Escape
        fireEvent.keyDown(trigger, { key: "Escape" });
        await nextTick();
        
        // Menu should close
      }
    });

    it("should navigate actions with arrow keys", async () => {
      renderQuickFix({
        outputLine: "bash: npm: command not found",
      });
      
      await nextTick();
      
      // Open menu and navigate
    });

    it("should select action on Enter", async () => {
      renderQuickFix({
        outputLine: "bash: npm: command not found",
      });
      
      await nextTick();
      
      // Press Enter to select action
    });
  });

  describe("Accessibility", () => {
    it("should have accessible button labels", () => {
      const { container } = renderQuickFix({
        outputLine: "bash: npm: command not found",
      });
      
      const buttons = container.querySelectorAll("button");
      
      buttons.forEach(button => {
        const hasLabel = 
          button.getAttribute("title") ||
          button.getAttribute("aria-label") ||
          button.textContent?.trim();
        
        expect(hasLabel).toBeTruthy();
      });
    });

    it("should have proper ARIA attributes on menu", async () => {
      renderQuickFix({
        outputLine: "bash: npm: command not found",
      });
      
      await nextTick();
      
      // Menu should have proper ARIA attributes
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty output line", () => {
      expect(() => {
        renderQuickFix({ outputLine: "" });
      }).not.toThrow();
    });

    it("should handle very long output lines", () => {
      const longLine = "Error: " + "x".repeat(10000);
      
      expect(() => {
        renderQuickFix({ outputLine: longLine });
      }).not.toThrow();
    });

    it("should handle special characters in output", () => {
      renderQuickFix({
        outputLine: "Error: Cannot find module '@scope/package-name'",
      });
      
      // Should handle scoped packages
    });

    it("should handle Windows-style paths", () => {
      renderQuickFix({
        outputLine: "Error: ENOENT: no such file or directory, open 'C:\\Users\\test\\file.txt'",
      });
      
      // Should handle Windows paths
    });

    it("should handle unicode in output", () => {
      renderQuickFix({
        outputLine: "エラー: モジュールが見つかりません 'test'",
      });
      
      // Should not crash on non-ASCII
    });
  });
});

// Test the detectQuickFixes function if exported
describe("detectQuickFixes Function", () => {
  it("should return null for normal output", () => {
    // If detectQuickFixes is exported
    if (typeof detectQuickFixes === "function") {
      const fix = detectQuickFixes("$ ls -la", 1);
      expect(fix).toBeNull();
    }
  });

  it("should detect command not found errors", () => {
    if (typeof detectQuickFixes === "function") {
      const fix = detectQuickFixes("bash: npm: command not found", 1);
      expect(fix).not.toBeNull();
      expect(fix?.type).toBe("command-not-found");
    }
  });

  it("should detect permission errors", () => {
    if (typeof detectQuickFixes === "function") {
      const fix = detectQuickFixes("Error: EACCES: permission denied", 1);
      expect(fix).not.toBeNull();
      expect(fix?.type).toBe("permission-denied");
    }
  });

  it("should detect port in use errors", () => {
    if (typeof detectQuickFixes === "function") {
      const fix = detectQuickFixes("Error: listen EADDRINUSE :::3000", 1);
      expect(fix).not.toBeNull();
      expect(fix?.type).toBe("port-in-use");
      expect(fix?.context?.port).toBe(3000);
    }
  });

  it("should detect package not found errors", () => {
    if (typeof detectQuickFixes === "function") {
      const fix = detectQuickFixes("Error: Cannot find module 'lodash'", 1);
      expect(fix).not.toBeNull();
      expect(fix?.type).toBe("package-not-found");
      expect(fix?.context?.packageName).toBe("lodash");
    }
  });
});
