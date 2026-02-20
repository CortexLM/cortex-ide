import { createEffect, onCleanup } from "solid-js";
import { useVim, VimMode as VimModeType, PendingOperator, LastChange } from "@/context/VimContext";
import type * as Monaco from "monaco-editor";

/** Props for VimMode component */
interface VimModeProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
}

/** Word boundary detection for word motions */
type WordType = "word" | "WORD";

/** Character class for word boundary detection */
type CharClass = "word" | "space" | "punctuation";

/** Get character class for word boundary detection */
function getCharClass(char: string): CharClass {
  if (/\s/.test(char)) return "space";
  if (/\w/.test(char)) return "word";
  return "punctuation";
}

/** Check if character is a word character */
function isWordChar(char: string): boolean {
  return /\w/.test(char);
}

/** Check if character is whitespace */
function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

/** Find matching bracket */
function findMatchingBracket(text: string, pos: number): number | null {
  const brackets: Record<string, string> = {
    "(": ")",
    "[": "]",
    "{": "}",
    "<": ">",
    ")": "(",
    "]": "[",
    "}": "{",
    ">": "<",
  };
  
  const openBrackets = "([{<";
  const char = text[pos];
  
  if (!brackets[char]) return null;
  
  const isOpen = openBrackets.includes(char);
  const matchChar = brackets[char];
  const direction = isOpen ? 1 : -1;
  let depth = 1;
  
  for (let i = pos + direction; i >= 0 && i < text.length; i += direction) {
    if (text[i] === char) depth++;
    else if (text[i] === matchChar) depth--;
    
    if (depth === 0) return i;
  }
  
  return null;
}

/** VimMode component - handles vim keybindings for Monaco editor */
export function VimMode(props: VimModeProps) {
  const vim = useVim();
  
  let keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  let disposables: Monaco.IDisposable[] = [];

  // Update cursor style based on mode
  const updateCursorStyle = (mode: VimModeType) => {
    const editor = props.editor;
    if (!editor) return;

    switch (mode) {
      case "normal":
        editor.updateOptions({ cursorStyle: "block" });
        break;
      case "insert":
        editor.updateOptions({ cursorStyle: "line" });
        break;
      case "visual":
      case "visual-line":
        editor.updateOptions({ cursorStyle: "block" });
        break;
      case "command":
        editor.updateOptions({ cursorStyle: "block" });
        break;
    }
  };

  // Effect to handle mode changes
  createEffect(() => {
    if (!vim.enabled()) return;
    updateCursorStyle(vim.mode());
  });

  // Setup and cleanup editor integration
  createEffect(() => {
    const editor = props.editor;
    const monaco = props.monaco;
    
    if (!editor || !monaco || !vim.enabled()) {
      cleanup();
      return;
    }

    setupVimBindings(editor, monaco);
  });

  // Cleanup function
  const cleanup = () => {
    if (keydownHandler) {
      window.removeEventListener("keydown", keydownHandler, true);
      keydownHandler = null;
    }
    
    disposables.forEach((d) => d?.dispose?.());
    disposables = [];

    // Reset cursor style when vim is disabled
    if (props.editor) {
      props.editor.updateOptions({ cursorStyle: "line" });
    }
  };

  onCleanup(cleanup);

  /** Get all text */
  const getAllText = (editor: Monaco.editor.IStandaloneCodeEditor): string => {
    const model = editor.getModel();
    return model?.getValue() || "";
  };

  /** Get position info */
  const getPositionInfo = (editor: Monaco.editor.IStandaloneCodeEditor) => {
    const model = editor.getModel();
    const position = editor.getPosition();
    if (!model || !position) return null;
    
    return {
      line: position.lineNumber,
      column: position.column,
      lineCount: model.getLineCount(),
      lineLength: model.getLineContent(position.lineNumber).length,
      lineContent: model.getLineContent(position.lineNumber),
    };
  };

  /** Move cursor to position */
  const moveCursor = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    line: number,
    column: number,
    select: boolean = false
  ) => {
    const model = editor.getModel();
    if (!model) return;
    
    // Clamp line number
    line = Math.max(1, Math.min(line, model.getLineCount()));
    
    // Clamp column
    const lineLength = model.getLineContent(line).length;
    column = Math.max(1, Math.min(column, Math.max(1, lineLength + (vim.mode() === "insert" ? 1 : 0))));
    
    if (select) {
      const selection = editor.getSelection();
      if (selection) {
        editor.setSelection({
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: line,
          endColumn: column,
        });
      }
    } else {
      editor.setPosition({ lineNumber: line, column });
    }
    
    editor.revealPositionInCenterIfOutsideViewport({ lineNumber: line, column });
  };

  /** Find next word start */
  const findWordStart = (
    text: string,
    pos: number,
    forward: boolean,
    wordType: WordType = "word"
  ): number => {
    if (forward) {
      // Skip current word
      while (pos < text.length && !isWhitespace(text[pos])) {
        if (wordType === "word" && getCharClass(text[pos]) !== getCharClass(text[pos - 1] || text[pos])) {
          return pos;
        }
        pos++;
      }
      // Skip whitespace
      while (pos < text.length && isWhitespace(text[pos])) {
        pos++;
      }
      return pos;
    } else {
      // Move back one
      pos = Math.max(0, pos - 1);
      // Skip whitespace backwards
      while (pos > 0 && isWhitespace(text[pos])) {
        pos--;
      }
      // Find start of word
      const startClass = getCharClass(text[pos]);
      while (pos > 0 && getCharClass(text[pos - 1]) === startClass) {
        pos--;
      }
      return pos;
    }
  };

  /** Find word end */
  const findWordEnd = (
    text: string,
    pos: number,
    _wordType: WordType = "word"
  ): number => {
    // Move to next character first
    pos = Math.min(text.length - 1, pos + 1);
    
    // Skip whitespace
    while (pos < text.length && isWhitespace(text[pos])) {
      pos++;
    }
    
    if (pos >= text.length) return text.length - 1;
    
    // Find end of word
    const startClass = getCharClass(text[pos]);
    while (pos < text.length - 1 && getCharClass(text[pos + 1]) === startClass) {
      pos++;
    }
    
    return pos;
  };

  /** Delete text range */
  const deleteRange = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
    registerType: "char" | "line" = "char"
  ) => {
    const model = editor.getModel();
    if (!model) return;
    
    const range = new monaco.Range(startLine, startCol, endLine, endCol);
    const text = model.getValueInRange(range);
    
    // Save to register
    vim.setRegister('"', text, registerType);
    vim.setRegister("0", text, registerType);
    
    // Delete
    editor.executeEdits("vim-delete", [
      { range, text: "" },
    ]);
  };

  /** Yank text range */
  const yankRange = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
    registerType: "char" | "line" = "char"
  ) => {
    const model = editor.getModel();
    if (!model) return;
    
    const range = new monaco.Range(startLine, startCol, endLine, endCol);
    const text = model.getValueInRange(range);
    
    // Save to register
    vim.setRegister('"', text, registerType);
    vim.setRegister("0", text, registerType);
  };

  /** Execute motion and return end position */
  const executeMotion = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    _monaco: typeof Monaco,
    motion: string,
    count: number
  ): { line: number; column: number } | null => {
    const info = getPositionInfo(editor);
    if (!info) return null;
    
    const model = editor.getModel();
    if (!model) return null;
    
    let newLine = info.line;
    let newCol = info.column;
    
    switch (motion) {
      // Basic motions
      case "h":
        newCol = Math.max(1, info.column - count);
        break;
        
      case "l":
        newCol = Math.min(info.lineLength, info.column + count);
        break;
        
      case "j":
        newLine = Math.min(info.lineCount, info.line + count);
        break;
        
      case "k":
        newLine = Math.max(1, info.line - count);
        break;
        
      // Line motions
      case "0":
        newCol = 1;
        break;
        
      case "^":
        // First non-whitespace character
        const lineContent = info.lineContent;
        const firstNonWs = lineContent.search(/\S/);
        newCol = firstNonWs === -1 ? 1 : firstNonWs + 1;
        break;
        
      case "$":
        newCol = Math.max(1, info.lineLength);
        break;
        
      // Word motions
      case "w": {
        const text = getAllText(editor);
        const offset = model.getOffsetAt({ lineNumber: info.line, column: info.column });
        let newOffset = offset;
        
        for (let i = 0; i < count; i++) {
          newOffset = findWordStart(text, newOffset, true);
        }
        
        const newPos = model.getPositionAt(newOffset);
        newLine = newPos.lineNumber;
        newCol = newPos.column;
        break;
      }
        
      case "W": {
        const text = getAllText(editor);
        const offset = model.getOffsetAt({ lineNumber: info.line, column: info.column });
        let newOffset = offset;
        
        for (let i = 0; i < count; i++) {
          newOffset = findWordStart(text, newOffset, true, "WORD");
        }
        
        const newPos = model.getPositionAt(newOffset);
        newLine = newPos.lineNumber;
        newCol = newPos.column;
        break;
      }
        
      case "b": {
        const text = getAllText(editor);
        const offset = model.getOffsetAt({ lineNumber: info.line, column: info.column });
        let newOffset = offset;
        
        for (let i = 0; i < count; i++) {
          newOffset = findWordStart(text, newOffset, false);
        }
        
        const newPos = model.getPositionAt(newOffset);
        newLine = newPos.lineNumber;
        newCol = newPos.column;
        break;
      }
        
      case "B": {
        const text = getAllText(editor);
        const offset = model.getOffsetAt({ lineNumber: info.line, column: info.column });
        let newOffset = offset;
        
        for (let i = 0; i < count; i++) {
          newOffset = findWordStart(text, newOffset, false, "WORD");
        }
        
        const newPos = model.getPositionAt(newOffset);
        newLine = newPos.lineNumber;
        newCol = newPos.column;
        break;
      }
        
      case "e": {
        const text = getAllText(editor);
        const offset = model.getOffsetAt({ lineNumber: info.line, column: info.column });
        let newOffset = offset;
        
        for (let i = 0; i < count; i++) {
          newOffset = findWordEnd(text, newOffset);
        }
        
        const newPos = model.getPositionAt(newOffset);
        newLine = newPos.lineNumber;
        newCol = newPos.column;
        break;
      }
        
      case "E": {
        const text = getAllText(editor);
        const offset = model.getOffsetAt({ lineNumber: info.line, column: info.column });
        let newOffset = offset;
        
        for (let i = 0; i < count; i++) {
          newOffset = findWordEnd(text, newOffset, "WORD");
        }
        
        const newPos = model.getPositionAt(newOffset);
        newLine = newPos.lineNumber;
        newCol = newPos.column;
        break;
      }
        
      // Document motions
      case "gg":
        newLine = count === 1 && vim.count() === "" ? 1 : count;
        newCol = 1;
        break;
        
      case "G":
        newLine = count === 1 && vim.count() === "" ? info.lineCount : count;
        newCol = 1;
        break;
        
      // Screen motions
      case "H": {
        const visibleRanges = editor.getVisibleRanges();
        if (visibleRanges.length > 0) {
          newLine = visibleRanges[0].startLineNumber + (count - 1);
        }
        break;
      }
        
      case "M": {
        const visibleRanges = editor.getVisibleRanges();
        if (visibleRanges.length > 0) {
          const startLine = visibleRanges[0].startLineNumber;
          const endLine = visibleRanges[0].endLineNumber;
          newLine = Math.floor((startLine + endLine) / 2);
        }
        break;
      }
        
      case "L": {
        const visibleRanges = editor.getVisibleRanges();
        if (visibleRanges.length > 0) {
          newLine = visibleRanges[0].endLineNumber - (count - 1);
        }
        break;
      }
        
      // Matching bracket
      case "%": {
        const text = getAllText(editor);
        const offset = model.getOffsetAt({ lineNumber: info.line, column: info.column });
        const matchPos = findMatchingBracket(text, offset);
        
        if (matchPos !== null) {
          const newPos = model.getPositionAt(matchPos);
          newLine = newPos.lineNumber;
          newCol = newPos.column;
        }
        break;
      }
        
      default:
        return null;
    }
    
    return { line: newLine, column: newCol };
  };

  /** Find text object range */
  const findTextObjectRange = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    _monaco: typeof Monaco,
    object: string,
    around: boolean
  ): { start: { line: number; col: number }; end: { line: number; col: number } } | null => {
    const model = editor.getModel();
    const position = editor.getPosition();
    if (!model || !position) return null;
    
    const lineContent = model.getLineContent(position.lineNumber);
    const allText = getAllText(editor);
    const offset = model.getOffsetAt(position);
    
    switch (object) {
      case "w": { // Word
        // Find word boundaries
        let start = offset;
        let end = offset;
        
        // Find start of word
        while (start > 0 && isWordChar(allText[start - 1])) {
          start--;
        }
        
        // Find end of word
        while (end < allText.length && isWordChar(allText[end])) {
          end++;
        }
        
        if (around) {
          // Include trailing whitespace
          while (end < allText.length && isWhitespace(allText[end]) && allText[end] !== "\n") {
            end++;
          }
        }
        
        const startPos = model.getPositionAt(start);
        const endPos = model.getPositionAt(end);
        
        return {
          start: { line: startPos.lineNumber, col: startPos.column },
          end: { line: endPos.lineNumber, col: endPos.column },
        };
      }
      
      case "W": { // WORD
        let start = offset;
        let end = offset;
        
        // Find start of WORD (non-whitespace sequence)
        while (start > 0 && !isWhitespace(allText[start - 1])) {
          start--;
        }
        
        // Find end of WORD
        while (end < allText.length && !isWhitespace(allText[end])) {
          end++;
        }
        
        if (around) {
          while (end < allText.length && isWhitespace(allText[end]) && allText[end] !== "\n") {
            end++;
          }
        }
        
        const startPos = model.getPositionAt(start);
        const endPos = model.getPositionAt(end);
        
        return {
          start: { line: startPos.lineNumber, col: startPos.column },
          end: { line: endPos.lineNumber, col: endPos.column },
        };
      }
      
      case '"':
      case "'":
      case "`": { // Quoted strings
        const quote = object;
        let start = lineContent.lastIndexOf(quote, position.column - 2);
        let end = lineContent.indexOf(quote, position.column);
        
        if (start === -1 || end === -1 || start >= end) {
          // Try to find quotes that surround cursor
          start = lineContent.indexOf(quote);
          end = lineContent.indexOf(quote, start + 1);
        }
        
        if (start !== -1 && end !== -1 && start < end) {
          if (around) {
            return {
              start: { line: position.lineNumber, col: start + 1 },
              end: { line: position.lineNumber, col: end + 2 },
            };
          } else {
            return {
              start: { line: position.lineNumber, col: start + 2 },
              end: { line: position.lineNumber, col: end + 1 },
            };
          }
        }
        return null;
      }
      
      case "(":
      case ")":
      case "b": { // Parentheses
        return findBracketTextObject(allText, offset, model, "(", ")", around);
      }
      
      case "[":
      case "]": { // Square brackets
        return findBracketTextObject(allText, offset, model, "[", "]", around);
      }
      
      case "{":
      case "}":
      case "B": { // Curly braces
        return findBracketTextObject(allText, offset, model, "{", "}", around);
      }
      
      case "<":
      case ">": { // Angle brackets
        return findBracketTextObject(allText, offset, model, "<", ">", around);
      }
      
      default:
        return null;
    }
  };

  /** Find bracket text object range */
  const findBracketTextObject = (
    text: string,
    offset: number,
    model: Monaco.editor.ITextModel,
    open: string,
    close: string,
    around: boolean
  ): { start: { line: number; col: number }; end: { line: number; col: number } } | null => {
    // Find opening bracket
    let depth = 0;
    let openPos = -1;
    
    for (let i = offset; i >= 0; i--) {
      if (text[i] === close) depth++;
      else if (text[i] === open) {
        if (depth === 0) {
          openPos = i;
          break;
        }
        depth--;
      }
    }
    
    if (openPos === -1) return null;
    
    // Find closing bracket
    depth = 1;
    let closePos = -1;
    
    for (let i = openPos + 1; i < text.length; i++) {
      if (text[i] === open) depth++;
      else if (text[i] === close) {
        depth--;
        if (depth === 0) {
          closePos = i;
          break;
        }
      }
    }
    
    if (closePos === -1) return null;
    
    const startPos = model.getPositionAt(around ? openPos : openPos + 1);
    const endPos = model.getPositionAt(around ? closePos + 1 : closePos);
    
    return {
      start: { line: startPos.lineNumber, col: startPos.column },
      end: { line: endPos.lineNumber, col: endPos.column },
    };
  };

  /** Handle operator with motion */
  const executeOperatorMotion = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
    op: PendingOperator,
    motion: string,
    count: number
  ) => {
    const info = getPositionInfo(editor);
    if (!info) return;
    
    const endPos = executeMotion(editor, monaco, motion, count);
    if (!endPos) return;
    
    const startLine = info.line;
    const startCol = info.column;
    const endLine = endPos.line;
    const endCol = endPos.column;
    
    // Determine range direction
    const forward = endLine > startLine || (endLine === startLine && endCol > startCol);
    
    const rangeStart = forward ? { line: startLine, col: startCol } : { line: endLine, col: endCol };
    const rangeEnd = forward ? { line: endLine, col: endCol } : { line: startLine, col: startCol };
    
    executeOperatorOnRange(editor, monaco, op, rangeStart, rangeEnd, "char");
  };

  /** Execute operator on text object */
  const executeOperatorTextObject = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
    op: PendingOperator,
    object: string,
    around: boolean
  ) => {
    const range = findTextObjectRange(editor, monaco, object, around);
    if (!range) return;
    
    executeOperatorOnRange(editor, monaco, op, range.start, range.end, "char");
  };

  /** Execute operator on a range */
  const executeOperatorOnRange = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
    op: PendingOperator,
    start: { line: number; col: number },
    end: { line: number; col: number },
    type: "char" | "line"
  ) => {
    const model = editor.getModel();
    if (!model) return;
    
    switch (op.type) {
      case "d": // Delete
        deleteRange(editor, monaco, start.line, start.col, end.line, end.col, type);
        break;
        
      case "c": // Change
        deleteRange(editor, monaco, start.line, start.col, end.line, end.col, type);
        vim.setMode("insert");
        break;
        
      case "y": // Yank
        yankRange(editor, monaco, start.line, start.col, end.line, end.col, type);
        break;
        
      case ">": // Indent
        for (let line = start.line; line <= end.line; line++) {
          const range = new monaco.Range(line, 1, line, 1);
          editor.executeEdits("vim-indent", [{ range, text: "  " }]);
        }
        break;
        
      case "<": // Outdent
        for (let line = start.line; line <= end.line; line++) {
          const lineContent = model.getLineContent(line);
          const match = lineContent.match(/^(\s{1,2})/);
          if (match) {
            const range = new monaco.Range(line, 1, line, match[1].length + 1);
            editor.executeEdits("vim-outdent", [{ range, text: "" }]);
          }
        }
        break;
        
      case "gu": // Lowercase
        {
          const range = new monaco.Range(start.line, start.col, end.line, end.col);
          const text = model.getValueInRange(range);
          editor.executeEdits("vim-lowercase", [{ range, text: text.toLowerCase() }]);
        }
        break;
        
      case "gU": // Uppercase
        {
          const range = new monaco.Range(start.line, start.col, end.line, end.col);
          const text = model.getValueInRange(range);
          editor.executeEdits("vim-uppercase", [{ range, text: text.toUpperCase() }]);
        }
        break;
        
      case "g~": // Toggle case
        {
          const range = new monaco.Range(start.line, start.col, end.line, end.col);
          const text = model.getValueInRange(range);
          const toggled = text.split("").map((c) => 
            c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()
          ).join("");
          editor.executeEdits("vim-togglecase", [{ range, text: toggled }]);
        }
        break;
    }
  };

  /** Delete entire line(s) */
  const deleteLines = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
    count: number
  ) => {
    const model = editor.getModel();
    const position = editor.getPosition();
    if (!model || !position) return;
    
    const startLine = position.lineNumber;
    const endLine = Math.min(startLine + count - 1, model.getLineCount());
    
    // Get the text including newlines
    const endCol = model.getLineContent(endLine).length + 1;
    
    // Include the newline character if not last line
    let range: Monaco.Range;
    if (endLine < model.getLineCount()) {
      range = new monaco.Range(startLine, 1, endLine + 1, 1);
    } else if (startLine > 1) {
      // Last line(s), include previous newline
      range = new monaco.Range(startLine - 1, model.getLineContent(startLine - 1).length + 1, endLine, endCol);
    } else {
      range = new monaco.Range(startLine, 1, endLine, endCol);
    }
    
    const text = model.getValueInRange(range);
    vim.setRegister('"', text, "line");
    vim.setRegister("0", text, "line");
    
    editor.executeEdits("vim-delete-line", [{ range, text: "" }]);
  };

  /** Yank entire line(s) */
  const yankLines = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    _monaco: typeof Monaco,
    count: number
  ) => {
    const model = editor.getModel();
    const position = editor.getPosition();
    if (!model || !position) return;
    
    const startLine = position.lineNumber;
    const endLine = Math.min(startLine + count - 1, model.getLineCount());
    
    let text = "";
    for (let i = startLine; i <= endLine; i++) {
      text += model.getLineContent(i) + "\n";
    }
    
    vim.setRegister('"', text, "line");
    vim.setRegister("0", text, "line");
  };

  /** Paste from register */
  const paste = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
    after: boolean,
    count: number
  ) => {
    const register = vim.getRegister('"');
    if (!register || !register.content) return;
    
    const model = editor.getModel();
    const position = editor.getPosition();
    if (!model || !position) return;
    
    let text = register.content.repeat(count);
    
    if (register.type === "line") {
      // Line-wise paste
      if (after) {
        const lineEnd = model.getLineContent(position.lineNumber).length + 1;
        const range = new monaco.Range(position.lineNumber, lineEnd, position.lineNumber, lineEnd);
        if (!text.startsWith("\n")) text = "\n" + text;
        if (text.endsWith("\n")) text = text.slice(0, -1);
        editor.executeEdits("vim-paste", [{ range, text }]);
        moveCursor(editor, position.lineNumber + 1, 1);
      } else {
        const range = new monaco.Range(position.lineNumber, 1, position.lineNumber, 1);
        if (!text.endsWith("\n")) text = text + "\n";
        editor.executeEdits("vim-paste", [{ range, text }]);
        moveCursor(editor, position.lineNumber, 1);
      }
    } else {
      // Character-wise paste
      if (after) {
        const col = Math.min(position.column + 1, model.getLineContent(position.lineNumber).length + 1);
        const range = new monaco.Range(position.lineNumber, col, position.lineNumber, col);
        editor.executeEdits("vim-paste", [{ range, text }]);
        moveCursor(editor, position.lineNumber, col + text.length - 1);
      } else {
        const range = new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column);
        editor.executeEdits("vim-paste", [{ range, text }]);
        moveCursor(editor, position.lineNumber, position.column + text.length - 1);
      }
    }
  };

  /** Handle visual mode selection */
  const updateVisualSelection = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    targetLine: number,
    targetCol: number
  ) => {
    const selection = editor.getSelection();
    if (!selection) return;
    
    const visualSel = vim.state.visualSelection;
    if (!visualSel) return;
    
    if (vim.mode() === "visual-line") {
      // Line-wise selection
      const model = editor.getModel();
      if (!model) return;
      
      const startLine = Math.min(visualSel.start.line, targetLine);
      const endLine = Math.max(visualSel.start.line, targetLine);
      
      editor.setSelection({
        startLineNumber: startLine,
        startColumn: 1,
        endLineNumber: endLine,
        endColumn: model.getLineContent(endLine).length + 1,
      });
    } else {
      // Character-wise selection
      editor.setSelection({
        startLineNumber: visualSel.start.line,
        startColumn: visualSel.start.column,
        endLineNumber: targetLine,
        endColumn: targetCol,
      });
    }
  };

  /** Setup vim keybindings */
  const setupVimBindings = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco
  ) => {
    // Clean up existing handlers
    cleanup();
    
    // Set initial cursor style
    updateCursorStyle(vim.mode());

    // Handle keydown events
    keydownHandler = (e: KeyboardEvent) => {
      if (!vim.enabled()) return;
      
      const mode = vim.mode();
      const key = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      
      // Always allow these shortcuts
      if (ctrl && (key === "c" || key === "v" || key === "x" || key === "z" || key === "y" || key === "s" || key === "a")) {
        return; // Let Monaco handle these
      }
      
      // Handle Escape in any mode
      if (key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        
        // If leaving insert mode, capture the inserted text for dot repeat
        if (mode === "insert") {
          const insertStart = vim.state.insertStartPosition;
          const currentPos = editor.getPosition();
          const model = editor.getModel();
          
          if (insertStart && currentPos && model) {
            // Get the text that was inserted
            const startOffset = model.getOffsetAt({ 
              lineNumber: insertStart.line, 
              column: insertStart.column 
            });
            const endOffset = model.getOffsetAt({
              lineNumber: currentPos.lineNumber,
              column: currentPos.column
            });
            
            if (endOffset > startOffset) {
              const insertedText = model.getValue().substring(startOffset, endOffset);
              
              // Update last change with the inserted text
              const existingChange = vim.getLastChange();
              if (existingChange && (existingChange.type === "insert" || 
                  existingChange.type === "s" || existingChange.type === "S" ||
                  existingChange.type === "c" || existingChange.type === "C" ||
                  existingChange.type === "cc" || existingChange.type === "o" ||
                  existingChange.type === "O" || existingChange.type === "a" ||
                  existingChange.type === "A" || existingChange.type === "I")) {
                vim.setLastChange({ ...existingChange, insertedText });
              } else {
                // New insert change (via i command without tracked start)
                vim.setLastChange({
                  type: "insert",
                  insertedText,
                  count: 1,
                });
              }
            }
          }
        }
        
        vim.resetState();
        editor.setSelection({
          startLineNumber: editor.getPosition()?.lineNumber || 1,
          startColumn: editor.getPosition()?.column || 1,
          endLineNumber: editor.getPosition()?.lineNumber || 1,
          endColumn: editor.getPosition()?.column || 1,
        });
        return;
      }
      
      // Handle based on mode
      switch (mode) {
        case "insert":
          handleInsertMode(e, editor, monaco);
          break;
          
        case "normal":
          handleNormalMode(e, editor, monaco);
          break;
          
        case "visual":
        case "visual-line":
          handleVisualMode(e, editor, monaco);
          break;
          
        case "command":
          handleCommandMode(e, editor, monaco);
          break;
      }
    };

    window.addEventListener("keydown", keydownHandler, true);
  };

  /** Handle insert mode keys */
  const handleInsertMode = (
    e: KeyboardEvent,
    editor: Monaco.editor.IStandaloneCodeEditor,
    _monaco: typeof Monaco
  ) => {
    const key = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    
    // Ctrl+[ is another way to escape
    if (ctrl && key === "[") {
      e.preventDefault();
      e.stopPropagation();
      vim.setMode("normal");
      // Move cursor back one if possible
      const pos = editor.getPosition();
      if (pos && pos.column > 1) {
        moveCursor(editor, pos.lineNumber, pos.column - 1);
      }
      return;
    }
    
    // Let editor handle everything else in insert mode
  };

  /** Handle normal mode keys */
  const handleNormalMode = (
    e: KeyboardEvent,
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco
  ) => {
    const key = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    
    // Get current count
    const count = vim.getEffectiveCount();
    const pendingOp = vim.pendingOperator();
    
    // Handle count prefix
    if (/^[1-9]$/.test(key) || (key === "0" && vim.count() !== "")) {
      e.preventDefault();
      e.stopPropagation();
      vim.appendCount(key);
      return;
    }
    
    // Handle g prefix commands
    if (key === "g" && !pendingOp) {
      e.preventDefault();
      e.stopPropagation();
      vim.setPendingOperator({ type: "g~", count } as unknown as PendingOperator);
      return;
    }
    
    // If we have 'g' pending, handle second key
    const pendingType = pendingOp?.type;
    if (pendingType === "g~") {
      e.preventDefault();
      e.stopPropagation();
      
      switch (key) {
        case "g": // gg - go to first line
          const endPos = executeMotion(editor, monaco, "gg", count);
          if (endPos) moveCursor(editor, endPos.line, endPos.column);
          break;
          
        case "u": // gu - lowercase operator
          vim.setPendingOperator({ type: "gu", count });
          vim.clearCount();
          return;
          
        case "U": // gU - uppercase operator
          vim.setPendingOperator({ type: "gU", count });
          vim.clearCount();
          return;
          
        case "~": // g~ - toggle case operator
          vim.setPendingOperator({ type: "g~", count });
          vim.clearCount();
          return;
      }
      
      vim.setPendingOperator(null);
      vim.clearCount();
      return;
    }
    
    // Handle operators pending motion
    if (pendingOp && ["d", "c", "y", ">", "<", "gu", "gU", "g~"].includes(pendingOp.type)) {
      e.preventDefault();
      e.stopPropagation();
      
      // Handle text objects (i for inner, a for around)
      if (key === "i" || key === "a") {
        vim.appendCommandBuffer(key);
        return;
      }
      
      // Check if we have i/a pending
      const cmdBuf = vim.commandBuffer();
      if (cmdBuf === "i" || cmdBuf === "a") {
        const around = cmdBuf === "a";
        const objectKey = key;
        
        // Valid text object targets
        if (["w", "W", '"', "'", "`", "(", ")", "b", "[", "]", "{", "}", "B", "<", ">"].includes(objectKey)) {
          executeOperatorTextObject(editor, monaco, pendingOp, objectKey, around);
          // Track change for d and c operators
          if (pendingOp.type === "d" || pendingOp.type === "c") {
            const change: LastChange = {
              type: pendingOp.type,
              operator: pendingOp.type,
              textObject: { object: objectKey, around },
              count,
            };
            if (pendingOp.type === "c") {
              // For change operations, set insert start position
              const pos = editor.getPosition();
              if (pos) {
                vim.setInsertStartPosition({ line: pos.lineNumber, column: pos.column });
              }
            }
            vim.setLastChange(change);
          }
          vim.setPendingOperator(null);
          vim.clearCount();
          vim.clearCommandBuffer();
          return;
        }
      }
      
      // Handle doubled operator (dd, yy, cc, etc.)
      if (key === pendingOp.type[0]) {
        switch (pendingOp.type) {
          case "d":
            deleteLines(editor, monaco, count);
            vim.setLastChange({ type: "dd", count });
            break;
          case "y":
            yankLines(editor, monaco, count);
            // yy doesn't change document, don't track as last change
            break;
          case "c":
            deleteLines(editor, monaco, count);
            {
              const info = getPositionInfo(editor);
              if (info) {
                vim.setInsertStartPosition({ line: info.line, column: 1 });
              }
            }
            vim.setLastChange({ type: "cc", count });
            vim.setMode("insert");
            break;
          case ">":
          case "<":
            {
              const info = getPositionInfo(editor);
              if (info) {
                executeOperatorOnRange(editor, monaco, pendingOp,
                  { line: info.line, col: 1 },
                  { line: Math.min(info.line + count - 1, info.lineCount), col: 1 },
                  "line"
                );
              }
            }
            break;
        }
        vim.setPendingOperator(null);
        vim.clearCount();
        vim.clearCommandBuffer();
        return;
      }
      
      // Handle motion
      const motions = ["h", "j", "k", "l", "w", "W", "b", "B", "e", "E", "0", "^", "$", "%", "G"];
      if (motions.includes(key)) {
        executeOperatorMotion(editor, monaco, pendingOp, key, count);
        // Track change for d and c operators
        if (pendingOp.type === "d" || pendingOp.type === "c") {
          const change: LastChange = {
            type: pendingOp.type,
            operator: pendingOp.type,
            motion: key,
            count,
          };
          if (pendingOp.type === "c") {
            // For change operations, set insert start position
            const pos = editor.getPosition();
            if (pos) {
              vim.setInsertStartPosition({ line: pos.lineNumber, column: pos.column });
            }
          }
          vim.setLastChange(change);
        }
        vim.setPendingOperator(null);
        vim.clearCount();
        vim.clearCommandBuffer();
        return;
      }
      
      // Cancel on unknown key
      vim.setPendingOperator(null);
      vim.clearCount();
      vim.clearCommandBuffer();
      return;
    }
    
    // Normal mode commands
    e.preventDefault();
    e.stopPropagation();
    
    switch (key) {
      // Mode switching
      case "i": // Insert before cursor
        vim.setMode("insert");
        {
          const pos = editor.getPosition();
          vim.setInsertStartPosition(pos ? { line: pos.lineNumber, column: pos.column } : null);
          vim.setLastChange({ type: "insert", count: 1 });
        }
        break;
        
      case "I": // Insert at beginning of line
        {
          const info = getPositionInfo(editor);
          if (info) {
            const firstNonWs = info.lineContent.search(/\S/);
            const col = firstNonWs === -1 ? 1 : firstNonWs + 1;
            moveCursor(editor, info.line, col);
            vim.setInsertStartPosition({ line: info.line, column: col });
          }
          vim.setLastChange({ type: "I", count: 1 });
          vim.setMode("insert");
        }
        break;
        
      case "a": // Append after cursor
        {
          const pos = editor.getPosition();
          const model = editor.getModel();
          if (pos && model) {
            const lineLen = model.getLineContent(pos.lineNumber).length;
            const col = Math.min(pos.column + 1, lineLen + 1);
            moveCursor(editor, pos.lineNumber, col);
            vim.setInsertStartPosition({ line: pos.lineNumber, column: col });
          }
          vim.setLastChange({ type: "a", count: 1 });
          vim.setMode("insert");
        }
        break;
        
      case "A": // Append at end of line
        {
          const info = getPositionInfo(editor);
          if (info) {
            const col = info.lineLength + 1;
            moveCursor(editor, info.line, col);
            vim.setInsertStartPosition({ line: info.line, column: col });
          }
          vim.setLastChange({ type: "A", count: 1 });
          vim.setMode("insert");
        }
        break;
        
      case "o": // Open line below
        {
          const info = getPositionInfo(editor);
          if (info) {
            const endOfLine = new monaco.Range(info.line, info.lineLength + 1, info.line, info.lineLength + 1);
            editor.executeEdits("vim-newline", [{ range: endOfLine, text: "\n" }]);
            vim.setInsertStartPosition({ line: info.line + 1, column: 1 });
            moveCursor(editor, info.line + 1, 1);
          }
          vim.setLastChange({ type: "o", count: 1 });
          vim.setMode("insert");
        }
        break;
        
      case "O": // Open line above
        {
          const info = getPositionInfo(editor);
          if (info) {
            const startOfLine = new monaco.Range(info.line, 1, info.line, 1);
            editor.executeEdits("vim-newline", [{ range: startOfLine, text: "\n" }]);
            vim.setInsertStartPosition({ line: info.line, column: 1 });
            moveCursor(editor, info.line, 1);
          }
          vim.setLastChange({ type: "O", count: 1 });
          vim.setMode("insert");
        }
        break;
        
      case "v": // Visual mode
        {
          const pos = editor.getPosition();
          if (pos) {
            vim.setVisualSelection({
              start: { line: pos.lineNumber, column: pos.column },
              end: { line: pos.lineNumber, column: pos.column },
            });
          }
          vim.setMode("visual");
        }
        break;
        
      case "V": // Visual line mode
        {
          const pos = editor.getPosition();
          const model = editor.getModel();
          if (pos && model) {
            vim.setVisualSelection({
              start: { line: pos.lineNumber, column: 1 },
              end: { line: pos.lineNumber, column: model.getLineContent(pos.lineNumber).length + 1 },
            });
            editor.setSelection({
              startLineNumber: pos.lineNumber,
              startColumn: 1,
              endLineNumber: pos.lineNumber,
              endColumn: model.getLineContent(pos.lineNumber).length + 1,
            });
          }
          vim.setMode("visual-line");
        }
        break;
        
      case ":": // Command mode
        vim.setMode("command");
        vim.setCommandBuffer(":");
        break;
        
      // Motions
      case "h":
      case "j":
      case "k":
      case "l":
      case "w":
      case "W":
      case "b":
      case "B":
      case "e":
      case "E":
      case "0":
      case "^":
      case "$":
      case "%":
      case "G":
      case "H":
      case "M":
      case "L":
        {
          const endPos = executeMotion(editor, monaco, key, count);
          if (endPos) moveCursor(editor, endPos.line, endPos.column);
          vim.clearCount();
        }
        break;
        
      // Operators
      case "d":
        vim.setPendingOperator({ type: "d", count });
        vim.clearCount();
        break;
        
      case "c":
        vim.setPendingOperator({ type: "c", count });
        vim.clearCount();
        break;
        
      case "y":
        vim.setPendingOperator({ type: "y", count });
        vim.clearCount();
        break;
        
      case ">":
        vim.setPendingOperator({ type: ">", count });
        vim.clearCount();
        break;
        
      case "<":
        vim.setPendingOperator({ type: "<", count });
        vim.clearCount();
        break;
        
      // Quick actions
      case "x": // Delete character
        {
          const info = getPositionInfo(editor);
          if (info && info.lineLength > 0) {
            const deleteCount = Math.min(count, info.lineLength - info.column + 1);
            deleteRange(editor, monaco, info.line, info.column, info.line, info.column + deleteCount, "char");
            vim.setLastChange({ type: "x", count });
          }
          vim.clearCount();
        }
        break;
        
      case "X": // Delete character before cursor (backspace)
        {
          const info = getPositionInfo(editor);
          if (info && info.column > 1) {
            const deleteCount = Math.min(count, info.column - 1);
            deleteRange(editor, monaco, info.line, info.column - deleteCount, info.line, info.column, "char");
            vim.setLastChange({ type: "X", count });
          }
          vim.clearCount();
        }
        break;
        
      case "s": // Substitute character
        {
          const info = getPositionInfo(editor);
          if (info && info.lineLength > 0) {
            deleteRange(editor, monaco, info.line, info.column, info.line, info.column + 1, "char");
            vim.setInsertStartPosition({ line: info.line, column: info.column });
            vim.setLastChange({ type: "s", count: 1 });
            vim.setMode("insert");
          }
          vim.clearCount();
        }
        break;
        
      case "S": // Substitute line
        {
          const info = getPositionInfo(editor);
          if (info) {
            const firstNonWs = info.lineContent.search(/\S/);
            const indent = firstNonWs === -1 ? "" : info.lineContent.substring(0, firstNonWs);
            const range = new monaco.Range(info.line, 1, info.line, info.lineLength + 1);
            vim.setRegister('"', info.lineContent, "char");
            editor.executeEdits("vim-substitute-line", [{ range, text: indent }]);
            const col = indent.length + 1;
            moveCursor(editor, info.line, col);
            vim.setInsertStartPosition({ line: info.line, column: col });
            vim.setLastChange({ type: "S", count: 1 });
            vim.setMode("insert");
          }
          vim.clearCount();
        }
        break;
        
      case "r": // Replace character or Ctrl+r for redo
        if (ctrl) {
          // Ctrl+r - Redo
          editor.trigger("vim", "redo", null);
          vim.clearCount();
        } else {
          // We need to capture the next character for replace
          vim.appendCommandBuffer("r");
        }
        break;
        
      case "D": // Delete to end of line
        {
          const info = getPositionInfo(editor);
          if (info) {
            deleteRange(editor, monaco, info.line, info.column, info.line, info.lineLength + 1, "char");
            vim.setLastChange({ type: "D", count: 1 });
          }
          vim.clearCount();
        }
        break;
        
      case "C": // Change to end of line
        {
          const info = getPositionInfo(editor);
          if (info) {
            deleteRange(editor, monaco, info.line, info.column, info.line, info.lineLength + 1, "char");
            vim.setInsertStartPosition({ line: info.line, column: info.column });
            vim.setLastChange({ type: "C", count: 1 });
            vim.setMode("insert");
          }
          vim.clearCount();
        }
        break;
        
      case "Y": // Yank line (like yy)
        yankLines(editor, monaco, count);
        vim.clearCount();
        break;
        
      case "p": // Paste after
        paste(editor, monaco, true, count);
        vim.clearCount();
        break;
        
      case "P": // Paste before
        paste(editor, monaco, false, count);
        vim.clearCount();
        break;
        
      case "u": // Undo
        if (ctrl) {
          // Ctrl+u - half page up
          const visibleRanges = editor.getVisibleRanges();
          if (visibleRanges.length > 0) {
            const height = visibleRanges[0].endLineNumber - visibleRanges[0].startLineNumber;
            const info = getPositionInfo(editor);
            if (info) {
              const newLine = Math.max(1, info.line - Math.floor(height / 2) * count);
              moveCursor(editor, newLine, info.column);
            }
          }
        } else {
          editor.trigger("vim", "undo", null);
        }
        vim.clearCount();
        break;
        
      case "J": // Join lines
        {
          const model = editor.getModel();
          const info = getPositionInfo(editor);
          if (model && info && info.line < info.lineCount) {
            for (let i = 0; i < count && info.line + i < info.lineCount; i++) {
              const currentLine = info.line + i;
              const nextLine = currentLine + 1;
              const currentLineContent = model.getLineContent(currentLine);
              const nextLineContent = model.getLineContent(nextLine).trimStart();
              
              const range = new monaco.Range(currentLine, currentLineContent.length + 1, nextLine, model.getLineContent(nextLine).length + 1);
              editor.executeEdits("vim-join", [{ range, text: " " + nextLineContent }]);
            }
          }
          vim.clearCount();
        }
        break;
        
      case "~": // Toggle case of character
        {
          const info = getPositionInfo(editor);
          if (info && info.column <= info.lineLength) {
            const char = info.lineContent[info.column - 1];
            const toggled = char === char.toLowerCase() ? char.toUpperCase() : char.toLowerCase();
            const range = new monaco.Range(info.line, info.column, info.line, info.column + 1);
            editor.executeEdits("vim-togglecase", [{ range, text: toggled }]);
            moveCursor(editor, info.line, Math.min(info.column + 1, info.lineLength));
          }
          vim.clearCount();
        }
        break;
        
      case "/": // Forward search
        vim.setLastSearch("", "forward");
        vim.setMode("command");
        vim.setCommandBuffer("/");
        break;
        
      case "?": // Backward search
        vim.setLastSearch("", "backward");
        vim.setMode("command");
        vim.setCommandBuffer("?");
        break;
        
      case "n": // Next search result
        {
          const search = vim.state.lastSearch;
          if (search) {
            const findController = editor.getContribution("editor.contrib.findController");
            if (findController) {
              // @ts-ignore - Monaco internal API
              editor.trigger("vim", "actions.find", null);
              // @ts-ignore
              editor.trigger("vim", "editor.action.nextMatchFindAction", null);
            }
          }
        }
        break;
        
      case "N": // Previous search result
        {
          const search = vim.state.lastSearch;
          if (search) {
            // @ts-ignore
            editor.trigger("vim", "editor.action.previousMatchFindAction", null);
          }
        }
        break;
        
      case "*": // Search word under cursor forward
        {
          const model = editor.getModel();
          const position = editor.getPosition();
          if (model && position) {
            const word = model.getWordAtPosition(position);
            if (word) {
              vim.setLastSearch(word.word, "forward");
              // @ts-ignore
              editor.trigger("vim", "actions.find", { searchString: word.word });
            }
          }
        }
        break;
        
      case "#": // Search word under cursor backward
        {
          const model = editor.getModel();
          const position = editor.getPosition();
          if (model && position) {
            const word = model.getWordAtPosition(position);
            if (word) {
              vim.setLastSearch(word.word, "backward");
              // @ts-ignore
              editor.trigger("vim", "actions.find", { searchString: word.word });
            }
          }
        }
        break;
        
      case ".": // Repeat last change
        {
          const lastChange = vim.getLastChange();
          if (!lastChange) break;
          
          const repeatCount = count > 1 ? count : lastChange.count;
          
          switch (lastChange.type) {
            case "x": {
              // Delete character(s)
              const info = getPositionInfo(editor);
              if (info && info.lineLength > 0) {
                const deleteCount = Math.min(repeatCount, info.lineLength - info.column + 1);
                deleteRange(editor, monaco, info.line, info.column, info.line, info.column + deleteCount, "char");
              }
              break;
            }
            
            case "X": {
              // Delete character(s) before cursor
              const info = getPositionInfo(editor);
              if (info && info.column > 1) {
                const deleteCount = Math.min(repeatCount, info.column - 1);
                deleteRange(editor, monaco, info.line, info.column - deleteCount, info.line, info.column, "char");
              }
              break;
            }
            
            case "dd": {
              // Delete lines
              deleteLines(editor, monaco, repeatCount);
              break;
            }
            
            case "D": {
              // Delete to end of line
              const info = getPositionInfo(editor);
              if (info) {
                deleteRange(editor, monaco, info.line, info.column, info.line, info.lineLength + 1, "char");
              }
              break;
            }
            
            case "r": {
              // Replace character
              if (lastChange.replaceChar) {
                const info = getPositionInfo(editor);
                if (info && info.column <= info.lineLength) {
                  const range = new monaco.Range(info.line, info.column, info.line, info.column + 1);
                  editor.executeEdits("vim-replace", [{ range, text: lastChange.replaceChar }]);
                }
              }
              break;
            }
            
            case "d": {
              // Delete with motion or text object
              if (lastChange.motion) {
                const info = getPositionInfo(editor);
                if (info) {
                  const endPos = executeMotion(editor, monaco, lastChange.motion, repeatCount);
                  if (endPos) {
                    const forward = endPos.line > info.line || (endPos.line === info.line && endPos.column > info.column);
                    if (forward) {
                      deleteRange(editor, monaco, info.line, info.column, endPos.line, endPos.column, "char");
                    } else {
                      deleteRange(editor, monaco, endPos.line, endPos.column, info.line, info.column, "char");
                    }
                  }
                }
              } else if (lastChange.textObject) {
                const range = findTextObjectRange(editor, monaco, lastChange.textObject.object, lastChange.textObject.around);
                if (range) {
                  deleteRange(editor, monaco, range.start.line, range.start.col, range.end.line, range.end.col, "char");
                }
              }
              break;
            }
            
            case "c": {
              // Change with motion or text object - delete and insert text
              if (lastChange.motion) {
                const info = getPositionInfo(editor);
                if (info) {
                  const endPos = executeMotion(editor, monaco, lastChange.motion, repeatCount);
                  if (endPos) {
                    const forward = endPos.line > info.line || (endPos.line === info.line && endPos.column > info.column);
                    if (forward) {
                      deleteRange(editor, monaco, info.line, info.column, endPos.line, endPos.column, "char");
                    } else {
                      deleteRange(editor, monaco, endPos.line, endPos.column, info.line, info.column, "char");
                    }
                  }
                }
              } else if (lastChange.textObject) {
                const range = findTextObjectRange(editor, monaco, lastChange.textObject.object, lastChange.textObject.around);
                if (range) {
                  deleteRange(editor, monaco, range.start.line, range.start.col, range.end.line, range.end.col, "char");
                }
              }
              // Insert the previously inserted text
              if (lastChange.insertedText) {
                const pos = editor.getPosition();
                if (pos) {
                  const range = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
                  editor.executeEdits("vim-repeat-insert", [{ range, text: lastChange.insertedText }]);
                  moveCursor(editor, pos.lineNumber, pos.column + lastChange.insertedText.length);
                }
              }
              break;
            }
            
            case "cc": {
              // Change lines
              deleteLines(editor, monaco, repeatCount);
              if (lastChange.insertedText) {
                const pos = editor.getPosition();
                if (pos) {
                  const range = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
                  editor.executeEdits("vim-repeat-insert", [{ range, text: lastChange.insertedText }]);
                }
              }
              break;
            }
            
            case "C": {
              // Change to end of line
              const info = getPositionInfo(editor);
              if (info) {
                deleteRange(editor, monaco, info.line, info.column, info.line, info.lineLength + 1, "char");
                if (lastChange.insertedText) {
                  const range = new monaco.Range(info.line, info.column, info.line, info.column);
                  editor.executeEdits("vim-repeat-insert", [{ range, text: lastChange.insertedText }]);
                }
              }
              break;
            }
            
            case "s": {
              // Substitute character and insert
              const info = getPositionInfo(editor);
              if (info && info.lineLength > 0) {
                deleteRange(editor, monaco, info.line, info.column, info.line, info.column + 1, "char");
                if (lastChange.insertedText) {
                  const range = new monaco.Range(info.line, info.column, info.line, info.column);
                  editor.executeEdits("vim-repeat-insert", [{ range, text: lastChange.insertedText }]);
                }
              }
              break;
            }
            
            case "S": {
              // Substitute line
              const info = getPositionInfo(editor);
              if (info) {
                const firstNonWs = info.lineContent.search(/\S/);
                const indent = firstNonWs === -1 ? "" : info.lineContent.substring(0, firstNonWs);
                const range = new monaco.Range(info.line, 1, info.line, info.lineLength + 1);
                editor.executeEdits("vim-repeat-substitute", [{ range, text: indent + (lastChange.insertedText || "") }]);
              }
              break;
            }
            
            case "insert":
            case "a":
            case "A":
            case "i":
            case "I": {
              // Insert text
              if (lastChange.insertedText) {
                const pos = editor.getPosition();
                if (pos) {
                  const range = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
                  editor.executeEdits("vim-repeat-insert", [{ range, text: lastChange.insertedText }]);
                  moveCursor(editor, pos.lineNumber, pos.column + lastChange.insertedText.length);
                }
              }
              break;
            }
            
            case "o": {
              // Open line below and insert
              const info = getPositionInfo(editor);
              if (info) {
                const endOfLine = new monaco.Range(info.line, info.lineLength + 1, info.line, info.lineLength + 1);
                const text = "\n" + (lastChange.insertedText || "");
                editor.executeEdits("vim-repeat-open", [{ range: endOfLine, text }]);
                moveCursor(editor, info.line + 1, (lastChange.insertedText?.length || 0) + 1);
              }
              break;
            }
            
            case "O": {
              // Open line above and insert
              const info = getPositionInfo(editor);
              if (info) {
                const startOfLine = new monaco.Range(info.line, 1, info.line, 1);
                const text = (lastChange.insertedText || "") + "\n";
                editor.executeEdits("vim-repeat-open", [{ range: startOfLine, text }]);
                moveCursor(editor, info.line, (lastChange.insertedText?.length || 0) + 1);
              }
              break;
            }
          }
          vim.clearCount();
        }
        break;
        
      default:
        // Handle 'r' command for replace
        if (vim.commandBuffer() === "r" && key.length === 1) {
          const info = getPositionInfo(editor);
          if (info && info.column <= info.lineLength) {
            const range = new monaco.Range(info.line, info.column, info.line, info.column + 1);
            editor.executeEdits("vim-replace", [{ range, text: key }]);
            vim.setLastChange({ type: "r", replaceChar: key, count: 1 });
          }
          vim.clearCommandBuffer();
        }
        break;
    }
  };

  /** Handle visual mode keys */
  const handleVisualMode = (
    e: KeyboardEvent,
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco
  ) => {
    const key = e.key;
    const count = vim.getEffectiveCount();
    
    e.preventDefault();
    e.stopPropagation();
    
    // Handle count prefix
    if (/^[1-9]$/.test(key) || (key === "0" && vim.count() !== "")) {
      vim.appendCount(key);
      return;
    }
    
    // Motion keys update selection
    const motions = ["h", "j", "k", "l", "w", "W", "b", "B", "e", "E", "0", "^", "$", "%", "G", "gg"];
    if (motions.includes(key) || (key === "g" && vim.commandBuffer() === "g")) {
      if (key === "g") {
        if (vim.commandBuffer() === "g") {
          const endPos = executeMotion(editor, monaco, "gg", count);
          if (endPos) {
            updateVisualSelection(editor, endPos.line, endPos.column);
          }
          vim.clearCommandBuffer();
        } else {
          vim.appendCommandBuffer("g");
        }
      } else {
        const endPos = executeMotion(editor, monaco, key, count);
        if (endPos) {
          updateVisualSelection(editor, endPos.line, endPos.column);
        }
      }
      vim.clearCount();
      return;
    }
    
    // Handle operators on selection
    const selection = editor.getSelection();
    if (!selection) return;
    
    switch (key) {
      case "d": // Delete selection
      case "x":
        deleteRange(editor, monaco,
          selection.startLineNumber, selection.startColumn,
          selection.endLineNumber, selection.endColumn,
          vim.mode() === "visual-line" ? "line" : "char"
        );
        vim.resetState();
        break;
        
      case "c": // Change selection
        deleteRange(editor, monaco,
          selection.startLineNumber, selection.startColumn,
          selection.endLineNumber, selection.endColumn,
          vim.mode() === "visual-line" ? "line" : "char"
        );
        vim.setMode("insert");
        vim.setVisualSelection(null);
        break;
        
      case "y": // Yank selection
        yankRange(editor, monaco,
          selection.startLineNumber, selection.startColumn,
          selection.endLineNumber, selection.endColumn,
          vim.mode() === "visual-line" ? "line" : "char"
        );
        moveCursor(editor, selection.startLineNumber, selection.startColumn);
        vim.resetState();
        break;
        
      case ">": // Indent
        {
          const model = editor.getModel();
          if (model) {
            for (let line = selection.startLineNumber; line <= selection.endLineNumber; line++) {
              const range = new monaco.Range(line, 1, line, 1);
              editor.executeEdits("vim-indent", [{ range, text: "  " }]);
            }
          }
          vim.resetState();
        }
        break;
        
      case "<": // Outdent
        {
          const model = editor.getModel();
          if (model) {
            for (let line = selection.startLineNumber; line <= selection.endLineNumber; line++) {
              const lineContent = model.getLineContent(line);
              const match = lineContent.match(/^(\s{1,2})/);
              if (match) {
                const range = new monaco.Range(line, 1, line, match[1].length + 1);
                editor.executeEdits("vim-outdent", [{ range, text: "" }]);
              }
            }
          }
          vim.resetState();
        }
        break;
        
      case "u": // Lowercase selection
        {
          const range = new monaco.Range(
            selection.startLineNumber, selection.startColumn,
            selection.endLineNumber, selection.endColumn
          );
          const model = editor.getModel();
          if (model) {
            const text = model.getValueInRange(range);
            editor.executeEdits("vim-lowercase", [{ range, text: text.toLowerCase() }]);
          }
          vim.resetState();
        }
        break;
        
      case "U": // Uppercase selection
        {
          const range = new monaco.Range(
            selection.startLineNumber, selection.startColumn,
            selection.endLineNumber, selection.endColumn
          );
          const model = editor.getModel();
          if (model) {
            const text = model.getValueInRange(range);
            editor.executeEdits("vim-uppercase", [{ range, text: text.toUpperCase() }]);
          }
          vim.resetState();
        }
        break;
        
      case "~": // Toggle case selection
        {
          const range = new monaco.Range(
            selection.startLineNumber, selection.startColumn,
            selection.endLineNumber, selection.endColumn
          );
          const model = editor.getModel();
          if (model) {
            const text = model.getValueInRange(range);
            const toggled = text.split("").map((c) =>
              c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()
            ).join("");
            editor.executeEdits("vim-togglecase", [{ range, text: toggled }]);
          }
          vim.resetState();
        }
        break;
        
      case "J": // Join lines
        {
          const model = editor.getModel();
          if (model) {
            for (let line = selection.startLineNumber; line < selection.endLineNumber; line++) {
              const currentLineContent = model.getLineContent(line);
              const nextLineContent = model.getLineContent(line + 1).trimStart();
              const range = new monaco.Range(line, currentLineContent.length + 1, line + 1, model.getLineContent(line + 1).length + 1);
              editor.executeEdits("vim-join", [{ range, text: " " + nextLineContent }]);
            }
          }
          vim.resetState();
        }
        break;
        
      case "v": // Toggle to character-wise visual
        if (vim.mode() === "visual-line") {
          vim.setMode("visual");
        } else {
          vim.resetState();
        }
        break;
        
      case "V": // Toggle to line-wise visual
        if (vim.mode() === "visual") {
          vim.setMode("visual-line");
          const model = editor.getModel();
          if (model) {
            editor.setSelection({
              startLineNumber: selection.startLineNumber,
              startColumn: 1,
              endLineNumber: selection.endLineNumber,
              endColumn: model.getLineContent(selection.endLineNumber).length + 1,
            });
          }
        } else {
          vim.resetState();
        }
        break;
        
      case "o": // Swap anchor and cursor
        {
          const newSelection = {
            startLineNumber: selection.endLineNumber,
            startColumn: selection.endColumn,
            endLineNumber: selection.startLineNumber,
            endColumn: selection.startColumn,
          };
          editor.setSelection(newSelection);
          const visualSel = vim.state.visualSelection;
          if (visualSel) {
            vim.setVisualSelection({
              start: visualSel.end,
              end: visualSel.start,
            });
          }
        }
        break;
        
      case "p": // Paste replacing selection
        {
          const register = vim.getRegister('"');
          if (register) {
            const range = new monaco.Range(
              selection.startLineNumber, selection.startColumn,
              selection.endLineNumber, selection.endColumn
            );
            editor.executeEdits("vim-paste", [{ range, text: register.content }]);
          }
          vim.resetState();
        }
        break;
        
      case "g":
        vim.appendCommandBuffer("g");
        break;
    }
    
    vim.clearCount();
  };

  /** Handle command mode keys */
  const handleCommandMode = (
    e: KeyboardEvent,
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco
  ) => {
    const key = e.key;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (key === "Enter") {
      // Execute command
      const cmd = vim.commandBuffer();
      
      if (cmd.startsWith(":")) {
        executeExCommand(editor, monaco, cmd.slice(1));
      } else if (cmd.startsWith("/") || cmd.startsWith("?")) {
        // Search
        const searchTerm = cmd.slice(1);
        if (searchTerm) {
          vim.setLastSearch(searchTerm, cmd.startsWith("/") ? "forward" : "backward");
          // Trigger Monaco's find
          const findController = editor.getContribution("editor.contrib.findController");
          if (findController) {
            // @ts-ignore
            findController.start({
              searchString: searchTerm,
              isRegex: false,
              matchCase: false,
              matchWholeWord: false,
              findInSelection: false,
            });
          }
        }
      }
      
      vim.resetState();
      return;
    }
    
    if (key === "Backspace") {
      const buffer = vim.commandBuffer();
      if (buffer.length > 1) {
        vim.setCommandBuffer(buffer.slice(0, -1));
      } else {
        vim.resetState();
      }
      return;
    }
    
    if (key.length === 1) {
      vim.appendCommandBuffer(key);
    }
  };

  /** Execute Ex command */
  const executeExCommand = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    _monaco: typeof Monaco,
    cmd: string
  ) => {
    const trimmed = cmd.trim();
    
    // Handle line number
    const lineMatch = trimmed.match(/^(\d+)$/);
    if (lineMatch) {
      const line = parseInt(lineMatch[1], 10);
      moveCursor(editor, line, 1);
      return;
    }
    
    // Handle common commands
    switch (trimmed) {
      case "w": // Write (save)
        const event = new CustomEvent("vim-command-execute", { detail: { command: "w" } });
        window.dispatchEvent(event);
        break;
        
      case "q": // Quit
        window.dispatchEvent(new CustomEvent("vim-command-execute", { detail: { command: "q" } }));
        break;
        
      case "wq": // Write and quit
      case "x":
        window.dispatchEvent(new CustomEvent("vim-command-execute", { detail: { command: "wq" } }));
        break;
        
      case "q!": // Force quit
        window.dispatchEvent(new CustomEvent("vim-command-execute", { detail: { command: "q!" } }));
        break;
        
      case "set number":
      case "set nu":
        editor.updateOptions({ lineNumbers: "on" });
        break;
        
      case "set nonumber":
      case "set nonu":
        editor.updateOptions({ lineNumbers: "off" });
        break;
        
      case "set relativenumber":
      case "set rnu":
        editor.updateOptions({ lineNumbers: "relative" });
        break;
        
      case "set norelativenumber":
      case "set nornu":
        editor.updateOptions({ lineNumbers: "on" });
        break;
        
      case "set wrap":
        editor.updateOptions({ wordWrap: "on" });
        break;
        
      case "set nowrap":
        editor.updateOptions({ wordWrap: "off" });
        break;
        
      case "noh":
      case "nohlsearch":
        // Clear search highlight
        // @ts-ignore
        editor.trigger("vim", "closeFindWidget", null);
        break;
    }
    
    // Handle substitution :%s/old/new/g
    const subMatch = trimmed.match(/^%?s\/(.+?)\/(.*)\/([gi]*)$/);
    if (subMatch) {
      const [, search, replace, flags] = subMatch;
      const global = flags.includes("g");
      const ignoreCase = flags.includes("i");
      
      const model = editor.getModel();
      if (model) {
        const regex = new RegExp(search, (ignoreCase ? "i" : "") + (global ? "g" : ""));
        const fullText = model.getValue();
        const newText = fullText.replace(regex, replace);
        
        const fullRange = model.getFullModelRange();
        editor.executeEdits("vim-substitute", [{ range: fullRange, text: newText }]);
      }
    }
  };

  // Return null - this component doesn't render anything
  return null;
}
