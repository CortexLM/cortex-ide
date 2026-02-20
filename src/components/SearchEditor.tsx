import { createSignal, createEffect, For, Show, onMount, onCleanup, batch, JSX } from "solid-js";
import { useEditor } from "@/context/EditorContext";
import { MonacoManager } from "@/utils/monacoManager";
import type * as Monaco from "monaco-editor";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Icon } from "./ui/Icon";
import { fsReadFile, fsWriteFile, fsSearchContent } from "../utils/tauri-api";
import { getProjectPath } from "../utils/workspace";
import {
  serializeToCodeSearch,
  parseCodeSearchFile,
  isCodeSearchFile,
  generateCodeSearchFilename,
  copyAllResults,
} from "@/utils/searchUtils";

interface SearchMatch {
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
  originalText: string;
  editedText?: string;
}

interface SearchResult {
  file: string;
  matches: SearchMatch[];
  excluded?: boolean;
}

interface SearchEditorProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  initialResults?: SearchResult[];
  codeSearchFilePath?: string; // Path to .code-search file to load
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetFile: string | null;
  targetMatch: SearchMatch | null;
  targetResultIndex: number;
  targetMatchIndex: number;
}

let monacoInstance: typeof Monaco | null = null;

const SEARCH_RESULTS_LANGUAGE_ID = "search-results";

function registerSearchResultsLanguage(monaco: typeof Monaco) {
  if (monaco.languages.getLanguages().some((lang) => lang.id === SEARCH_RESULTS_LANGUAGE_ID)) {
    return;
  }

  monaco.languages.register({ id: SEARCH_RESULTS_LANGUAGE_ID });

  monaco.languages.setMonarchTokensProvider(SEARCH_RESULTS_LANGUAGE_ID, {
    tokenizer: {
      root: [
        [/^# Search Results:.*$/, "comment.header"],
        [/^# Query:.*$/, "comment.query"],
        [/^# Files:.*$/, "comment.stats"],
        [/^# Matches:.*$/, "comment.stats"],
        [/^─+$/, "comment.separator"],
        [/^## .+$/, "type.file-header"],
        [/^\s+\d+:/, "number.line-number"],
        [/^\s+│/, "delimiter.bracket"],
        [/«[^»]+»/, "string.match-highlight"],
      ],
    },
  });

  monaco.editor.defineTheme("search-results-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment.header", foreground: "7aa2f7", fontStyle: "bold" },
      { token: "comment.query", foreground: "9ece6a" },
      { token: "comment.stats", foreground: "565f89" },
      { token: "comment.separator", foreground: "3b4261" },
      { token: "type.file-header", foreground: "bb9af7", fontStyle: "bold" },
      { token: "number.line-number", foreground: "737aa2" },
      { token: "delimiter.bracket", foreground: "3b4261" },
      { token: "string.match-highlight", foreground: "1e1e2e", background: "f9e2af", fontStyle: "bold" },
    ],
    colors: {
      "editor.background": "var(--ui-panel-bg)",
      "editor.foreground": "var(--cortex-text-secondary)",
      "editor.lineHighlightBackground": "var(--cortex-bg-hover)",
      "editor.selectionBackground": "var(--cortex-bg-active)80",
      "editorLineNumber.foreground": "var(--cortex-bg-active)",
      "editorLineNumber.activeForeground": "var(--cortex-text-inactive)",
    },
  });
}

function formatResultsAsDocument(
  query: string,
  results: SearchResult[],
  caseSensitive: boolean,
  useRegex: boolean
): string {
  const visibleResults = results.filter((r) => !r.excluded);
  const totalMatches = visibleResults.reduce((sum, r) => sum + r.matches.length, 0);
  const timestamp = new Date().toLocaleString();

  let doc = `# Search Results: "${query}"\n`;
  doc += `# Query: ${query}${caseSensitive ? " (case sensitive)" : ""}${useRegex ? " (regex)" : ""}\n`;
  doc += `# Files: ${visibleResults.length} | Matches: ${totalMatches}\n`;
  doc += `# Generated: ${timestamp}\n`;
  doc += `${"─".repeat(80)}\n\n`;

  for (const result of visibleResults) {
    doc += `## ${result.file}\n`;

    for (const match of result.matches) {
      const displayText = match.editedText !== undefined ? match.editedText : match.text;
      const lineNumStr = String(match.line).padStart(6, " ");
      const beforeMatch = displayText.slice(0, match.matchStart);
      const matchedText = displayText.slice(match.matchStart, match.matchEnd);
      const afterMatch = displayText.slice(match.matchEnd);
      const highlightedLine = `${beforeMatch}«${matchedText}»${afterMatch}`;
      doc += `  ${lineNumStr}: │ ${highlightedLine.trim()}\n`;
    }

    doc += `\n`;
  }

  return doc;
}

function parseDocumentToResults(
  content: string,
  originalResults: SearchResult[]
): SearchResult[] {
  const lines = content.split("\n");
  const updatedResults = originalResults.map((r) => ({
    ...r,
    matches: r.matches.map((m) => ({ ...m })),
  }));

  let currentFileIndex = -1;
  let currentMatchIndex = 0;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      const filePath = line.slice(3).trim();
      currentFileIndex = updatedResults.findIndex((r) => r.file === filePath && !r.excluded);
      currentMatchIndex = 0;
      continue;
    }

    if (currentFileIndex >= 0 && line.match(/^\s+\d+:\s+│/)) {
      const contentMatch = line.match(/^\s+\d+:\s+│\s*(.*)$/);
      if (contentMatch && updatedResults[currentFileIndex]) {
        const editedLine = contentMatch[1]
          .replace(/«([^»]*)»/g, "$1")
          .trim();

        if (currentMatchIndex < updatedResults[currentFileIndex].matches.length) {
          const originalMatch = updatedResults[currentFileIndex].matches[currentMatchIndex];
          if (editedLine !== originalMatch.text.trim()) {
            updatedResults[currentFileIndex].matches[currentMatchIndex].editedText = editedLine;
          }
          currentMatchIndex++;
        }
      }
    }
  }

  return updatedResults;
}

export function SearchEditor(props: SearchEditorProps) {
  const { openFile, updateFileContent, state: editorState } = useEditor();

  const [query, setQuery] = createSignal(props.initialQuery || "");
  const [results, setResults] = createSignal<SearchResult[]>(props.initialResults || []);
  const [loading, setLoading] = createSignal(false);
  const [caseSensitive, setCaseSensitive] = createSignal(false);
  const [useRegex, setUseRegex] = createSignal(false);
  const [wholeWord, setWholeWord] = createSignal(false);
  const [includePattern, setIncludePattern] = createSignal("");
  const [excludePattern, setExcludePattern] = createSignal("node_modules, .git, dist, build");
  const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(new Set());
  const [selectedResultIndex, setSelectedResultIndex] = createSignal(-1);
  const [selectedMatchIndex, setSelectedMatchIndex] = createSignal(-1);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [editorMode, setEditorMode] = createSignal(false);
  const [hasEdits, setHasEdits] = createSignal(false);
  const [applyingChanges, setApplyingChanges] = createSignal(false);
  const [contextMenu, setContextMenu] = createSignal<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    targetFile: null,
    targetMatch: null,
    targetResultIndex: -1,
    targetMatchIndex: -1,
  });

  let inputRef: HTMLInputElement | undefined;
  let editorContainerRef: HTMLDivElement | undefined;
  let monacoEditor: Monaco.editor.IStandaloneCodeEditor | null = null;
  let searchTimeout: number | undefined;
  let abortController: AbortController | null = null;

  const visibleResults = () => results().filter((r) => !r.excluded);

  const totalMatches = () => {
    return visibleResults().reduce((sum, r) => sum + r.matches.length, 0);
  };

  const editedMatchesCount = () => {
    let count = 0;
    for (const result of results()) {
      for (const match of result.matches) {
        if (match.editedText !== undefined && match.editedText !== match.text.trim()) {
          count++;
        }
      }
    }
    return count;
  };

  const cancelSearch = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    setLoading(false);
  };

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      batch(() => {
        setResults([]);
        setSearchError(null);
      });
      return;
    }

    cancelSearch();
    abortController = new AbortController();

    setLoading(true);
    setSearchError(null);

    try {
      const projectPath = getProjectPath();

      if (!projectPath) {
        setSearchError("No project open");
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({
        path: projectPath,
        query: searchQuery,
        caseSensitive: caseSensitive().toString(),
        regex: useRegex().toString(),
        wholeWord: wholeWord().toString(),
      });

      if (includePattern()) {
        params.set("include", includePattern());
      }
      if (excludePattern()) {
        params.set("exclude", excludePattern());
      }

      const response = await fsSearchContent({
        path: projectPath,
        pattern: searchQuery,
        caseSensitive: caseSensitive(),
        regex: useRegex(),
        maxResults: 1000,
        filePattern: includePattern() || undefined,
      });

      const searchResults: SearchResult[] = response.results.map((entry) => ({
        file: entry.file.replace(projectPath + "/", "").replace(projectPath + "\\", ""),
        matches: entry.matches.map((m) => ({
          line: m.line,
          column: m.column,
          text: m.text,
          matchStart: m.matchStart,
          matchEnd: m.matchEnd,
          originalText: m.text,
        })),
      }));

      batch(() => {
        setResults(searchResults);
        const expanded = new Set<string>();
        searchResults.slice(0, 5).forEach((r: SearchResult) => expanded.add(r.file));
        setExpandedFiles(expanded);
        setSelectedResultIndex(searchResults.length > 0 ? 0 : -1);
        setSelectedMatchIndex(searchResults.length > 0 && searchResults[0].matches.length > 0 ? 0 : -1);
        setHasEdits(false);
      });

      if (editorMode() && monacoEditor) {
        updateEditorContent();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      console.error("Search failed:", err);
      setSearchError("Search failed - is the server running?");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const updateEditorContent = () => {
    if (monacoEditor) {
      const content = formatResultsAsDocument(
        query(),
        results(),
        caseSensitive(),
        useRegex()
      );
      monacoEditor.setValue(content);
    }
  };

  const initializeMonacoEditor = async () => {
    if (!editorContainerRef) return;

    if (!monacoInstance) {
      monacoInstance = await MonacoManager.getInstance().ensureLoaded();
    }

    const monaco = monacoInstance;
    if (!monaco) return;

    registerSearchResultsLanguage(monaco);

    const content = formatResultsAsDocument(
      query(),
      results(),
      caseSensitive(),
      useRegex()
    );

    monacoEditor = monaco.editor.create(editorContainerRef, {
      value: content,
      language: SEARCH_RESULTS_LANGUAGE_ID,
      theme: "search-results-dark",
      readOnly: false,
      minimap: { enabled: false },
      lineNumbers: "off",
      folding: true,
      foldingStrategy: "indentation",
      wordWrap: "on",
      scrollBeyondLastLine: false,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      renderLineHighlight: "line",
      scrollbar: {
        vertical: "auto",
        horizontal: "auto",
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
      padding: { top: 12, bottom: 12 },
      automaticLayout: true,
    });

    monacoEditor.onDidChangeModelContent(() => {
      const currentContent = monacoEditor?.getValue() || "";
      const updatedResults = parseDocumentToResults(currentContent, results());
      setResults(updatedResults);

      const hasAnyEdits = updatedResults.some((r) =>
        r.matches.some((m) => m.editedText !== undefined && m.editedText !== m.originalText.trim())
      );
      setHasEdits(hasAnyEdits);
    });

    monacoEditor.addAction({
      id: "search-editor-open-file",
      label: "Open File at Line",
      keybindings: [monaco.KeyCode.Enter],
      run: () => {
        const position = monacoEditor?.getPosition();
        if (position) {
          openFileAtEditorLine(position.lineNumber);
        }
      },
    });

    monacoEditor.addAction({
      id: "search-editor-next-result",
      label: "Next Result",
      keybindings: [monaco.KeyCode.F4],
      run: () => navigateToNextResult(),
    });

    monacoEditor.addAction({
      id: "search-editor-prev-result",
      label: "Previous Result",
      keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F4],
      run: () => navigateToPrevResult(),
    });
  };

  const openFileAtEditorLine = (editorLineNumber: number) => {
    const content = monacoEditor?.getValue() || "";
    const lines = content.split("\n");

    if (editorLineNumber <= 0 || editorLineNumber > lines.length) return;

    const line = lines[editorLineNumber - 1];

    let currentFile = "";
    for (let i = editorLineNumber - 1; i >= 0; i--) {
      if (lines[i].startsWith("## ")) {
        currentFile = lines[i].slice(3).trim();
        break;
      }
    }

    if (!currentFile) return;

    const lineMatch = line.match(/^\s+(\d+):\s+│/);
    if (lineMatch) {
      const targetLine = parseInt(lineMatch[1], 10);
      openMatchInEditor(currentFile, targetLine, 1);
    } else if (line.startsWith("## ")) {
      openMatchInEditor(currentFile, 1, 1);
    }
  };

  const navigateToNextResult = () => {
    const content = monacoEditor?.getValue() || "";
    const lines = content.split("\n");
    const currentPosition = monacoEditor?.getPosition();
    const currentLine = currentPosition?.lineNumber || 1;

    for (let i = currentLine; i < lines.length; i++) {
      if (lines[i].match(/^\s+\d+:\s+│/)) {
        monacoEditor?.setPosition({ lineNumber: i + 1, column: 1 });
        monacoEditor?.revealLineInCenter(i + 1);
        return;
      }
    }

    for (let i = 0; i < currentLine - 1; i++) {
      if (lines[i].match(/^\s+\d+:\s+│/)) {
        monacoEditor?.setPosition({ lineNumber: i + 1, column: 1 });
        monacoEditor?.revealLineInCenter(i + 1);
        return;
      }
    }
  };

  const navigateToPrevResult = () => {
    const content = monacoEditor?.getValue() || "";
    const lines = content.split("\n");
    const currentPosition = monacoEditor?.getPosition();
    const currentLine = currentPosition?.lineNumber || 1;

    for (let i = currentLine - 2; i >= 0; i--) {
      if (lines[i].match(/^\s+\d+:\s+│/)) {
        monacoEditor?.setPosition({ lineNumber: i + 1, column: 1 });
        monacoEditor?.revealLineInCenter(i + 1);
        return;
      }
    }

    for (let i = lines.length - 1; i >= currentLine; i--) {
      if (lines[i].match(/^\s+\d+:\s+│/)) {
        monacoEditor?.setPosition({ lineNumber: i + 1, column: 1 });
        monacoEditor?.revealLineInCenter(i + 1);
        return;
      }
    }
  };

  const destroyMonacoEditor = () => {
    if (monacoEditor) {
      monacoEditor?.dispose?.();
      monacoEditor = null;
    }
  };

  createEffect(() => {
    if (editorMode()) {
      requestAnimationFrame(() => {
        initializeMonacoEditor();
      });
    } else {
      destroyMonacoEditor();
    }
  });

  createEffect(() => {
    const q = query();
    clearTimeout(searchTimeout);

    if (q.length >= 2) {
      searchTimeout = window.setTimeout(() => {
        performSearch(q);
      }, 300);
    }
  });

  createEffect(() => {
    if (props.initialQuery && props.initialQuery !== query()) {
      setQuery(props.initialQuery);
    }
    if (props.initialResults && props.initialResults !== results()) {
      setResults(props.initialResults);
    }
  });

  // Load .code-search file if provided
  createEffect(() => {
    if (props.codeSearchFilePath && isCodeSearchFile(props.codeSearchFilePath)) {
      loadCodeSearchFile(props.codeSearchFilePath);
    }
  });

  const toggleFile = (file: string) => {
    const expanded = new Set(expandedFiles());
    if (expanded.has(file)) {
      expanded.delete(file);
    } else {
      expanded.add(file);
    }
    setExpandedFiles(expanded);
  };

  const openMatchInEditor = async (file: string, line: number, column: number) => {
    const projectPath = getProjectPath();
    const fullPath = projectPath ? `${projectPath}/${file}` : file;
    await openFile(fullPath);

    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("goto-line", {
          detail: { line, column },
        })
      );
    }, 100);
  };

  const excludeResult = (fileIndex: number) => {
    setResults((prev) =>
      prev.map((r, i) => (i === fileIndex ? { ...r, excluded: true } : r))
    );
    if (editorMode()) {
      updateEditorContent();
    }
  };

  const excludeMatch = (fileIndex: number, matchIndex: number) => {
    setResults((prev) =>
      prev.map((r, i) => {
        if (i !== fileIndex) return r;
        const newMatches = r.matches.filter((_, mi) => mi !== matchIndex);
        return { ...r, matches: newMatches };
      })
    );
    if (editorMode()) {
      updateEditorContent();
    }
  };

  const clearResults = () => {
    batch(() => {
      setResults([]);
      setExpandedFiles(new Set<string>());
      setSelectedResultIndex(-1);
      setSelectedMatchIndex(-1);
      setHasEdits(false);
    });
    if (editorMode() && monacoEditor) {
      monacoEditor.setValue("");
    }
  };

  const exportResults = async () => {
    const content = formatResultsAsDocument(
      query(),
      results(),
      caseSensitive(),
      useRegex()
    );

    try {
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `search-results-${query().replace(/[^a-z0-9]/gi, "_")}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      window.dispatchEvent(
        new CustomEvent("notification", {
          detail: { type: "success", message: "Results exported successfully" },
        })
      );
    } catch (err) {
      console.error("Failed to export results:", err);
      window.dispatchEvent(
        new CustomEvent("notification", {
          detail: { type: "error", message: "Failed to export results" },
        })
      );
    }
  };

  // Save as .code-search file
  const saveAsCodeSearch = async () => {
    const searchResults = results().map(r => ({
      file: r.file,
      matches: r.matches.map(m => ({
        line: m.line,
        column: m.column,
        text: m.text,
        matchStart: m.matchStart,
        matchEnd: m.matchEnd,
      })),
    }));
    
    const content = serializeToCodeSearch({
      query: query(),
      isRegex: useRegex(),
      isCaseSensitive: caseSensitive(),
      isWholeWord: wholeWord(),
      includePattern: includePattern(),
      excludePattern: excludePattern(),
      contextLines: 0,
      results: searchResults,
    });

    const filename = generateCodeSearchFilename(query());
    const projectPath = getProjectPath();
    
    if (projectPath) {
      try {
        await fsWriteFile(`${projectPath}/${filename}`, content);
        window.dispatchEvent(
          new CustomEvent("notification", {
            detail: { type: "success", message: `Saved as ${filename}` },
          })
        );
      } catch (err) {
        console.error("Failed to save .code-search file:", err);
        window.dispatchEvent(
          new CustomEvent("notification", {
            detail: { type: "error", message: "Failed to save search results" },
          })
        );
      }
    }
  };

  // Load .code-search file
  const loadCodeSearchFile = async (filePath: string) => {
    try {
      const content = await fsReadFile(filePath);
      const parsed = parseCodeSearchFile(content);
      
      // Convert to SearchResult format with originalText
      const loadedResults: SearchResult[] = parsed.results.map(r => ({
        file: r.file,
        matches: r.matches.map(m => ({
          ...m,
          originalText: m.text,
        })),
      }));
      
      batch(() => {
        setQuery(parsed.query);
        setCaseSensitive(parsed.isCaseSensitive);
        setUseRegex(parsed.isRegex);
        setWholeWord(parsed.isWholeWord);
        setIncludePattern(parsed.includePattern);
        setExcludePattern(parsed.excludePattern);
        setResults(loadedResults);
        
        // Auto-expand first 5 files
        const expanded = new Set<string>();
        loadedResults.slice(0, 5).forEach((r) => expanded.add(r.file));
        setExpandedFiles(expanded);
        setHasEdits(false);
      });
      
      if (editorMode()) {
        updateEditorContent();
      }
      
      window.dispatchEvent(
        new CustomEvent("notification", {
          detail: { type: "success", message: "Loaded search results" },
        })
      );
    } catch (err) {
      console.error("Failed to load .code-search file:", err);
      window.dispatchEvent(
        new CustomEvent("notification", {
          detail: { type: "error", message: "Failed to load search results" },
        })
      );
    }
  };

  // Copy all results handler
  const handleCopyAllResults = async (format: 'plain' | 'markdown' | 'json') => {
    const searchResults = results().map(r => ({
      file: r.file,
      matches: r.matches.map(m => ({
        line: m.line,
        column: m.column,
        text: m.text,
        matchStart: m.matchStart,
        matchEnd: m.matchEnd,
      })),
    }));
    
    await copyAllResults(searchResults, {
      includeLineNumbers: true,
      includeFilePaths: true,
      format,
    });
    
    window.dispatchEvent(
      new CustomEvent("notification", {
        detail: { type: "success", message: `Copied results as ${format}` },
      })
    );
  };

  const applyChanges = async () => {
    const editedResults = results().filter((r) =>
      r.matches.some((m) => m.editedText !== undefined && m.editedText !== m.originalText.trim())
    );

    if (editedResults.length === 0) {
      window.dispatchEvent(
        new CustomEvent("notification", {
          detail: { type: "info", message: "No changes to apply" },
        })
      );
      return;
    }

    setApplyingChanges(true);

    let successCount = 0;
    let failCount = 0;
    const projectPath = getProjectPath();

    for (const result of editedResults) {
      const fullPath = projectPath ? `${projectPath}/${result.file}` : result.file;

      try {
        const content = await fsReadFile(fullPath);
        const lines = content.split("\n");

        for (const match of result.matches) {
          if (match.editedText !== undefined && match.editedText !== match.originalText.trim()) {
            const lineIndex = match.line - 1;
            if (lineIndex >= 0 && lineIndex < lines.length) {
              const originalLine = lines[lineIndex];
              const leadingWhitespace = originalLine.match(/^(\s*)/)?.[1] || "";
              lines[lineIndex] = leadingWhitespace + match.editedText;
            }
          }
        }

        const newContent = lines.join("\n");

        await fsWriteFile(fullPath, newContent);
        successCount++;

        const openEditorFile = editorState.openFiles.find((f) => f.path === fullPath);
        if (openEditorFile) {
          updateFileContent(openEditorFile.id, newContent);
        }
      } catch (err) {
        console.error(`Failed to apply changes to ${result.file}:`, err);
        failCount++;
      }
    }

    setApplyingChanges(false);

    if (failCount > 0) {
      window.dispatchEvent(
        new CustomEvent("notification", {
          detail: {
            type: "warning",
            message: `Applied changes to ${successCount} files, ${failCount} failed`,
          },
        })
      );
    } else {
      window.dispatchEvent(
        new CustomEvent("notification", {
          detail: {
            type: "success",
            message: `Applied changes to ${successCount} files`,
          },
        })
      );
    }

    performSearch(query());
  };

  const copyToClipboard = async (text: string) => {
    try {
      await writeText(text);
      window.dispatchEvent(
        new CustomEvent("notification", {
          detail: { type: "success", message: "Copied to clipboard" },
        })
      );
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        window.dispatchEvent(
          new CustomEvent("notification", {
            detail: { type: "success", message: "Copied to clipboard" },
          })
        );
      } catch (err) {
        console.error("Failed to copy:", err);
        window.dispatchEvent(
          new CustomEvent("notification", {
            detail: { type: "error", message: "Failed to copy to clipboard" },
          })
        );
      }
    }
  };

  const handleContextMenu = (
    e: MouseEvent,
    file: string,
    match: SearchMatch | null,
    resultIndex: number,
    matchIndex: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetFile: file,
      targetMatch: match,
      targetResultIndex: resultIndex,
      targetMatchIndex: matchIndex,
    });
  };

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.isOpen) return;

    if (e.key === "Escape") {
      e.preventDefault();
      if (contextMenu().visible) {
        closeContextMenu();
      } else if (loading()) {
        cancelSearch();
      } else {
        props.onClose();
      }
      return;
    }

    if (!editorMode()) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const visible = visibleResults();
        if (visible.length > 0 && selectedResultIndex() >= 0) {
          const result = visible[selectedResultIndex()];
          if (result && selectedMatchIndex() >= 0 && result.matches[selectedMatchIndex()]) {
            const match = result.matches[selectedMatchIndex()];
            openMatchInEditor(result.file, match.line, match.column);
          }
        }
        return;
      }

      if (e.key === "F4") {
        e.preventDefault();
        if (e.shiftKey) {
          navigatePrevMatch();
        } else {
          navigateNextMatch();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        navigateNextMatch();
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        navigatePrevMatch();
        return;
      }
    }
  };

  const navigateNextMatch = () => {
    const visible = visibleResults();
    if (visible.length === 0) return;

    let newResultIndex = selectedResultIndex();
    let newMatchIndex = selectedMatchIndex() + 1;

    if (newResultIndex < 0) {
      newResultIndex = 0;
      newMatchIndex = 0;
    } else if (newMatchIndex >= visible[newResultIndex].matches.length) {
      newResultIndex++;
      newMatchIndex = 0;
      if (newResultIndex >= visible.length) {
        newResultIndex = 0;
      }
    }

    const expanded = new Set(expandedFiles());
    expanded.add(visible[newResultIndex].file);
    setExpandedFiles(expanded);

    batch(() => {
      setSelectedResultIndex(newResultIndex);
      setSelectedMatchIndex(newMatchIndex);
    });
  };

  const navigatePrevMatch = () => {
    const visible = visibleResults();
    if (visible.length === 0) return;

    let newResultIndex = selectedResultIndex();
    let newMatchIndex = selectedMatchIndex() - 1;

    if (newResultIndex < 0) {
      newResultIndex = visible.length - 1;
      newMatchIndex = visible[newResultIndex].matches.length - 1;
    } else if (newMatchIndex < 0) {
      newResultIndex--;
      if (newResultIndex < 0) {
        newResultIndex = visible.length - 1;
      }
      newMatchIndex = visible[newResultIndex].matches.length - 1;
    }

    const expanded = new Set(expandedFiles());
    expanded.add(visible[newResultIndex].file);
    setExpandedFiles(expanded);

    batch(() => {
      setSelectedResultIndex(newResultIndex);
      setSelectedMatchIndex(newMatchIndex);
    });
  };

  const highlightMatch = (text: string, start: number, end: number): JSX.Element => {
    const safeStart = Math.max(0, Math.min(start, text.length));
    const safeEnd = Math.max(safeStart, Math.min(end, text.length));

    return (
      <>
        <span>{text.slice(0, safeStart)}</span>
        <span
          style={{ 
            padding: "0 2px",
            "border-radius": "var(--cortex-radius-sm)",
            "font-weight": "500",
            background: "var(--accent-primary)", 
            color: "white" 
          }}
        >
          {text.slice(safeStart, safeEnd)}
        </span>
        <span>{text.slice(safeEnd)}</span>
      </>
    );
  };

  const getFileName = (path: string) => {
    const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
  };

  const getFileDirectory = (path: string) => {
    const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    return lastSlash > 0 ? path.slice(0, lastSlash) : "";
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("click", closeContextMenu);

    setTimeout(() => {
      inputRef?.focus();
    }, 50);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown, true);
    window.removeEventListener("click", closeContextMenu);
    cancelSearch();
    clearTimeout(searchTimeout);
    destroyMonacoEditor();
  });

  const ToggleButton = (props: {
    active: boolean;
    onClick: () => void;
    title: string;
    children: string;
  }) => (
    <button
      style={{
        padding: "4px 8px",
        "font-size": "11px",
        "border-radius": "var(--cortex-radius-md)",
        transition: "all 0.15s ease",
        "font-weight": "500",
        border: "none",
        cursor: "pointer",
        background: props.active ? "var(--accent-primary)" : "var(--surface-active)",
        color: props.active ? "white" : "var(--text-weak)",
      }}
      onClick={props.onClick}
      title={props.title}
    >
      {props.children}
    </button>
  );

  return (
    <Show when={props.isOpen}>
      <div
        style={{
          position: "fixed",
          inset: "0",
          "z-index": "100",
          display: "flex",
          "animation-duration": "150ms"
        }}
        onClick={props.onClose}
      >
        <div style={{ position: "absolute", inset: "0", background: "rgba(0, 0, 0, 0.5)" }} />

        <div
          style={{
            position: "relative",
            "margin-left": "auto",
            width: "100%",
            "max-width": "700px",
            height: "100%",
            display: "flex",
            "flex-direction": "column",
            "box-shadow": "-10px 0 40px -10px rgba(0, 0, 0, 0.5)",
            background: "var(--surface-raised)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              padding: "0 16px",
              height: "48px",
              "border-bottom": "1px solid var(--border-weak)",
              "flex-shrink": "0"
            }}
          >
            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
              <Icon name="magnifying-glass" style={{ width: "16px", height: "16px", color: "var(--text-weak)" }} />
              <span style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-base)" }}>
                Search Editor
              </span>
              <Show when={hasEdits()}>
                <span
                  style={{
                    padding: "2px 6px",
                    "font-size": "10px",
                    "border-radius": "var(--cortex-radius-md)",
                    "font-weight": "500",
                    background: "var(--status-warning-bg)", 
                    color: "var(--status-warning)"
                  }}
                >
                  {editedMatchesCount()} edits
                </span>
              </Show>
            </div>

            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
              <button
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "6px",
                  padding: "4px 8px",
                  "font-size": "11px",
                  "border-radius": "var(--cortex-radius-md)",
                  transition: "all 0.15s ease",
                  border: "none",
                  cursor: "pointer",
                  background: editorMode() ? "var(--accent-primary)" : "var(--surface-active)",
                  color: editorMode() ? "white" : "var(--text-weak)",
                }}
                onClick={() => setEditorMode(!editorMode())}
                title="Toggle editor mode"
              >
                <Icon name="pen-to-square" style={{ width: "12px", height: "12px" }} />
                Editor
              </button>

              {/* Save as .code-search */}
              <button
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "6px",
                  padding: "4px 8px",
                  "font-size": "11px",
                  "border-radius": "var(--cortex-radius-md)",
                  transition: "all 0.15s ease",
                  border: "none",
                  cursor: visibleResults().length > 0 ? "pointer" : "not-allowed",
                  background: "var(--surface-active)",
                  color: visibleResults().length > 0 ? "var(--text-weak)" : "var(--text-weaker)",
                  opacity: visibleResults().length > 0 ? 1 : 0.5,
                }}
                onClick={saveAsCodeSearch}
                title="Save as .code-search file"
                disabled={visibleResults().length === 0}
              >
                <Icon name="floppy-disk" style={{ width: "12px", height: "12px" }} />
                Save
              </button>

              {/* Copy dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "6px",
                    padding: "4px 8px",
                    "font-size": "11px",
                    "border-radius": "var(--cortex-radius-md)",
                    transition: "all 0.15s ease",
                    border: "none",
                    cursor: visibleResults().length > 0 ? "pointer" : "not-allowed",
                    background: "var(--surface-active)",
                    color: visibleResults().length > 0 ? "var(--text-weak)" : "var(--text-weaker)",
                    opacity: visibleResults().length > 0 ? 1 : 0.5,
                  }}
                  onClick={() => {
                    if (visibleResults().length > 0) {
                      handleCopyAllResults('plain');
                    }
                  }}
                  title="Copy all results"
                  disabled={visibleResults().length === 0}
                >
                  <Icon name="copy" style={{ width: "12px", height: "12px" }} />
                  Copy
                </button>
              </div>

              <Show when={loading()}>
                <Icon name="spinner" style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite", color: "var(--text-weak)" }} />
              </Show>

              <button
                style={{
                  padding: "6px",
                  "border-radius": "var(--cortex-radius-md)",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  transition: "background 0.15s ease"
                }}
                onClick={props.onClose}
                title="Close (Escape)"
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <Icon name="xmark" style={{ width: "16px", height: "16px", color: "var(--text-weak)" }} />
              </button>
            </div>
          </div>

          <div style={{ padding: "12px", "border-bottom": "1px solid var(--border-weak)", "flex-shrink": "0" }}>
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: "8px",
                padding: "0 12px",
                height: "36px",
                "border-radius": "var(--cortex-radius-md)",
                background: "var(--background-base)",
                border: searchError() ? "1px solid var(--status-error)" : "1px solid transparent",
              }}
            >
              <Icon name="magnifying-glass" style={{ width: "16px", height: "16px", "flex-shrink": "0", color: "var(--text-weak)" }} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search for text..."
                style={{
                  flex: "1",
                  background: "transparent",
                  outline: "none",
                  border: "none",
                  "font-size": "13px",
                  "min-width": "0",
                  color: "var(--text-base)"
                }}
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
              />
              <Show when={loading()}>
                <Icon name="spinner" style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite", color: "var(--text-weak)" }} />
              </Show>
            </div>

            <div style={{ display: "flex", "align-items": "center", gap: "4px", "margin-top": "8px" }}>
              <ToggleButton
                active={caseSensitive()}
                onClick={() => setCaseSensitive(!caseSensitive())}
                title="Case Sensitive"
              >
                Aa
              </ToggleButton>
              <ToggleButton
                active={wholeWord()}
                onClick={() => setWholeWord(!wholeWord())}
                title="Whole Word"
              >
                W
              </ToggleButton>
              <ToggleButton
                active={useRegex()}
                onClick={() => setUseRegex(!useRegex())}
                title="Regular Expression"
              >
                .*
              </ToggleButton>
            </div>

            <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "8px", "margin-top": "8px" }}>
              <input
                type="text"
                placeholder="Include: *.ts, src/**"
                style={{
                  padding: "6px 8px",
                  "border-radius": "var(--cortex-radius-md)",
                  "font-size": "11px",
                  outline: "none",
                  border: "none",
                  background: "var(--background-base)",
                  color: "var(--text-base)",
                }}
                value={includePattern()}
                onInput={(e) => setIncludePattern(e.currentTarget.value)}
              />
              <input
                type="text"
                placeholder="Exclude: node_modules, dist"
                style={{
                  padding: "6px 8px",
                  "border-radius": "var(--cortex-radius-md)",
                  "font-size": "11px",
                  outline: "none",
                  border: "none",
                  background: "var(--background-base)",
                  color: "var(--text-base)",
                }}
                value={excludePattern()}
                onInput={(e) => setExcludePattern(e.currentTarget.value)}
              />
            </div>
          </div>

          <Show when={searchError()}>
            <div
              style={{
                padding: "8px 16px",
                "font-size": "12px",
                "border-bottom": "1px solid var(--border-weak)",
                "flex-shrink": "0",
                color: "var(--status-error)",
                background: "var(--status-error-bg)",
              }}
            >
              {searchError()}
            </div>
          </Show>

          <Show when={visibleResults().length > 0 || (query().length >= 2 && !loading())}>
            <div
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                padding: "8px 16px",
                "font-size": "11px",
                "border-bottom": "1px solid var(--border-weak)",
                "flex-shrink": "0",
                color: "var(--text-weak)",
              }}
            >
              <span>
                {visibleResults().length > 0
                  ? `${totalMatches()} result${totalMatches() !== 1 ? "s" : ""} in ${visibleResults().length} file${visibleResults().length !== 1 ? "s" : ""}`
                  : "No results found"}
              </span>
              <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                <Show when={hasEdits()}>
                  <button
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "6px",
                      padding: "4px 8px",
                      "font-size": "11px",
                      "border-radius": "var(--cortex-radius-md)",
                      transition: "all 0.15s ease",
                      "font-weight": "500",
                      border: "none",
                      cursor: "pointer",
                      background: "var(--accent-primary)",
                      color: "white",
                    }}
                    onClick={applyChanges}
                    disabled={applyingChanges()}
                    title="Apply all edits to files"
                  >
                    <Show when={applyingChanges()} fallback={<Icon name="floppy-disk" style={{ width: "12px", height: "12px" }} />}>
                      <Icon name="spinner" style={{ width: "12px", height: "12px", animation: "spin 1s linear infinite" }} />
                    </Show>
                    Apply Changes
                  </button>
                </Show>
                <button
                  style={{
                    padding: "6px",
                    "border-radius": "var(--cortex-radius-md)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    transition: "background 0.15s ease"
                  }}
                  onClick={exportResults}
                  title="Export results"
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <Icon name="download" style={{ width: "14px", height: "14px", color: "var(--text-weak)" }} />
                </button>
                <button
                  style={{
                    padding: "6px",
                    "border-radius": "var(--cortex-radius-md)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    transition: "background 0.15s ease"
                  }}
                  onClick={clearResults}
                  title="Clear results"
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <Icon name="trash" style={{ width: "14px", height: "14px", color: "var(--text-weak)" }} />
                </button>
              </div>
            </div>
          </Show>

          <Show when={editorMode()}>
            <div
              ref={editorContainerRef}
              style={{ flex: "1", overflow: "hidden", background: "var(--ui-panel-bg)" }}
            />
          </Show>

          <Show when={!editorMode()}>
            <div style={{ flex: "1", "overflow-y": "auto", "overscroll-behavior": "contain" }}>
              <Show when={query().length < 2 && visibleResults().length === 0}>
                <div style={{ padding: "32px 16px", "text-align": "center" }}>
                  <p style={{ "font-size": "13px", color: "var(--text-weak)" }}>
                    Type at least 2 characters to search
                  </p>
                </div>
              </Show>

              <For each={visibleResults()}>
                {(result, resultIndex) => (
                  <div
                    style={{ "border-bottom": "1px solid var(--border-weak)" }}
                    onContextMenu={(e) =>
                      handleContextMenu(e, result.file, null, resultIndex(), -1)
                    }
                  >
                    <button
                      style={{
                        width: "100%",
                        display: "flex",
                        "align-items": "center",
                        gap: "8px",
                        padding: "0 16px",
                        height: "36px",
                        "text-align": "left",
                        transition: "background 0.15s ease",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      onClick={() => toggleFile(result.file)}
                    >
                      <span style={{ "flex-shrink": "0", color: "var(--text-weak)" }}>
                        {expandedFiles().has(result.file) ? (
                          <Icon name="chevron-down" style={{ width: "14px", height: "14px" }} />
                        ) : (
                          <Icon name="chevron-right" style={{ width: "14px", height: "14px" }} />
                        )}
                      </span>
                      <Icon name="file" style={{ width: "14px", height: "14px", "flex-shrink": "0", color: "var(--text-weak)" }} />
                      <span
                        style={{
                          "font-size": "12px",
                          "font-weight": "500",
                          overflow: "hidden",
                          "text-overflow": "ellipsis",
                          "white-space": "nowrap",
                          color: "var(--text-base)"
                        }}
                      >
                        {getFileName(result.file)}
                      </span>
                      <Show when={getFileDirectory(result.file)}>
                        <span
                          style={{
                            "font-size": "11px",
                            overflow: "hidden",
                            "text-overflow": "ellipsis",
                            "white-space": "nowrap",
                            color: "var(--text-weaker)"
                          }}
                        >
                          {getFileDirectory(result.file)}
                        </span>
                      </Show>
                      <div style={{ "margin-left": "auto", "flex-shrink": "0" }}>
                        <span
                          style={{
                            "font-size": "10px",
                            padding: "2px 6px",
                            "border-radius": "var(--cortex-radius-md)",
                            "font-family": "'JetBrains Mono', monospace",
                            background: "var(--surface-active)",
                            color: "var(--text-weak)",
                          }}
                        >
                          {result.matches.length}
                        </span>
                      </div>
                    </button>

                    <Show when={expandedFiles().has(result.file)}>
                      <div style={{ "padding-bottom": "4px" }}>
                        <For each={result.matches}>
                          {(match, matchIndex) => (
                            <button
                              style={{
                                width: "100%",
                                display: "flex",
                                "align-items": "flex-start",
                                gap: "12px",
                                padding: "6px 16px",
                                "text-align": "left",
                                transition: "background 0.15s ease",
                                border: "none",
                                cursor: "pointer",
                                background: selectedResultIndex() === resultIndex() && selectedMatchIndex() === matchIndex()
                                  ? "rgba(255, 255, 255, 0.1)"
                                  : "transparent"
                              }}
                              onClick={() => openMatchInEditor(result.file, match.line, match.column)}
                              onContextMenu={(e) =>
                                handleContextMenu(
                                  e,
                                  result.file,
                                  match,
                                  resultIndex(),
                                  matchIndex()
                                )
                              }
                              onMouseEnter={(e) => { 
                                if (!(selectedResultIndex() === resultIndex() && selectedMatchIndex() === matchIndex())) {
                                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"; 
                                }
                              }}
                              onMouseLeave={(e) => { 
                                if (!(selectedResultIndex() === resultIndex() && selectedMatchIndex() === matchIndex())) {
                                  e.currentTarget.style.background = "transparent"; 
                                }
                              }}
                            >
                              <span
                                style={{
                                  "flex-shrink": "0",
                                  width: "32px",
                                  "text-align": "right",
                                  "font-size": "11px",
                                  "font-family": "'JetBrains Mono', monospace",
                                  color: "var(--text-weaker)"
                                }}
                              >
                                {match.line}
                              </span>
                              <span
                                style={{
                                  "font-size": "12px",
                                  "font-family": "'JetBrains Mono', monospace",
                                  overflow: "hidden",
                                  "text-overflow": "ellipsis",
                                  "white-space": "nowrap",
                                  "line-height": "1.5",
                                  flex: "1",
                                  color: "var(--text-weak)"
                                }}
                              >
                                {highlightMatch(
                                  match.text.trim(),
                                  match.matchStart,
                                  match.matchEnd
                                )}
                              </span>
                              <Show when={match.editedText !== undefined}>
                                <Icon name="check"
                                  style={{ width: "12px", height: "12px", "flex-shrink": "0", color: "var(--status-success)" }}
                                />
                              </Show>
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              padding: "8px 16px",
              "font-size": "10px",
              "border-top": "1px solid var(--border-weak)",
              "flex-shrink": "0",
              background: "var(--background-base)",
              color: "var(--text-weaker)",
            }}
          >
            <span>
              <kbd style={{ "font-family": "'JetBrains Mono', monospace" }}>Enter</kbd> open •{" "}
              <kbd style={{ "font-family": "'JetBrains Mono', monospace" }}>F4</kbd> next •{" "}
              <kbd style={{ "font-family": "'JetBrains Mono', monospace" }}>Shift+F4</kbd> prev
            </span>
            <span>
              <kbd style={{ "font-family": "'JetBrains Mono', monospace" }}>Esc</kbd> close
            </span>
          </div>
        </div>

        <Show when={contextMenu().visible}>
          <div
            style={{
              position: "fixed",
              "z-index": "200",
              "min-width": "180px",
              "border-radius": "var(--cortex-radius-md)",
              "box-shadow": "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              overflow: "hidden",
              padding: "4px 0",
              left: `${contextMenu().x}px`,
              top: `${contextMenu().y}px`,
              background: "var(--surface-raised)",
              border: "1px solid var(--border-weak)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{
                width: "100%",
                display: "flex",
                "align-items": "center",
                gap: "8px",
                padding: "8px 12px",
                "font-size": "12px",
                "text-align": "left",
                transition: "background 0.15s ease",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--text-base)"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              onClick={() => {
                if (contextMenu().targetFile) {
                  const match = contextMenu().targetMatch;
                  openMatchInEditor(
                    contextMenu().targetFile!,
                    match?.line || 1,
                    match?.column || 1
                  );
                }
                closeContextMenu();
              }}
            >
              <Icon name="arrow-up-right-from-square" style={{ width: "14px", height: "14px", color: "var(--text-weak)" }} />
              Open File
            </button>

            <button
              style={{
                width: "100%",
                display: "flex",
                "align-items": "center",
                gap: "8px",
                padding: "8px 12px",
                "font-size": "12px",
                "text-align": "left",
                transition: "background 0.15s ease",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--text-base)"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              onClick={() => {
                if (contextMenu().targetFile) {
                  const projectPath = getProjectPath();
                  const fullPath = projectPath
                    ? `${projectPath}/${contextMenu().targetFile}`
                    : contextMenu().targetFile!;
                  copyToClipboard(fullPath);
                }
                closeContextMenu();
              }}
            >
                <Icon name="copy" style={{ width: "14px", height: "14px", color: "var(--text-weak)" }} />
              Copy Path
            </button>

            <Show when={contextMenu().targetMatch}>
              <button
                style={{
                  width: "100%",
                  display: "flex",
                  "align-items": "center",
                  gap: "8px",
                  padding: "8px 12px",
                  "font-size": "12px",
                  "text-align": "left",
                  transition: "background 0.15s ease",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--text-base)"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                onClick={() => {
                  if (contextMenu().targetMatch) {
                    copyToClipboard(contextMenu().targetMatch!.text);
                  }
                  closeContextMenu();
                }}
              >
              <Icon name="copy" style={{ width: "14px", height: "14px", color: "var(--text-weak)" }} />
                Copy Line
              </button>
            </Show>

            <div style={{ height: "1px", margin: "4px 0", background: "var(--border-weak)" }} />

            <Show when={contextMenu().targetMatchIndex >= 0}>
              <button
                style={{
                  width: "100%",
                  display: "flex",
                  "align-items": "center",
                  gap: "8px",
                  padding: "8px 12px",
                  "font-size": "12px",
                  "text-align": "left",
                  transition: "background 0.15s ease",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--status-error)"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                onClick={() => {
                  excludeMatch(contextMenu().targetResultIndex, contextMenu().targetMatchIndex);
                  closeContextMenu();
                }}
              >
                <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
                Exclude Match
              </button>
            </Show>

            <button
              style={{
                width: "100%",
                display: "flex",
                "align-items": "center",
                gap: "8px",
                padding: "8px 12px",
                "font-size": "12px",
                "text-align": "left",
                transition: "background 0.15s ease",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--status-error)"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              onClick={() => {
                excludeResult(contextMenu().targetResultIndex);
                closeContextMenu();
              }}
            >
              <Icon name="trash" style={{ width: "14px", height: "14px" }} />
              Exclude File
            </button>
          </div>
        </Show>
      </div>
    </Show>
  );
}

export function useSearchEditor() {
  const [isOpen, setIsOpen] = createSignal(false);
  const [initialQuery, setInitialQuery] = createSignal("");
  const [initialResults, setInitialResults] = createSignal<SearchResult[]>([]);
  const [codeSearchFilePath, setCodeSearchFilePath] = createSignal<string | undefined>(undefined);

  const openSearchEditor = (query?: string, results?: SearchResult[]) => {
    if (query) setInitialQuery(query);
    if (results) setInitialResults(results);
    setCodeSearchFilePath(undefined);
    setIsOpen(true);
  };

  const openSearchFile = (filePath: string) => {
    setInitialQuery("");
    setInitialResults([]);
    setCodeSearchFilePath(filePath);
    setIsOpen(true);
  };

  const closeSearchEditor = () => {
    setIsOpen(false);
    setCodeSearchFilePath(undefined);
  };

  // Listen for event to open search editor
  onMount(() => {
    const handleOpen = () => openSearchEditor();
    window.addEventListener("search:open-editor", handleOpen);
    
    onCleanup(() => {
      window.removeEventListener("search:open-editor", handleOpen);
    });
  });

  return {
    isOpen,
    initialQuery,
    initialResults,
    codeSearchFilePath,
    openSearchEditor,
    openSearchFile,
    closeSearchEditor,
    SearchEditorComponent: () => (
      <SearchEditor
        isOpen={isOpen()}
        onClose={closeSearchEditor}
        initialQuery={initialQuery()}
        initialResults={initialResults()}
        codeSearchFilePath={codeSearchFilePath()}
      />
    ),
  };
}