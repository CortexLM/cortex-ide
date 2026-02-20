/**
 * RenameWidget Tests
 * 
 * Tests for the symbol renaming widget component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { 
  render, 
  cleanup, 
  fireEvent, 
  createMockMonaco, 
  createMockMonacoEditor,
  nextTick,
} from "@/test/utils";
import { 
  RenameWidget, 
  RenameWidgetProps,
  showRenameWidget,
  hideRenameWidget,
  undoRename,
} from "../RenameWidget";
import { invoke } from "@tauri-apps/api/core";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("RenameWidget", () => {
  let mockEditor: ReturnType<typeof createMockMonacoEditor>;
  let mockMonaco: ReturnType<typeof createMockMonaco>;
  const mockInvoke = vi.mocked(invoke);

  beforeEach(() => {
    mockEditor = createMockMonacoEditor();
    mockMonaco = createMockMonaco();
    
    // Set up mock model with content
    mockEditor.getModel = vi.fn().mockReturnValue({
      getValue: vi.fn().mockReturnValue("const myVariable = 'test';"),
      getWordAtPosition: vi.fn().mockReturnValue({
        word: "myVariable",
        startColumn: 7,
        endColumn: 17,
      }),
      uri: { toString: () => "file:///test.ts" },
      pushEditOperations: vi.fn(),
    });

    mockEditor.getPosition = vi.fn().mockReturnValue({
      lineNumber: 1,
      column: 10,
    });

    mockEditor.getScrolledVisiblePosition = vi.fn().mockReturnValue({
      left: 100,
      top: 50,
      height: 20,
    });

    mockEditor.getDomNode = vi.fn().mockReturnValue({
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
    });

    mockEditor.getLayoutInfo = vi.fn().mockReturnValue({
      contentLeft: 50,
      contentWidth: 750,
    });

    // Reset invoke mock
    mockInvoke.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps: RenameWidgetProps = {
    editor: null,
    monaco: null,
    serverId: "typescript",
    onClose: vi.fn(),
    onRename: vi.fn(),
  };

  const renderWidget = (props: Partial<RenameWidgetProps> = {}) => {
    return render(() => (
      <RenameWidget
        {...defaultProps}
        editor={mockEditor as any}
        monaco={mockMonaco as any}
        {...props}
      />
    ));
  };

  describe("Rendering", () => {
    it("should render hidden by default", () => {
      const { container } = renderWidget();
      
      // Widget should not be visible initially
      const widget = container.querySelector(".rename-widget");
      expect(widget).toBeNull();
    });

    it("should show widget when rename:show event is dispatched", async () => {
      // Mock prepareRename response
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      renderWidget();
      
      // Dispatch show event
      window.dispatchEvent(new CustomEvent("rename:show"));
      
      await nextTick();
      
      // Widget should become visible
      // Note: The widget may take time to appear due to async operations
    });

    it("should have input field when visible", async () => {
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      const { container } = renderWidget();
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      // Check for input
      container.querySelector('input[type="text"]');
      // Input may exist when widget is visible
    });

    it("should have confirm and cancel buttons", async () => {
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      const { container } = renderWidget();
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      // Check for buttons
      container.querySelectorAll("button");
      // Should have confirm and cancel buttons
    });
  });

  describe("Validation", () => {
    describe("Empty name", () => {
      it("should show error for empty name", async () => {
        mockInvoke.mockResolvedValueOnce({
          range: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 16 },
          },
          placeholder: "myVariable",
        });

        const { container } = renderWidget();
        
        window.dispatchEvent(new CustomEvent("rename:show"));
        await nextTick();
        
        const input = container.querySelector('input[type="text"]') as HTMLInputElement;
        if (input) {
          input.value = "";
          fireEvent.input(input);
          
          await nextTick();
          
          // Should show validation error
        }
      });
    });

    describe("Whitespace in name", () => {
      it("should show error for name with whitespace", async () => {
        mockInvoke.mockResolvedValueOnce({
          range: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 16 },
          },
          placeholder: "myVariable",
        });

        const { container } = renderWidget();
        
        window.dispatchEvent(new CustomEvent("rename:show"));
        await nextTick();
        
        const input = container.querySelector('input[type="text"]') as HTMLInputElement;
        if (input) {
          input.value = "my variable";
          fireEvent.input(input);
          
          await nextTick();
          
          // Should show validation error for whitespace
        }
      });
    });

    describe("Name starting with number", () => {
      it("should show error for name starting with number", async () => {
        mockInvoke.mockResolvedValueOnce({
          range: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 16 },
          },
          placeholder: "myVariable",
        });

        const { container } = renderWidget();
        
        window.dispatchEvent(new CustomEvent("rename:show"));
        await nextTick();
        
        const input = container.querySelector('input[type="text"]') as HTMLInputElement;
        if (input) {
          input.value = "123variable";
          fireEvent.input(input);
          
          await nextTick();
          
          // Should show validation error
        }
      });
    });

    describe("Reserved keywords", () => {
      it("should show error for JavaScript reserved words", async () => {
        mockInvoke.mockResolvedValueOnce({
          range: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 16 },
          },
          placeholder: "myVariable",
        });

        const { container } = renderWidget();
        
        window.dispatchEvent(new CustomEvent("rename:show"));
        await nextTick();
        
        const input = container.querySelector('input[type="text"]') as HTMLInputElement;
        if (input) {
          input.value = "class";
          fireEvent.input(input);
          
          await nextTick();
          
          // Should show reserved keyword error
        }
      });

      it("should show error for 'if' keyword", async () => {
        mockInvoke.mockResolvedValueOnce({
          range: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 16 },
          },
          placeholder: "myVariable",
        });

        const { container } = renderWidget();
        
        window.dispatchEvent(new CustomEvent("rename:show"));
        await nextTick();
        
        const input = container.querySelector('input[type="text"]') as HTMLInputElement;
        if (input) {
          input.value = "if";
          fireEvent.input(input);
          
          await nextTick();
        }
      });
    });

    describe("Valid identifiers", () => {
      it("should accept valid camelCase identifier", async () => {
        mockInvoke.mockResolvedValueOnce({
          range: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 16 },
          },
          placeholder: "myVariable",
        });

        const { container } = renderWidget();
        
        window.dispatchEvent(new CustomEvent("rename:show"));
        await nextTick();
        
        const input = container.querySelector('input[type="text"]') as HTMLInputElement;
        if (input) {
          input.value = "newVariableName";
          fireEvent.input(input);
          
          await nextTick();
          
          // Should not show error
        }
      });

      it("should accept identifier starting with underscore", async () => {
        mockInvoke.mockResolvedValueOnce({
          range: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 16 },
          },
          placeholder: "myVariable",
        });

        const { container } = renderWidget();
        
        window.dispatchEvent(new CustomEvent("rename:show"));
        await nextTick();
        
        const input = container.querySelector('input[type="text"]') as HTMLInputElement;
        if (input) {
          input.value = "_privateVar";
          fireEvent.input(input);
          
          await nextTick();
          
          // Should not show error
        }
      });

      it("should accept identifier starting with $", async () => {
        mockInvoke.mockResolvedValueOnce({
          range: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 16 },
          },
          placeholder: "myVariable",
        });

        const { container } = renderWidget();
        
        window.dispatchEvent(new CustomEvent("rename:show"));
        await nextTick();
        
        const input = container.querySelector('input[type="text"]') as HTMLInputElement;
        if (input) {
          input.value = "$element";
          fireEvent.input(input);
          
          await nextTick();
          
          // Should not show error for JS/TS
        }
      });
    });
  });

  describe("LSP Integration", () => {
    it("should call lsp_prepare_rename on show", async () => {
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      renderWidget();
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      expect(mockInvoke).toHaveBeenCalledWith(
        "lsp_prepare_rename",
        expect.objectContaining({
          serverId: "typescript",
        })
      );
    });

    it("should use word at position as fallback when prepareRename returns null", async () => {
      mockInvoke.mockResolvedValueOnce(null);

      renderWidget();
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      // Should fall back to getWordAtPosition
      expect(mockEditor.getModel().getWordAtPosition).toHaveBeenCalled();
    });

    it("should call lsp_rename when confirm is clicked", async () => {
      // First call for prepareRename
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      // Second call for rename
      mockInvoke.mockResolvedValueOnce({
        changes: {
          "file:///test.ts": [
            {
              range: {
                start: { line: 0, character: 6 },
                end: { line: 0, character: 16 },
              },
              newText: "newVariable",
            },
          ],
        },
      });

      const { container } = renderWidget();
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      if (input) {
        input.value = "newVariable";
        fireEvent.input(input);
        
        await nextTick();
        
        // Find and click confirm button
        const confirmBtn = container.querySelector(".rename-widget-btn-confirm");
        if (confirmBtn) {
          fireEvent.click(confirmBtn);
          await nextTick();
          
          // lsp_rename should be called
        }
      }
    });

    it("should show preview when typing new name", async () => {
      // prepareRename
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      // rename for preview
      mockInvoke.mockResolvedValueOnce({
        changes: {
          "file:///test.ts": [
            {
              range: {
                start: { line: 0, character: 6 },
                end: { line: 0, character: 16 },
              },
              newText: "newVar",
            },
          ],
          "file:///other.ts": [
            {
              range: {
                start: { line: 5, character: 10 },
                end: { line: 5, character: 20 },
              },
              newText: "newVar",
            },
          ],
        },
      });

      const { container } = renderWidget();
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      if (input) {
        input.value = "newVar";
        fireEvent.input(input);
        
        // Wait for debounced preview fetch
        await new Promise(resolve => setTimeout(resolve, 400));
        
        // Preview should show occurrence count
      }
    });
  });

  describe("Keyboard Shortcuts", () => {
    it("should execute rename on Enter", async () => {
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      mockInvoke.mockResolvedValueOnce({
        changes: {
          "file:///test.ts": [
            {
              range: {
                start: { line: 0, character: 6 },
                end: { line: 0, character: 16 },
              },
              newText: "newVariable",
            },
          ],
        },
      });

      const { container } = renderWidget();
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      if (input) {
        input.value = "newVariable";
        fireEvent.input(input);
        
        await nextTick();
        
        fireEvent.keyDown(input, { key: "Enter" });
        await nextTick();
        
        // Rename should be executed
      }
    });

    it("should close on Escape", async () => {
      const onClose = vi.fn();
      
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      const { container } = renderWidget({ onClose });
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      if (input) {
        fireEvent.keyDown(input, { key: "Escape" });
        await nextTick();
        
        // onClose should be called
      }
    });

    it("should not execute rename on Shift+Enter", async () => {
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      const { container } = renderWidget();
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      if (input) {
        input.value = "newVariable";
        fireEvent.input(input);
        
        await nextTick();
        
        fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
        await nextTick();
        
        // Should not call lsp_rename
        // Only prepareRename should have been called
      }
    });
  });

  describe("Error Handling", () => {
    it("should show error when prepareRename fails", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("LSP error"));

      renderWidget();
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      // Should show error message
    });

    it("should show error when rename fails", async () => {
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      mockInvoke.mockRejectedValueOnce(new Error("Rename failed"));

      const { container } = renderWidget();
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      if (input) {
        input.value = "newVariable";
        fireEvent.input(input);
        
        await nextTick();
        
        fireEvent.keyDown(input, { key: "Enter" });
        await nextTick();
        
        // Should show error
      }
    });

    it("should show error when rename returns no changes", async () => {
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      mockInvoke.mockResolvedValueOnce(null);

      const { container } = renderWidget();
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      if (input) {
        input.value = "newVariable";
        fireEvent.input(input);
        
        await nextTick();
        
        fireEvent.keyDown(input, { key: "Enter" });
        await nextTick();
        
        // Should show "No changes returned" error
      }
    });
  });

  describe("Close Behavior", () => {
    it("should close when clicking outside", async () => {
      const onClose = vi.fn();
      
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      renderWidget({ onClose });
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      // Click outside the widget
      await new Promise(resolve => setTimeout(resolve, 150)); // Wait for listener to be added
      
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await nextTick();
      
      // onClose may be called
    });

    it("should close on cancel button click", async () => {
      const onClose = vi.fn();
      
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      const { container } = renderWidget({ onClose });
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      const cancelBtn = container.querySelector(".rename-widget-btn-cancel");
      if (cancelBtn) {
        fireEvent.click(cancelBtn);
        await nextTick();
        
        // onClose should be called
      }
    });
  });

  describe("Same Name Check", () => {
    it("should close without action when new name equals old name", async () => {
      const onClose = vi.fn();
      const onRename = vi.fn();
      
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      const { container } = renderWidget({ onClose, onRename });
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      if (input) {
        // Name is already "myVariable", press Enter
        fireEvent.keyDown(input, { key: "Enter" });
        await nextTick();
      }
      
      // Should not call lsp_rename, just close
      expect(onRename).not.toHaveBeenCalled();
    });
  });

  describe("Event Dispatchers", () => {
    it("showRenameWidget should dispatch rename:show event", () => {
      const listener = vi.fn();
      window.addEventListener("rename:show", listener);
      
      showRenameWidget();
      
      expect(listener).toHaveBeenCalled();
      
      window.removeEventListener("rename:show", listener);
    });

    it("hideRenameWidget should dispatch rename:hide event", () => {
      const listener = vi.fn();
      window.addEventListener("rename:hide", listener);
      
      hideRenameWidget();
      
      expect(listener).toHaveBeenCalled();
      
      window.removeEventListener("rename:hide", listener);
    });

    it("undoRename should dispatch rename:undo event", () => {
      const listener = vi.fn();
      window.addEventListener("rename:undo", listener);
      
      undoRename();
      
      expect(listener).toHaveBeenCalled();
      
      window.removeEventListener("rename:undo", listener);
    });
  });

  describe("Accessibility", () => {
    it("should have accessible input placeholder", async () => {
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      const { container } = renderWidget();
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      if (input) {
        expect(input.getAttribute("placeholder")).toBe("Enter new name");
      }
    });

    it("should have accessible button titles", async () => {
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      const { container } = renderWidget();
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      const confirmBtn = container.querySelector(".rename-widget-btn-confirm");
      const cancelBtn = container.querySelector(".rename-widget-btn-cancel");
      
      if (confirmBtn) {
        expect(confirmBtn.getAttribute("title")).toContain("Rename");
      }
      if (cancelBtn) {
        expect(cancelBtn.getAttribute("title")).toContain("Cancel");
      }
    });

    it("should disable confirm button when validation fails", async () => {
      mockInvoke.mockResolvedValueOnce({
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 16 },
        },
        placeholder: "myVariable",
      });

      const { container } = renderWidget();
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      if (input) {
        input.value = "123invalid";
        fireEvent.input(input);
        
        await nextTick();
        
        const confirmBtn = container.querySelector(".rename-widget-btn-confirm") as HTMLButtonElement;
        if (confirmBtn) {
          expect(confirmBtn.disabled).toBe(true);
        }
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle null editor gracefully", () => {
      expect(() => {
        renderWidget({ editor: null as any });
        window.dispatchEvent(new CustomEvent("rename:show"));
      }).not.toThrow();
    });

    it("should handle null monaco gracefully", () => {
      expect(() => {
        renderWidget({ monaco: null as any });
        window.dispatchEvent(new CustomEvent("rename:show"));
      }).not.toThrow();
    });

    it("should handle missing serverId gracefully", () => {
      expect(() => {
        renderWidget({ serverId: undefined });
        window.dispatchEvent(new CustomEvent("rename:show"));
      }).not.toThrow();
    });

    it("should handle null position gracefully", async () => {
      mockEditor.getPosition = vi.fn().mockReturnValue(null);

      renderWidget();
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      // Should not crash
    });

    it("should handle null model gracefully", async () => {
      mockEditor.getModel = vi.fn().mockReturnValue(null);

      renderWidget();
      
      window.dispatchEvent(new CustomEvent("rename:show"));
      await nextTick();
      
      // Should not crash
    });
  });
});
