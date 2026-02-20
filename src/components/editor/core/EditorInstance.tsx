import {
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
} from "solid-js";
import type { Accessor } from "solid-js";
import { useEditor } from "@/context/EditorContext";
import type { OpenFile } from "@/context/EditorContext";
import { useVim } from "@/context/VimContext";
import { useSettings } from "@/context/SettingsContext";
import type * as Monaco from "monaco-editor";
import {
  MonacoManager,
  LARGE_FILE_THRESHOLDS,
  type LargeFileSettings,
} from "@/utils/monacoManager";
import {
  registerAllProviders,
  updateFormatOnTypeSettings,
  updateUnicodeHighlightSettings,
  updateLinkedEditingEnabled,
} from "@/components/editor/modules/EditorLSP";
import { estimateLineCount } from "@/components/editor/modules/EditorUtils";
import { LANGUAGE_MAP } from "@/components/editor/modules/EditorTypes";
import { setupFormatOnPaste } from "@/components/editor/modules/EditorActions";

let providersRegistered = false;
let monacoInstance: typeof Monaco | null = null;
let linkedEditingEnabled = true;
let formatOnPasteEnabled = false;
let formatOnPasteDisposable: Monaco.IDisposable | null = null;

export function updateFormatOnPasteEnabled(enabled: boolean): void {
  formatOnPasteEnabled = enabled;
}

export function getFormatOnPasteEnabled(): boolean {
  return formatOnPasteEnabled;
}

export function getLinkedEditingEnabled(): boolean {
  return linkedEditingEnabled;
}

export function setLinkedEditingEnabledState(enabled: boolean): void {
  linkedEditingEnabled = enabled;
  updateLinkedEditingEnabled(enabled);
}

export function getMonacoInstance(): typeof Monaco | null {
  return monacoInstance;
}

export interface CreateEditorInstanceResult {
  editor: Accessor<Monaco.editor.IStandaloneCodeEditor | null>;
  monaco: Accessor<typeof Monaco | null>;
  containerRef: HTMLDivElement | undefined;
  setContainerRef: (el: HTMLDivElement) => void;
  isLoading: Accessor<boolean>;
  activeFile: Accessor<OpenFile | undefined>;
  editorInstance: () => Monaco.editor.IStandaloneCodeEditor | null;
}

export function createEditorInstance(props: {
  file?: Accessor<OpenFile | undefined>;
  groupId?: string;
  onEditorReady?: (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
    isNewEditor: boolean,
  ) => void;
}): CreateEditorInstanceResult {
  const { state } = useEditor();
  const vim = useVim();
  const {
    state: settingsState,
    getEffectiveEditorSettings,
  } = useSettings();

  let containerRef: HTMLDivElement | undefined;
  let editorRef: Monaco.editor.IStandaloneCodeEditor | null = null;
  let isDisposed = false;
  let currentFileId: string | null = null;
  let currentFilePath: string | null = null;
  let editorInitialized = false;

  const [isLoading, setIsLoading] = createSignal(true);
  const [currentEditor, setCurrentEditor] =
    createSignal<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [currentMonaco, setCurrentMonaco] = createSignal<typeof Monaco | null>(
    null,
  );

  const activeFile = createMemo(() => {
    const propsFile = props.file?.();
    if (propsFile) return propsFile;
    const activeId = state.activeFileId;
    return state.openFiles.find((f) => f.id === activeId);
  });

  const monacoManager = MonacoManager.getInstance();

  onMount(async () => {
    const file = activeFile();
    if (!file) {
      setIsLoading(false);
      return;
    }

    if (!monacoManager.isLoaded()) {
      try {
        const monaco = await monacoManager.ensureLoaded();
        monacoInstance = monaco;
        setCurrentMonaco(monaco);

        if (!providersRegistered) {
          providersRegistered = true;
          requestAnimationFrame(() => {
            registerAllProviders(monaco);
          });
        }
      } catch (error) {
        console.error("Failed to load Monaco editor:", error);
        setIsLoading(false);
        return;
      }
    } else {
      monacoInstance = monacoManager.getMonaco();
      setCurrentMonaco(monacoInstance);
    }

    setIsLoading(false);
  });

  createEffect(() => {
    if (isDisposed) return;

    const effectStart = performance.now();
    const file = activeFile();
    const fileId = file?.id || null;
    const filePath = file?.path || null;

    if (!containerRef || isLoading()) return;

    if (!monacoManager.isLoaded() && file) {
      setIsLoading(true);
      monacoManager
        .ensureLoaded()
        .then((monaco) => {
          monacoInstance = monaco;
          setCurrentMonaco(monaco);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load Monaco editor:", err);
          setIsLoading(false);
        });
      return;
    }

    if (!monacoInstance && monacoManager.isLoaded()) {
      monacoInstance = monacoManager.getMonaco();
      setCurrentMonaco(monacoInstance);
    }

    if (!monacoInstance) return;

    if (fileId !== currentFileId || filePath !== currentFilePath) {
      console.debug(
        `[CodeEditor] Effect triggered for file change: ${file?.name || "null"}`,
      );
      const modelStart = performance.now();

      if (currentFilePath && currentFilePath !== file?.path) {
        monacoManager.scheduleModelDisposal(currentFilePath);
      }

      currentFileId = fileId;
      currentFilePath = file?.path || null;

      if (!file) {
        if (editorRef) {
          monacoManager.releaseEditor(editorRef);
          editorRef = null;
          setCurrentEditor(null);
        }
        return;
      }

      monacoManager.cancelModelDisposal(file.path);

      const monacoLanguage = LANGUAGE_MAP[file.language] || "plaintext";
      const lineCount = estimateLineCount(file.content);
      const initialCursorStyle =
        vim.enabled() && vim.mode() === "normal" ? "block" : "line";
      const langEditorSettings = getEffectiveEditorSettings(monacoLanguage);

      const baseOptions: Monaco.editor.IStandaloneEditorConstructionOptions = {
        theme: "cortex-dark",
        automaticLayout: true,
        lineNumbers: langEditorSettings.lineNumbers ?? "on",
        lineNumbersMinChars: 4,
        glyphMargin: true,
        folding: langEditorSettings.foldingEnabled ?? true,
        foldingHighlight: true,
        foldingStrategy: "indentation",
        showFoldingControls:
          langEditorSettings.showFoldingControls ?? "mouseover",
        minimap: {
          enabled: langEditorSettings.minimapEnabled ?? true,
          autohide: "mouseover",
          side: "right",
          showSlider: "mouseover",
          renderCharacters: false,
          maxColumn: 80,
          scale: 1,
          size: "proportional",
        },
        fontSize: langEditorSettings.fontSize ?? 13,
        lineHeight:
          (langEditorSettings.lineHeight ?? 1.5) *
          (langEditorSettings.fontSize ?? 13),
        fontFamily:
          langEditorSettings.fontFamily ??
          "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
        fontLigatures: langEditorSettings.fontLigatures ?? true,
        tabSize: langEditorSettings.tabSize ?? 2,
        insertSpaces: langEditorSettings.insertSpaces ?? true,
        detectIndentation: true,
        wordWrap: langEditorSettings.wordWrap ?? "off",
        wordWrapColumn: langEditorSettings.wordWrapColumn ?? 80,
        scrollBeyondLastLine: langEditorSettings.scrollBeyondLastLine ?? false,
        smoothScrolling: langEditorSettings.smoothScrolling ?? true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        cursorStyle: initialCursorStyle,
        cursorWidth: 2,
        renderLineHighlight: "line",
        renderWhitespace: langEditorSettings.renderWhitespace ?? "selection",
        renderControlCharacters:
          settingsState.settings.editor.renderControlCharacters ?? false,
        roundedSelection: true,
        bracketPairColorization: {
          enabled: langEditorSettings.bracketPairColorization ?? true,
          independentColorPoolPerBracketType: true,
        },
        matchBrackets: "always",
        autoClosingBrackets: langEditorSettings.autoClosingBrackets ?? "always",
        autoClosingQuotes: "always",
        autoClosingDelete: "always",
        autoSurround: "languageDefined",
        linkedEditing: langEditorSettings.linkedEditing ?? true,
        guides: {
          bracketPairs: langEditorSettings.guidesBracketPairs ?? true,
          bracketPairsHorizontal: true,
          highlightActiveBracketPair: true,
          indentation: langEditorSettings.guidesIndentation ?? true,
          highlightActiveIndentation: true,
        },
        padding: { top: 8, bottom: 8 },
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          useShadows: false,
        },
        multiCursorModifier: "alt",
        multiCursorMergeOverlapping: true,
        columnSelection: false,
        dragAndDrop: true,
        copyWithSyntaxHighlighting: true,
        occurrencesHighlight: "singleFile",
        selectionHighlight: true,
        find: {
          addExtraSpaceOnTop: false,
          seedSearchStringFromSelection: "selection",
          autoFindInSelection: "multiline",
        },
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: "on",
        links: true,
        contextmenu: true,
        stickyScroll: {
          enabled: langEditorSettings.stickyScrollEnabled ?? false,
          maxLineCount: 5,
        },
        inlayHints: {
          enabled: "on",
          fontSize: 12,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          padding: true,
        },
        codeLens: settingsState.settings.editor.codeLens?.enabled ?? true,
        codeLensFontFamily:
          settingsState.settings.editor.codeLens?.fontFamily || undefined,
        codeLensFontSize:
          settingsState.settings.editor.codeLens?.fontSize || 12,
        formatOnType: langEditorSettings.formatOnType ?? false,
        smartSelect: {
          selectLeadingAndTrailingWhitespace: false,
          selectSubwords: true,
        },
        unicodeHighlight: {
          ambiguousCharacters:
            settingsState.settings.editor.unicodeHighlight
              ?.ambiguousCharacters ?? true,
          invisibleCharacters:
            settingsState.settings.editor.unicodeHighlight
              ?.invisibleCharacters ?? true,
          nonBasicASCII:
            settingsState.settings.editor.unicodeHighlight?.nonBasicASCII ??
            false,
          includeComments:
            settingsState.settings.editor.unicodeHighlight?.includeComments ??
            "inUntrustedWorkspace",
          includeStrings:
            settingsState.settings.editor.unicodeHighlight?.includeStrings ??
            true,
          allowedCharacters: (settingsState.settings.editor.unicodeHighlight
            ?.allowedCharacters ?? {}) as Record<string, true>,
          allowedLocales: (settingsState.settings.editor.unicodeHighlight
            ?.allowedLocales ?? { _os: true, _vscode: true }) as Record<
            string,
            true
          >,
        },
        largeFileOptimizations:
          settingsState.settings.editor.largeFileOptimizations ?? true,
        maxTokenizationLineLength:
          settingsState.settings.editor.maxTokenizationLineLength ?? 20000,
      };

      const largeFileSettings: LargeFileSettings = {
        largeFileOptimizations:
          settingsState.settings.editor.largeFileOptimizations ?? true,
        maxTokenizationLineLength:
          settingsState.settings.editor.maxTokenizationLineLength ?? 20000,
      };

      const editorOptions = monacoManager.getOptionsForFile(
        baseOptions,
        lineCount,
        largeFileSettings,
      );

      if (
        largeFileSettings.largeFileOptimizations &&
        lineCount > LARGE_FILE_THRESHOLDS.DISABLE_MINIMAP
      ) {
        console.debug(
          `[Monaco] Large file detected (${lineCount} lines), applying optimizations`,
        );
      }

      const isNewEditor = !editorInitialized;

      if (editorRef && editorInitialized) {
        const model = monacoManager.getOrCreateModel(
          file.path,
          file.content,
          monacoLanguage,
        );
        editorRef.setModel(model);
        console.debug(
          `[CodeEditor] Model swap: ${(performance.now() - modelStart).toFixed(1)}ms`,
        );

        monacoManager.updateEditorForFileSize(
          editorRef,
          lineCount,
          largeFileSettings,
          langEditorSettings.minimapEnabled ?? true,
          langEditorSettings.foldingEnabled ?? true,
          langEditorSettings.bracketPairColorization ?? true,
        );

        editorRef.updateOptions({ cursorStyle: initialCursorStyle });

        window.dispatchEvent(
          new CustomEvent("editor:file-ready", {
            detail: { filePath: file.path, fileId: file.id },
          }),
        );
      } else {
        editorRef = monacoInstance!.editor.create(
          containerRef,
          editorOptions,
        );
        editorInitialized = true;

        const model = monacoManager.getOrCreateModel(
          file.path,
          file.content,
          monacoLanguage,
        );
        editorRef.setModel(model);
        console.debug(
          `[CodeEditor] Editor creation: ${(performance.now() - modelStart).toFixed(1)}ms`,
        );
      }

      window.dispatchEvent(
        new CustomEvent("editor:file-ready", {
          detail: { filePath: file.path, fileId: file.id },
        }),
      );

      setCurrentEditor(editorRef);

      if (isNewEditor) {
        updateFormatOnTypeSettings({
          enabled: settingsState.settings.editor.formatOnType ?? false,
          triggerCharacters: settingsState.settings.editor
            .formatOnTypeTriggerCharacters ?? [";", "}", "\n"],
        });

        const unicodeSettings = settingsState.settings.editor.unicodeHighlight;
        if (unicodeSettings) {
          updateUnicodeHighlightSettings({
            enabled: unicodeSettings.enabled ?? true,
            invisibleCharacters: unicodeSettings.invisibleCharacters ?? true,
            ambiguousCharacters: unicodeSettings.ambiguousCharacters ?? true,
            nonBasicASCII: unicodeSettings.nonBasicASCII ?? false,
            includeComments:
              unicodeSettings.includeComments ?? "inUntrustedWorkspace",
            includeStrings: unicodeSettings.includeStrings ?? true,
            allowedCharacters: unicodeSettings.allowedCharacters ?? {},
            allowedLocales: unicodeSettings.allowedLocales ?? {
              _os: true,
              _vscode: true,
            },
          });
        }

        setLinkedEditingEnabledState(
          settingsState.settings.editor.linkedEditing ?? true,
        );

        updateFormatOnPasteEnabled(
          settingsState.settings.editor.formatOnPaste ?? false,
        );

        formatOnPasteDisposable = setupFormatOnPaste(
          editorRef,
          monacoInstance,
          () => formatOnPasteEnabled,
        );
      }

      props.onEditorReady?.(editorRef, monacoInstance!, isNewEditor);

      console.debug(
        `[CodeEditor] Effect TOTAL: ${(performance.now() - effectStart).toFixed(1)}ms`,
      );
    }
  });

  const handleFileClosing = (e: CustomEvent<{ fileId: string }>) => {
    const closingFileId = e.detail?.fileId;
    if (closingFileId && props.file?.()?.id === closingFileId && editorRef) {
      try {
        editorRef.setModel(null);
        editorRef.dispose();
        editorRef = null;
        setCurrentEditor(null);
        isDisposed = true;
      } catch (err) {
        console.debug(
          "[CodeEditor] Pre-close disposal error (safe to ignore):",
          err,
        );
      }
    }
  };

  window.addEventListener(
    "editor:file-closing",
    handleFileClosing as EventListener,
  );

  onCleanup(() => {
    isDisposed = true;

    window.removeEventListener(
      "editor:file-closing",
      handleFileClosing as EventListener,
    );

    if (formatOnPasteDisposable) {
      formatOnPasteDisposable?.dispose?.();
      formatOnPasteDisposable = null;
    }

    if (currentFilePath) {
      monacoManager.scheduleModelDisposal(currentFilePath);
    }

    if (editorRef) {
      try {
        editorRef.setModel(null);
        editorRef.dispose();
      } catch (e) {
        console.debug(
          "[CodeEditor] Cleanup disposal error (safe to ignore):",
          e,
        );
      }
      editorRef = null;
      setCurrentEditor(null);
    }

    if (containerRef) {
      containerRef.innerHTML = "";
    }
  });

  return {
    editor: currentEditor,
    monaco: currentMonaco,
    containerRef,
    setContainerRef: (el: HTMLDivElement) => {
      containerRef = el;
    },
    isLoading,
    activeFile,
    editorInstance: () => editorRef,
  };
}
