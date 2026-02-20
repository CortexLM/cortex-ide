import { Show, For, createSignal, createMemo, createEffect, onCleanup, JSX } from "solid-js";
import { Icon } from '../ui/Icon';

// ============================================================================
// When Clause Types
// ============================================================================

/** Parsed when clause expression (AST node) */
export interface WhenExpression {
  type: "and" | "or" | "not" | "comparison" | "key" | "literal";
  operator?: "==" | "!=" | "=~" | ">" | "<" | ">=" | "<=" | "in";
  left?: WhenExpression;
  right?: WhenExpression;
  value?: string | number | boolean;
  key?: string;
  children?: WhenExpression[];
}

/** When clause with raw string and optional parsed AST */
export interface WhenClause {
  raw: string;
  parsed?: WhenExpression;
  isValid: boolean;
  error?: string;
}

// ============================================================================
// Context Keys - Available for autocomplete
// ============================================================================

/** Context key category with keys and descriptions */
export interface ContextKeyCategory {
  name: string;
  keys: ContextKeyInfo[];
}

/** Individual context key info for autocomplete */
export interface ContextKeyInfo {
  key: string;
  description: string;
  type: "boolean" | "string" | "number";
  examples?: string[];
}

/** All available context keys for when clause autocomplete */
export const CONTEXT_KEY_CATEGORIES: ContextKeyCategory[] = [
  {
    name: "Editor",
    keys: [
      { key: "editorTextFocus", description: "Editor text has keyboard focus", type: "boolean" },
      { key: "editorHasSelection", description: "Text is selected in editor", type: "boolean" },
      { key: "editorReadonly", description: "Editor is read-only", type: "boolean" },
      { key: "editorLangId", description: "Language ID of active editor", type: "string", examples: ["typescript", "javascript", "python"] },
      { key: "editorHasMultipleSelections", description: "Multiple cursors active", type: "boolean" },
      { key: "editorTabMovesFocus", description: "Tab key moves focus instead of inserting tab", type: "boolean" },
      { key: "editorHasCompletionItemProvider", description: "Editor has completion provider", type: "boolean" },
      { key: "editorHasDefinitionProvider", description: "Editor has definition provider", type: "boolean" },
      { key: "editorHasReferenceProvider", description: "Editor has reference provider", type: "boolean" },
      { key: "editorHasRenameProvider", description: "Editor has rename provider", type: "boolean" },
    ],
  },
  {
    name: "Views",
    keys: [
      { key: "sideBarVisible", description: "Sidebar is visible", type: "boolean" },
      { key: "panelVisible", description: "Panel is visible", type: "boolean" },
      { key: "activeViewlet", description: "ID of active viewlet", type: "string", examples: ["workbench.view.explorer", "workbench.view.search"] },
      { key: "activePanel", description: "ID of active panel", type: "string", examples: ["workbench.panel.terminal", "workbench.panel.output"] },
      { key: "auxiliaryBarVisible", description: "Auxiliary bar is visible", type: "boolean" },
      { key: "sideBarFocus", description: "Sidebar has focus", type: "boolean" },
      { key: "panelFocus", description: "Panel has focus", type: "boolean" },
    ],
  },
  {
    name: "Debug",
    keys: [
      { key: "debuggingActive", description: "Debug session is active", type: "boolean" },
      { key: "inDebugMode", description: "Currently debugging", type: "boolean" },
      { key: "debugState", description: "Current debug state", type: "string", examples: ["inactive", "running", "stopped"] },
      { key: "debugType", description: "Type of debug adapter", type: "string" },
      { key: "callStackItemType", description: "Type of selected call stack item", type: "string" },
    ],
  },
  {
    name: "Terminal",
    keys: [
      { key: "terminalFocus", description: "Terminal has keyboard focus", type: "boolean" },
      { key: "terminalIsOpen", description: "A terminal is open", type: "boolean" },
      { key: "terminalProcessSupported", description: "Terminal process supported", type: "boolean" },
      { key: "terminalCount", description: "Number of open terminals", type: "number" },
    ],
  },
  {
    name: "Files & Resources",
    keys: [
      { key: "resourceExtname", description: "File extension", type: "string", examples: [".ts", ".js", ".py"] },
      { key: "resourceFilename", description: "File name", type: "string" },
      { key: "resourceScheme", description: "Resource scheme", type: "string", examples: ["file", "untitled", "git"] },
      { key: "resourceDirname", description: "Directory path", type: "string" },
      { key: "resourcePath", description: "Full file path", type: "string" },
      { key: "resourceLangId", description: "Language ID of resource", type: "string" },
    ],
  },
  {
    name: "General",
    keys: [
      { key: "isWindows", description: "Running on Windows", type: "boolean" },
      { key: "isMac", description: "Running on macOS", type: "boolean" },
      { key: "isLinux", description: "Running on Linux", type: "boolean" },
      { key: "inputFocus", description: "An input field has focus", type: "boolean" },
      { key: "textInputFocus", description: "Text input has focus", type: "boolean" },
      { key: "inQuickOpen", description: "Quick open is visible", type: "boolean" },
      { key: "inCommandPalette", description: "Command palette is visible", type: "boolean" },
    ],
  },
  {
    name: "SCM / Git",
    keys: [
      { key: "scmProvider", description: "SCM provider ID", type: "string", examples: ["git"] },
      { key: "gitOpenRepositoryCount", description: "Number of open git repos", type: "number" },
      { key: "scmResourceGroup", description: "Active SCM resource group", type: "string" },
    ],
  },
  {
    name: "Lists & Trees",
    keys: [
      { key: "listFocus", description: "A list has focus", type: "boolean" },
      { key: "listHasSelectionOrFocus", description: "List has selection or focus", type: "boolean" },
      { key: "listDoubleSelection", description: "Two items selected", type: "boolean" },
      { key: "listMultiSelection", description: "Multiple items selected", type: "boolean" },
      { key: "treeElementCanCollapse", description: "Tree element can collapse", type: "boolean" },
      { key: "treeElementCanExpand", description: "Tree element can expand", type: "boolean" },
    ],
  },
  {
    name: "Widgets",
    keys: [
      { key: "suggestWidgetVisible", description: "Autocomplete widget visible", type: "boolean" },
      { key: "suggestWidgetMultipleSuggestions", description: "Multiple suggestions available", type: "boolean" },
      { key: "parameterHintsVisible", description: "Parameter hints visible", type: "boolean" },
      { key: "renameInputVisible", description: "Rename input visible", type: "boolean" },
      { key: "findWidgetVisible", description: "Find widget visible", type: "boolean" },
      { key: "replaceInputFocussed", description: "Replace input has focus", type: "boolean" },
    ],
  },
  {
    name: "Config Access",
    keys: [
      { key: "config.editor.minimap.enabled", description: "Minimap enabled setting", type: "boolean" },
      { key: "config.editor.wordWrap", description: "Word wrap setting", type: "string" },
      { key: "config.editor.fontSize", description: "Editor font size", type: "number" },
    ],
  },
];

/** Flat list of all context keys */
export const ALL_CONTEXT_KEYS: ContextKeyInfo[] = CONTEXT_KEY_CATEGORIES.flatMap(cat => cat.keys);

/** All context key names for quick lookup */
export const CONTEXT_KEY_NAMES: string[] = ALL_CONTEXT_KEYS.map(k => k.key);

/** When clause operators */
export const WHEN_OPERATORS = ["&&", "||", "!", "==", "!=", "=~", ">", "<", ">=", "<=", "in"] as const;

// ============================================================================
// When Clause Parsing & Validation
// ============================================================================

/** Tokenize a when clause string */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const nextChar = input[i + 1];

    // Handle strings
    if ((char === "'" || char === '"') && !inString) {
      inString = true;
      stringChar = char;
      current += char;
      continue;
    }
    if (char === stringChar && inString) {
      inString = false;
      current += char;
      tokens.push(current);
      current = "";
      continue;
    }
    if (inString) {
      current += char;
      continue;
    }

    // Handle operators
    if (char === "&" && nextChar === "&") {
      if (current.trim()) tokens.push(current.trim());
      current = "";
      tokens.push("&&");
      i++;
      continue;
    }
    if (char === "|" && nextChar === "|") {
      if (current.trim()) tokens.push(current.trim());
      current = "";
      tokens.push("||");
      i++;
      continue;
    }
    if (char === "=" && nextChar === "=") {
      if (current.trim()) tokens.push(current.trim());
      current = "";
      tokens.push("==");
      i++;
      continue;
    }
    if (char === "!" && nextChar === "=") {
      if (current.trim()) tokens.push(current.trim());
      current = "";
      tokens.push("!=");
      i++;
      continue;
    }
    if (char === "=" && nextChar === "~") {
      if (current.trim()) tokens.push(current.trim());
      current = "";
      tokens.push("=~");
      i++;
      continue;
    }
    if (char === ">" && nextChar === "=") {
      if (current.trim()) tokens.push(current.trim());
      current = "";
      tokens.push(">=");
      i++;
      continue;
    }
    if (char === "<" && nextChar === "=") {
      if (current.trim()) tokens.push(current.trim());
      current = "";
      tokens.push("<=");
      i++;
      continue;
    }
    if (char === ">" || char === "<") {
      if (current.trim()) tokens.push(current.trim());
      current = "";
      tokens.push(char);
      continue;
    }
    if (char === "!") {
      if (current.trim()) tokens.push(current.trim());
      current = "";
      tokens.push("!");
      continue;
    }
    if (char === "(" || char === ")") {
      if (current.trim()) tokens.push(current.trim());
      current = "";
      tokens.push(char);
      continue;
    }

    // Handle whitespace
    if (/\s/.test(char)) {
      if (current.trim()) {
        // Check for "in" operator
        if (current.trim().toLowerCase() === "in") {
          tokens.push("in");
        } else {
          tokens.push(current.trim());
        }
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    if (current.trim().toLowerCase() === "in") {
      tokens.push("in");
    } else {
      tokens.push(current.trim());
    }
  }

  return tokens;
}

/** Validate a when clause string */
export function validateWhenClause(when: string): { isValid: boolean; error?: string } {
  if (!when || when.trim() === "") {
    return { isValid: true };
  }

  try {
    const tokens = tokenize(when);
    
    // Check for balanced parentheses
    let parenCount = 0;
    for (const token of tokens) {
      if (token === "(") parenCount++;
      if (token === ")") parenCount--;
      if (parenCount < 0) {
        return { isValid: false, error: "Unmatched closing parenthesis" };
      }
    }
    if (parenCount !== 0) {
      return { isValid: false, error: "Unmatched opening parenthesis" };
    }

    // Check for empty expressions
    if (tokens.length === 0) {
      return { isValid: true };
    }

    // Check for consecutive operators
    const operators = ["&&", "||", "==", "!=", "=~", ">", "<", ">=", "<=", "in"];
    for (let i = 0; i < tokens.length - 1; i++) {
      if (operators.includes(tokens[i]) && operators.includes(tokens[i + 1])) {
        return { isValid: false, error: `Consecutive operators: ${tokens[i]} ${tokens[i + 1]}` };
      }
    }

    // Check for operators at start/end (except !)
    const binaryOps = ["&&", "||", "==", "!=", "=~", ">", "<", ">=", "<=", "in"];
    if (binaryOps.includes(tokens[0])) {
      return { isValid: false, error: `Expression cannot start with operator: ${tokens[0]}` };
    }
    if (binaryOps.includes(tokens[tokens.length - 1])) {
      return { isValid: false, error: `Expression cannot end with operator: ${tokens[tokens.length - 1]}` };
    }

    return { isValid: true };
  } catch (e) {
    return { isValid: false, error: e instanceof Error ? e.message : "Invalid expression" };
  }
}

/** Parse a when clause into an AST */
export function parseWhenClause(when: string): WhenClause {
  const validation = validateWhenClause(when);
  if (!validation.isValid) {
    return { raw: when, isValid: false, error: validation.error };
  }

  // For now, we just validate - full AST parsing can be added later
  return { raw: when, isValid: true };
}

// ============================================================================
// When Clause Input Props
// ============================================================================

export interface WhenClauseInputProps {
  /** Current when clause value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Optional validation callback */
  onValidate?: (isValid: boolean) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional class names */
  class?: string;
}

// ============================================================================
// When Clause Input Component
// ============================================================================

/** Input component for editing when clause expressions with autocomplete */
export function WhenClauseInput(props: WhenClauseInputProps) {
  let inputRef: HTMLInputElement | undefined;
  const [isFocused, setIsFocused] = createSignal(false);
  const [showAutocomplete, setShowAutocomplete] = createSignal(false);
  const [autocompleteIndex, setAutocompleteIndex] = createSignal(0);
  const [showExamples, setShowExamples] = createSignal(false);
  const [cursorPosition, setCursorPosition] = createSignal(0);

  // Validation state
  const validation = createMemo(() => validateWhenClause(props.value));

  // Notify parent of validation state
  createEffect(() => {
    props.onValidate?.(validation().isValid);
  });

  // Get current word at cursor for autocomplete
  const currentWord = createMemo(() => {
    const value = props.value;
    const pos = cursorPosition();
    
    // Find word boundaries
    let start = pos;
    let end = pos;
    
    while (start > 0 && /[\w.]/.test(value[start - 1])) {
      start--;
    }
    while (end < value.length && /[\w.]/.test(value[end])) {
      end++;
    }
    
    return {
      word: value.slice(start, end),
      start,
      end,
    };
  });

  // Filter context keys based on current word
  const filteredKeys = createMemo(() => {
    const word = currentWord().word.toLowerCase();
    if (!word) return ALL_CONTEXT_KEYS.slice(0, 10);
    
    return ALL_CONTEXT_KEYS.filter(k => 
      k.key.toLowerCase().includes(word) ||
      k.description.toLowerCase().includes(word)
    ).slice(0, 15);
  });

  // Handle input changes
  const handleInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (e) => {
    const newValue = e.currentTarget.value;
    props.onChange(newValue);
    setCursorPosition(e.currentTarget.selectionStart ?? 0);
    setShowAutocomplete(true);
    setAutocompleteIndex(0);
  };

  // Handle cursor position changes
  const handleSelect: JSX.EventHandler<HTMLInputElement, Event> = (e) => {
    setCursorPosition(e.currentTarget.selectionStart ?? 0);
  };

  // Handle autocomplete selection
  const selectAutocompleteItem = (key: string) => {
    const { start, end } = currentWord();
    const before = props.value.slice(0, start);
    const after = props.value.slice(end);
    const newValue = before + key + after;
    props.onChange(newValue);
    setShowAutocomplete(false);
    
    // Focus input and set cursor position
    requestAnimationFrame(() => {
      if (inputRef) {
        inputRef.focus();
        const newPos = start + key.length;
        inputRef.setSelectionRange(newPos, newPos);
        setCursorPosition(newPos);
      }
    });
  };

  // Handle keyboard navigation
  const handleKeyDown: JSX.EventHandler<HTMLInputElement, KeyboardEvent> = (e) => {
    if (!showAutocomplete() || filteredKeys().length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setAutocompleteIndex(i => Math.min(i + 1, filteredKeys().length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setAutocompleteIndex(i => Math.max(i - 1, 0));
        break;
      case "Enter":
      case "Tab":
        if (showAutocomplete() && filteredKeys().length > 0) {
          e.preventDefault();
          selectAutocompleteItem(filteredKeys()[autocompleteIndex()].key);
        }
        break;
      case "Escape":
        setShowAutocomplete(false);
        break;
    }
  };

  // Close autocomplete when clicking outside
  createEffect(() => {
    if (!isFocused()) {
      // Delay to allow click on autocomplete item
      const timeout = setTimeout(() => setShowAutocomplete(false), 200);
      onCleanup(() => clearTimeout(timeout));
    }
  });

  // Example when clauses
  const examples = [
    { expr: "editorTextFocus", desc: "When editor has focus" },
    { expr: "editorTextFocus && !editorReadonly", desc: "Editor focused and not read-only" },
    { expr: "editorLangId == 'typescript'", desc: "When editing TypeScript" },
    { expr: "debuggingActive && editorTextFocus", desc: "During debug with editor focus" },
    { expr: "terminalFocus || panelFocus", desc: "Terminal or panel has focus" },
    { expr: "resourceExtname =~ /\\.(ts|tsx)$/", desc: "TypeScript/TSX files" },
    { expr: "!inputFocus && !terminalFocus", desc: "No input or terminal focus" },
    { expr: "config.editor.minimap.enabled", desc: "When minimap is enabled" },
  ];

  return (
    <div class={`when-clause-input relative ${props.class || ""}`}>
      {/* Input container */}
      <div class={`relative flex items-center gap-2 rounded-lg border bg-background px-3 py-2 transition-colors ${
        !validation().isValid 
          ? "border-red-500" 
          : isFocused() 
            ? "border-primary" 
            : "border-border"
      }`}>
        <input
          ref={inputRef}
          type="text"
          value={props.value}
          onInput={handleInput}
          onSelect={handleSelect}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={props.disabled}
          placeholder={props.placeholder || "e.g., editorTextFocus && !editorReadonly"}
          class="flex-1 bg-transparent text-sm outline-none placeholder:text-foreground-muted disabled:opacity-50"
          spellcheck={false}
          autocomplete="off"
        />
        
        {/* Validation indicator */}
        <Show when={props.value}>
          <Show
            when={validation().isValid}
            fallback={
              <div class="text-red-500" title={validation().error}>
                <Icon name="circle-exclamation" class="h-4 w-4" />
              </div>
            }
          >
            <div class="text-green-500" title="Valid expression">
              <Icon name="check" class="h-4 w-4" />
            </div>
          </Show>
        </Show>

        {/* Examples button */}
        <button
          type="button"
          onClick={() => setShowExamples(!showExamples())}
          class="p-1 rounded hover:bg-background-tertiary text-foreground-muted hover:text-foreground transition-colors"
          title="Show examples"
        >
          <Icon name="circle-info" class="h-4 w-4" />
        </button>
      </div>

      {/* Error message */}
      <Show when={!validation().isValid && validation().error}>
        <div class="mt-1 text-xs text-red-500 flex items-center gap-1">
          <Icon name="circle-exclamation" class="h-3 w-3" />
          {validation().error}
        </div>
      </Show>

      {/* Autocomplete dropdown */}
      <Show when={showAutocomplete() && isFocused() && filteredKeys().length > 0}>
        <div class="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
          <For each={filteredKeys()}>
            {(key, index) => (
              <button
                type="button"
                class={`w-full px-3 py-2 text-left text-sm hover:bg-background-tertiary transition-colors flex items-center justify-between ${
                  index() === autocompleteIndex() ? "bg-primary/10 text-primary" : ""
                }`}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur
                  selectAutocompleteItem(key.key);
                }}
                onMouseEnter={() => setAutocompleteIndex(index())}
              >
                <div>
                  <span class="font-mono">{key.key}</span>
                  <span class="ml-2 text-foreground-muted">{key.description}</span>
                </div>
                <span class={`text-xs px-1.5 py-0.5 rounded ${
                  key.type === "boolean" 
                    ? "bg-blue-500/20 text-blue-400" 
                    : key.type === "string"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-yellow-500/20 text-yellow-400"
                }`}>
                  {key.type}
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Examples dropdown */}
      <Show when={showExamples()}>
        <div class="absolute z-50 mt-1 w-full rounded-lg border border-border bg-background shadow-lg">
          <div class="px-3 py-2 border-b border-border">
            <span class="text-xs font-semibold text-foreground-muted uppercase">Example Expressions</span>
          </div>
          <For each={examples}>
            {(example) => (
              <button
                type="button"
                class="w-full px-3 py-2 text-left text-sm hover:bg-background-tertiary transition-colors"
                onClick={() => {
                  props.onChange(example.expr);
                  setShowExamples(false);
                }}
              >
                <div class="font-mono text-primary">{example.expr}</div>
                <div class="text-xs text-foreground-muted mt-0.5">{example.desc}</div>
              </button>
            )}
          </For>
          <div class="px-3 py-2 border-t border-border">
            <div class="text-xs text-foreground-muted">
              <span class="font-semibold">Operators:</span>{" "}
              <code class="bg-background-tertiary px-1 rounded">&&</code>{" "}
              <code class="bg-background-tertiary px-1 rounded">||</code>{" "}
              <code class="bg-background-tertiary px-1 rounded">!</code>{" "}
              <code class="bg-background-tertiary px-1 rounded">==</code>{" "}
              <code class="bg-background-tertiary px-1 rounded">!=</code>{" "}
              <code class="bg-background-tertiary px-1 rounded">=~</code>{" "}
              <code class="bg-background-tertiary px-1 rounded">in</code>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// When Clause Record Button (Experimental)
// ============================================================================

export interface WhenClauseRecordButtonProps {
  onRecord: (contextKeys: Record<string, boolean | string | number>) => void;
  disabled?: boolean;
}

/** Experimental button to record current context state */
export function WhenClauseRecordButton(props: WhenClauseRecordButtonProps) {
  const [isRecording, setIsRecording] = createSignal(false);

  const handleRecord = () => {
    setIsRecording(true);
    
    // In a real implementation, this would capture the current context state
    // For now, we simulate it
    setTimeout(() => {
      const simulatedContext = {
        editorTextFocus: document.activeElement?.closest(".monaco-editor") !== null,
        terminalFocus: document.activeElement?.closest(".xterm") !== null,
        inputFocus: document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA",
        sideBarVisible: true,
        panelVisible: false,
      };
      
      props.onRecord(simulatedContext);
      setIsRecording(false);
    }, 1000);
  };

  return (
    <button
      type="button"
      onClick={handleRecord}
      disabled={props.disabled || isRecording()}
      class={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
        isRecording()
          ? "border-red-500 bg-red-500/10 text-red-500"
          : "border-border hover:border-border-active hover:bg-background-tertiary"
      }`}
      title="Record current context state (experimental)"
    >
      <Icon name="video" class={`h-3.5 w-3.5 ${isRecording() ? "animate-pulse" : ""}`} />
      {isRecording() ? "Recording..." : "Record Context"}
    </button>
  );
}

// ============================================================================
// When Clause Display (for read-only views)
// ============================================================================

export interface WhenClauseDisplayProps {
  value: string;
  class?: string;
}

/** Read-only display of a when clause with syntax highlighting */
export function WhenClauseDisplay(props: WhenClauseDisplayProps) {
  // Simple syntax highlighting
  const highlighted = createMemo(() => {
    if (!props.value) return null;
    
    const tokens = tokenize(props.value);
    
    return tokens.map(token => {
      // Operators
      if (["&&", "||", "!", "==", "!=", "=~", ">", "<", ">=", "<=", "in"].includes(token)) {
        return { token, class: "text-purple-400" };
      }
      // Parentheses
      if (token === "(" || token === ")") {
        return { token, class: "text-yellow-400" };
      }
      // Strings
      if (token.startsWith("'") || token.startsWith('"')) {
        return { token, class: "text-green-400" };
      }
      // Numbers
      if (/^\d+$/.test(token)) {
        return { token, class: "text-orange-400" };
      }
      // Booleans
      if (token === "true" || token === "false") {
        return { token, class: "text-blue-400" };
      }
      // Context keys
      if (CONTEXT_KEY_NAMES.includes(token) || token.startsWith("config.")) {
        return { token, class: "text-cyan-400" };
      }
      // Unknown keys
      return { token, class: "text-foreground" };
    });
  });

  return (
    <Show when={props.value} fallback={<span class="text-foreground-muted italic">No condition</span>}>
      <code class={`font-mono text-sm ${props.class || ""}`}>
        <For each={highlighted()}>
          {(item, index) => (
            <>
              <Show when={index() > 0}>{" "}</Show>
              <span class={item.class}>{item.token}</span>
            </>
          )}
        </For>
      </code>
    </Show>
  );
}

export default WhenClauseInput;
