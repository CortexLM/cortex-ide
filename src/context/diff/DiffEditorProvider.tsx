/**
 * DiffEditorProvider — manages diff editor state and navigation.
 *
 * Tracks diff sessions, mode (inline vs side-by-side), change navigation,
 * and source info. Dispatches window events for cross-component coordination
 * and listens for external open/toggle requests.
 */

import {
  createContext,
  useContext,
  createSignal,
  batch,
  onMount,
  onCleanup,
  ParentProps,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "@/utils/logger";

const log = createLogger("DiffEditor");

export type DiffMode = "inline" | "sideBySide";

export interface DiffChange {
  id: string;
  type: "addition" | "deletion" | "modification";
  originalStartLine: number;
  originalEndLine: number;
  modifiedStartLine: number;
  modifiedEndLine: number;
}

export interface DiffSession {
  id: string;
  originalPath: string;
  modifiedPath: string;
  originalContent: string;
  modifiedContent: string;
  language: string;
  title?: string;
  changes: DiffChange[];
}

export interface DiffEditorState {
  isOpen: boolean;
  mode: DiffMode;
  activeSession: DiffSession | null;
  currentChangeIndex: number;
  sessions: DiffSession[];
}

interface OpenDiffOptions {
  originalPath?: string;
  modifiedPath?: string;
  title?: string;
  mode?: DiffMode;
}

interface DiffEditorContextValue {
  isOpen: () => boolean;
  mode: () => DiffMode;
  activeSession: () => DiffSession | null;
  currentChangeIndex: () => number;
  sessions: () => DiffSession[];
  totalChanges: () => number;
  openDiff: (
    originalContent: string,
    modifiedContent: string,
    language: string,
    options?: OpenDiffOptions,
  ) => void;
  closeDiff: (sessionId?: string) => void;
  setMode: (mode: DiffMode) => void;
  navigateNextChange: () => void;
  navigatePrevChange: () => void;
  navigateToChange: (index: number) => void;
}

const DiffEditorCtx = createContext<DiffEditorContextValue>();

function computeChanges(
  originalContent: string,
  modifiedContent: string,
): DiffChange[] {
  const originalLines = originalContent.split("\n");
  const modifiedLines = modifiedContent.split("\n");
  const changes: DiffChange[] = [];
  const maxLen = Math.max(originalLines.length, modifiedLines.length);

  let i = 0;
  while (i < maxLen) {
    if (i >= originalLines.length) {
      const startLine = i + 1;
      while (i < modifiedLines.length) {
        i++;
      }
      changes.push({
        id: crypto.randomUUID(),
        type: "addition",
        originalStartLine: originalLines.length,
        originalEndLine: originalLines.length,
        modifiedStartLine: startLine,
        modifiedEndLine: i,
      });
    } else if (i >= modifiedLines.length) {
      const startLine = i + 1;
      while (i < originalLines.length) {
        i++;
      }
      changes.push({
        id: crypto.randomUUID(),
        type: "deletion",
        originalStartLine: startLine,
        originalEndLine: i,
        modifiedStartLine: modifiedLines.length,
        modifiedEndLine: modifiedLines.length,
      });
    } else if (originalLines[i] !== modifiedLines[i]) {
      const startLine = i + 1;
      while (
        i < maxLen &&
        i < originalLines.length &&
        i < modifiedLines.length &&
        originalLines[i] !== modifiedLines[i]
      ) {
        i++;
      }
      changes.push({
        id: crypto.randomUUID(),
        type: "modification",
        originalStartLine: startLine,
        originalEndLine: i,
        modifiedStartLine: startLine,
        modifiedEndLine: i,
      });
    } else {
      i++;
    }
  }

  return changes;
}

export function DiffEditorProvider(props: ParentProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [mode, setModeSignal] = createSignal<DiffMode>("sideBySide");
  const [activeSession, setActiveSession] = createSignal<DiffSession | null>(
    null,
  );
  const [currentChangeIndex, setCurrentChangeIndex] = createSignal(0);
  const [sessions, setSessions] = createSignal<DiffSession[]>([]);

  const totalChanges = () => activeSession()?.changes.length ?? 0;

  const openDiff = (
    originalContent: string,
    modifiedContent: string,
    language: string,
    options?: OpenDiffOptions,
  ) => {
    const changes = computeChanges(originalContent, modifiedContent);
    const session: DiffSession = {
      id: crypto.randomUUID(),
      originalPath: options?.originalPath ?? "",
      modifiedPath: options?.modifiedPath ?? "",
      originalContent,
      modifiedContent,
      language,
      title: options?.title,
      changes,
    };

    batch(() => {
      setSessions((prev) => [...prev, session]);
      setActiveSession(session);
      setCurrentChangeIndex(0);
      if (options?.mode) {
        setModeSignal(options.mode);
      }
      setIsOpen(true);
    });

    log.debug("Diff session opened:", session.id);

    invoke("diff_editor_opened", {
      sessionId: session.id,
      language,
    }).catch((err: unknown) => {
      log.debug("diff_editor_opened IPC not available:", err);
    });

    window.dispatchEvent(
      new CustomEvent("diff-editor:opened", {
        detail: {
          sessionId: session.id,
          language,
          changesCount: changes.length,
        },
      }),
    );
  };

  const closeDiff = (sessionId?: string) => {
    const targetId = sessionId ?? activeSession()?.id;
    if (!targetId) return;

    batch(() => {
      setSessions((prev) => prev.filter((s) => s.id !== targetId));

      if (activeSession()?.id === targetId) {
        const remaining = sessions().filter((s) => s.id !== targetId);
        if (remaining.length > 0) {
          setActiveSession(remaining[remaining.length - 1]);
          setCurrentChangeIndex(0);
        } else {
          setActiveSession(null);
          setCurrentChangeIndex(0);
          setIsOpen(false);
        }
      }
    });

    log.debug("Diff session closed:", targetId);

    invoke("diff_editor_closed", { sessionId: targetId }).catch(
      (err: unknown) => {
        log.debug("diff_editor_closed IPC not available:", err);
      },
    );

    window.dispatchEvent(
      new CustomEvent("diff-editor:closed", {
        detail: { sessionId: targetId },
      }),
    );
  };

  const setMode = (newMode: DiffMode) => {
    setModeSignal(newMode);
    log.debug("Diff mode changed:", newMode);

    window.dispatchEvent(
      new CustomEvent("diff-editor:mode-changed", {
        detail: { mode: newMode },
      }),
    );
  };

  const navigateToChange = (index: number) => {
    const total = totalChanges();
    if (total === 0) return;

    const clamped = Math.max(0, Math.min(index, total - 1));
    setCurrentChangeIndex(clamped);

    window.dispatchEvent(
      new CustomEvent("diff-editor:navigate", {
        detail: { changeIndex: clamped },
      }),
    );
  };

  const navigateNextChange = () => {
    const total = totalChanges();
    if (total === 0) return;
    navigateToChange(Math.min(currentChangeIndex() + 1, total - 1));
  };

  const navigatePrevChange = () => {
    if (totalChanges() === 0) return;
    navigateToChange(Math.max(currentChangeIndex() - 1, 0));
  };

  onMount(() => {
    const handleOpenEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        originalContent?: string;
        modifiedContent?: string;
        language?: string;
        originalPath?: string;
        modifiedPath?: string;
        title?: string;
        mode?: DiffMode;
      } | undefined;

      if (!detail?.originalContent || !detail.modifiedContent || !detail.language) {
        log.warn("diff-editor:open event missing required fields");
        return;
      }

      openDiff(detail.originalContent, detail.modifiedContent, detail.language, {
        originalPath: detail.originalPath,
        modifiedPath: detail.modifiedPath,
        title: detail.title,
        mode: detail.mode,
      });
    };

    const handleToggleMode = () => {
      const current = mode();
      setMode(current === "inline" ? "sideBySide" : "inline");
    };

    window.addEventListener("diff-editor:open", handleOpenEvent);
    window.addEventListener("diff-editor:toggle-mode", handleToggleMode);

    onCleanup(() => {
      window.removeEventListener("diff-editor:open", handleOpenEvent);
      window.removeEventListener("diff-editor:toggle-mode", handleToggleMode);
    });
  });

  const value: DiffEditorContextValue = {
    isOpen,
    mode,
    activeSession,
    currentChangeIndex,
    sessions,
    totalChanges,
    openDiff,
    closeDiff,
    setMode,
    navigateNextChange,
    navigatePrevChange,
    navigateToChange,
  };

  return (
    <DiffEditorCtx.Provider value={value}>
      {props.children}
    </DiffEditorCtx.Provider>
  );
}

export function useDiffEditor(): DiffEditorContextValue {
  const ctx = useContext(DiffEditorCtx);
  if (!ctx) {
    throw new Error(
      "useDiffEditor must be used within a DiffEditorProvider",
    );
  }
  return ctx;
}
