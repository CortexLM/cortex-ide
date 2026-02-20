import { createEffect, onCleanup } from "solid-js";
import type * as Monaco from "monaco-editor";
import { useSnippets } from "@/context/SnippetsContext";

interface UseSnippetCompletionsOptions {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  language: string;
}

interface ChoiceWidget {
  element: HTMLDivElement;
  choices: string[];
  selectedIndex: number;
  onSelect: (choice: string) => void;
  dispose: () => void;
}

/**
 * Hook to integrate snippets with Monaco Editor completions.
 * Registers a completion provider that shows snippets in autocomplete.
 * Also handles Tab key for snippet expansion when prefix is typed.
 */
export function useSnippetCompletions(options: UseSnippetCompletionsOptions) {
  const snippets = useSnippets();
  let disposables: Monaco.IDisposable[] = [];
  let completionProviderDisposable: Monaco.IDisposable | null = null;

  createEffect(() => {
    const { editor, monaco, language } = options;
    
    // Clean up previous disposables
    disposables.forEach((d) => d?.dispose?.());
    disposables = [];
    completionProviderDisposable?.dispose?.();
    completionProviderDisposable = null;

    if (!editor || !monaco || !language) return;

    // Register snippet completion provider
    completionProviderDisposable = monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: [],
      provideCompletionItems: (model, position) => {
        const languageSnippets = snippets.getSnippetsForLanguage(language);
        
        // Get the word at current position for filtering
        const wordInfo = model.getWordUntilPosition(position);
        const range: Monaco.IRange = {
          startLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        };

        const suggestions: Monaco.languages.CompletionItem[] = languageSnippets.map(
          (snippet, index) => ({
            label: {
              label: snippet.prefix,
              description: snippet.name,
              detail: snippet.description ? ` - ${snippet.description}` : undefined,
            },
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: snippet.body.join("\n"),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: {
              value: [
                `**${snippet.name}**`,
                "",
                snippet.description || "",
                "",
                "```",
                snippet.body.join("\n"),
                "```",
              ].join("\n"),
            },
            detail: `Snippet`,
            sortText: `!0_snippet_${String(index).padStart(5, "0")}`, // Sort snippets first
            range,
          })
        );

        return { suggestions };
      },
    });

    // Handle Tab key for snippet expansion when not in a snippet session
    const tabKeyBinding = editor.addCommand(
      monaco.KeyCode.Tab,
      () => {
        // If there's an active snippet session, let the default handler work
        if (snippets.isSessionActive()) {
          // Move to next placeholder
          const nextPlaceholder = snippets.nextPlaceholder();
          if (nextPlaceholder) {
            selectPlaceholder(editor, monaco, nextPlaceholder);
          }
          return;
        }

        // Check if cursor is at end of a snippet prefix
        const model = editor.getModel();
        const position = editor.getPosition();
        if (!model || !position) {
          // Fall through to default tab behavior
          editor.trigger("keyboard", "tab", null);
          return;
        }

        // Get the word at cursor
        const wordInfo = model.getWordUntilPosition(position);
        const word = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        if (!word) {
          editor.trigger("keyboard", "tab", null);
          return;
        }

        // Find matching snippet
        const languageSnippets = snippets.getSnippetsForLanguage(language);
        const matchingSnippet = languageSnippets.find((s) => s.prefix === word);

        if (!matchingSnippet) {
          // No matching snippet, do normal tab
          editor.trigger("keyboard", "tab", null);
          return;
        }

        // Expand the snippet
        const expanded = snippets.expandSnippet(matchingSnippet, "", {
          line: position.lineNumber,
          column: wordInfo.startColumn,
        });

        if (!expanded) {
          editor.trigger("keyboard", "tab", null);
          return;
        }

        // Delete the prefix and insert snippet
        const prefixRange: Monaco.IRange = {
          startLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        };

        // Use Monaco's built-in snippet support
        const snippetController = editor.getContribution("snippetController2") as {
          insert: (template: string) => void;
        } | null;

        if (snippetController) {
          // Delete prefix first
          editor.executeEdits("snippet-expansion", [
            {
              range: prefixRange,
              text: "",
            },
          ]);

          // Insert snippet using Monaco's snippet controller
          snippetController.insert(matchingSnippet.body.join("\n"));
        } else {
          // Fallback: manual insertion with placeholder navigation
          editor.executeEdits("snippet-expansion", [
            {
              range: prefixRange,
              text: expanded.text,
            },
          ]);

          // Start snippet session and select first placeholder
          snippets.startSession(expanded.session);
          const firstPlaceholder = expanded.session.parsedSnippet.placeholders[0];
          if (firstPlaceholder) {
            selectPlaceholder(editor, monaco, firstPlaceholder, {
              line: position.lineNumber,
              column: wordInfo.startColumn,
            });
          }
        }
      },
      "!suggestWidgetVisible && !inSnippetMode"
    );

    // Handle Shift+Tab for previous placeholder
    const shiftTabKeyBinding = editor.addCommand(
      monaco.KeyMod.Shift | monaco.KeyCode.Tab,
      () => {
        if (snippets.isSessionActive()) {
          const prevPlaceholder = snippets.previousPlaceholder();
          if (prevPlaceholder) {
            selectPlaceholder(editor, monaco, prevPlaceholder);
          }
        } else {
          editor.trigger("keyboard", "outdent", null);
        }
      },
      "!suggestWidgetVisible && !inSnippetMode"
    );

    // Handle Escape to end snippet session
    const escapeKeyBinding = editor.addCommand(
      monaco.KeyCode.Escape,
      () => {
        if (snippets.isSessionActive()) {
          snippets.endSession();
        }
      },
      "!suggestWidgetVisible && !findWidgetVisible"
    );

    // Store disposables
    if (tabKeyBinding) {
      disposables.push({ dispose: () => {} }); // Command doesn't return disposable
    }
    if (shiftTabKeyBinding) {
      disposables.push({ dispose: () => {} });
    }
    if (escapeKeyBinding) {
      disposables.push({ dispose: () => {} });
    }

    // Listen for snippet session events
    const handleSessionStart = (e: CustomEvent<{
      session: unknown;
      placeholder: { start: number; end: number; defaultValue: string } | null;
    }>) => {
      if (!e.detail) return;
      if (e.detail.placeholder) {
        selectPlaceholder(editor, monaco, e.detail.placeholder);
      }
    };

    const handlePlaceholderChange = (e: CustomEvent<{
      session: unknown;
      placeholder: { start: number; end: number; defaultValue: string };
    }>) => {
      if (!e.detail?.placeholder) return;
      selectPlaceholder(editor, monaco, e.detail.placeholder);
    };

    const handleSessionEnd = () => {
      // Session ended, cursor stays where it is
    };

    window.addEventListener("snippet-session-start", handleSessionStart as EventListener);
    window.addEventListener("snippet-placeholder-change", handlePlaceholderChange as EventListener);
    window.addEventListener("snippet-session-end", handleSessionEnd);

    onCleanup(() => {
      disposables.forEach((d) => d?.dispose?.());
      disposables = [];
      completionProviderDisposable?.dispose?.();
      completionProviderDisposable = null;
      window.removeEventListener("snippet-session-start", handleSessionStart as EventListener);
      window.removeEventListener("snippet-placeholder-change", handlePlaceholderChange as EventListener);
      window.removeEventListener("snippet-session-end", handleSessionEnd);
    });
  });
}

/**
 * Select a placeholder range in the editor
 */
function selectPlaceholder(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  placeholder: { start: number; end: number; defaultValue: string; choices?: string[] },
  startPosition?: { line: number; column: number },
  onChoiceSelect?: (choice: string) => void
) {
  const model = editor.getModel();
  if (!model) return;

  // If we have a start position, calculate absolute position
  let absoluteStart = placeholder.start;
  let absoluteEnd = placeholder.end;

  if (startPosition) {
    // Convert from line/column to offset and add placeholder offset
    const startOffset = model.getOffsetAt({
      lineNumber: startPosition.line,
      column: startPosition.column,
    });
    absoluteStart = startOffset + placeholder.start;
    absoluteEnd = startOffset + placeholder.end;
  }

  // Convert back to position
  const startPos = model.getPositionAt(absoluteStart);
  const endPos = model.getPositionAt(absoluteEnd);

  // Create selection
  const selection = new monaco.Selection(
    startPos.lineNumber,
    startPos.column,
    endPos.lineNumber,
    endPos.column
  );

  editor.setSelection(selection);
  editor.revealLineInCenter(startPos.lineNumber);

  // Show choice widget if this placeholder has choices
  if (placeholder.choices && placeholder.choices.length > 0 && onChoiceSelect) {
    showChoiceWidget(editor, monaco, placeholder.choices, startPos, onChoiceSelect);
  }
}

/**
 * Create and show a choice selection widget for choice placeholders
 */
function showChoiceWidget(
  editor: Monaco.editor.IStandaloneCodeEditor,
  _monaco: typeof Monaco,
  choices: string[],
  position: { lineNumber: number; column: number },
  onSelect: (choice: string) => void
): ChoiceWidget {
  // Create the widget container
  const element = document.createElement("div");
  element.className = "snippet-choice-widget";
  element.style.cssText = `
    position: absolute;
    background: var(--surface-base, #252526);
    border: 1px solid var(--border-base, #454545);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 100;
    max-height: 200px;
    overflow-y: auto;
    min-width: 150px;
  `;

  let selectedIndex = 0;

  const renderChoices = () => {
    element.innerHTML = "";
    choices.forEach((choice, index) => {
      const item = document.createElement("div");
      item.className = "snippet-choice-item";
      item.style.cssText = `
        padding: 6px 10px;
        cursor: pointer;
        font-size: 13px;
        color: var(--text-base, #d4d4d4);
        background: ${index === selectedIndex ? "var(--surface-hover, #2a2d2e)" : "transparent"};
      `;
      item.textContent = choice;
      item.onclick = () => {
        onSelect(choice);
        dispose();
      };
      item.onmouseenter = () => {
        selectedIndex = index;
        renderChoices();
      };
      element.appendChild(item);
    });
  };

  renderChoices();

  // Position the widget below the cursor
  const editorDom = editor.getDomNode();
  if (editorDom) {
    const coords = editor.getScrolledVisiblePosition(position);
    if (coords) {
      element.style.left = `${coords.left}px`;
      element.style.top = `${coords.top + coords.height + 4}px`;
    }
    editorDom.appendChild(element);
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, choices.length - 1);
      renderChoices();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderChoices();
    } else if (e.key === "Enter") {
      e.preventDefault();
      onSelect(choices[selectedIndex]);
      dispose();
    } else if (e.key === "Escape") {
      e.preventDefault();
      dispose();
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  const dispose = () => {
    window.removeEventListener("keydown", handleKeyDown);
    element.remove();
  };

  // Auto-dispose on editor blur
  const blurDisposable = editor.onDidBlurEditorText(() => {
    dispose();
  });

  return {
    element,
    choices,
    selectedIndex,
    onSelect,
    dispose: () => {
      dispose();
      blurDisposable?.dispose?.();
    },
  };
}

/**
 * Update all mirror placeholders with the same value.
 * Exported for use by external snippet session managers.
 */
export function updateMirrorPlaceholders(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  mirrors: Array<{ start: number; end: number }>,
  newValue: string,
  startPosition: { line: number; column: number },
  currentMirrorIndex: number
): void {
  const model = editor.getModel();
  if (!model) return;

  const startOffset = model.getOffsetAt({
    lineNumber: startPosition.line,
    column: startPosition.column,
  });

  // Create edit operations for all mirrors except the current one
  const edits: Monaco.editor.IIdentifiedSingleEditOperation[] = [];
  
  mirrors.forEach((mirror, index) => {
    if (index === currentMirrorIndex) return; // Skip the current one being edited
    
    const mirrorStart = model.getPositionAt(startOffset + mirror.start);
    const mirrorEnd = model.getPositionAt(startOffset + mirror.end);
    
    edits.push({
      range: new monaco.Range(
        mirrorStart.lineNumber,
        mirrorStart.column,
        mirrorEnd.lineNumber,
        mirrorEnd.column
      ),
      text: newValue,
    });
  });

  if (edits.length > 0) {
    editor.executeEdits("snippet-mirror-update", edits);
  }
}

export default useSnippetCompletions;
