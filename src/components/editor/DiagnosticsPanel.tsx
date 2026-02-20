/**
 * Enhanced Diagnostics Panel Component
 *
 * A comprehensive panel for displaying and managing diagnostics from multiple sources.
 * Features:
 * - Aggregate diagnostics from LSP, TypeScript, ESLint, build output, tasks
 * - Group by file, severity, or source
 * - Filter by type (error, warning, info, hint)
 * - Filter by current file only
 * - Keyboard navigation
 * - Quick fix actions
 * - Click to navigate to source
 * - Copy diagnostic message
 * - Export diagnostics as JSON, CSV, or Markdown
 * - Auto-refresh on file changes
 * - Diagnostic count in status bar
 * - Advanced filter input with token syntax
 * - Persisted filter settings
 */

import {
  For,
  Show,
  createSignal,
  createMemo,
  createEffect,
  onMount,
  onCleanup,
  type JSX,
} from "solid-js";
import { Portal } from "solid-js/web";
import {
  useDiagnostics,
  type UnifiedDiagnostic,
  type DiagnosticSource,
  type CodeAction,
} from "@/context/DiagnosticsContext";
import { useLSP, type DiagnosticSeverity } from "@/context/LSPContext";
import { useEditor } from "@/context/EditorContext";
import { Icon } from "../ui/Icon";
import { getProjectPath } from "@/utils/workspace";
import { IconButton, ListItem, Badge, Text } from "@/components/ui";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Icons for different severity levels
// ============================================================================

function ErrorIcon() {
  return (
    <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path
        fill-rule="evenodd"
        d="M8.893 1.5c-.183-.31-.52-.5-.887-.5s-.703.19-.886.5L.138 13.499a.98.98 0 0 0 0 1.001c.193.31.53.501.886.501h13.964c.367 0 .704-.19.877-.5a1.03 1.03 0 0 0 .01-1.002L8.893 1.5zm.133 11.497H6.987v-2.003h2.039v2.003zm0-3.004H6.987V5.987h2.039v4.006z"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path
        fill-rule="evenodd"
        d="M8.893 1.5c-.183-.31-.52-.5-.887-.5s-.703.19-.886.5L.138 13.499a.98.98 0 0 0 0 1.001c.193.31.53.501.886.501h13.964c.367 0 .704-.19.877-.5a1.03 1.03 0 0 0 .01-1.002L8.893 1.5zm.133 11.497H6.987v-2.003h2.039v2.003zm0-3.004H6.987V5.987h2.039v4.006z"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path
        fill-rule="evenodd"
        d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM8 5.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
      />
    </svg>
  );
}

function HintIcon() {
  return (
    <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path
        fill-rule="evenodd"
        d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5A6.5 6.5 0 0 0 8 1.5zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm9 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-.25-6.25a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5z"
      />
    </svg>
  );
}

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_COLORS: Record<DiagnosticSeverity, string> = {
  error: tokens.colors.semantic.error,
  warning: tokens.colors.semantic.warning,
  information: tokens.colors.semantic.info,
  hint: tokens.colors.text.muted,
};

const SEVERITY_ICONS: Record<DiagnosticSeverity, () => JSX.Element> = {
  error: ErrorIcon,
  warning: WarningIcon,
  information: InfoIcon,
  hint: HintIcon,
};

const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
  information: 2,
  hint: 3,
};

const SEVERITY_LABELS: Record<DiagnosticSeverity, string> = {
  error: "Errors",
  warning: "Warnings",
  information: "Info",
  hint: "Hints",
};

const SOURCE_ICONS: Record<DiagnosticSource, () => JSX.Element> = {
  lsp: () => <Icon name="code" class="w-3.5 h-3.5" />,
  typescript: () => <Icon name="code" class="w-3.5 h-3.5" />,
  eslint: () => <Icon name="filter" class="w-3.5 h-3.5" />,
  build: () => <Icon name="cube" class="w-3.5 h-3.5" />,
  task: () => <Icon name="terminal" class="w-3.5 h-3.5" />,
  custom: () => <Icon name="crosshairs" class="w-3.5 h-3.5" />,
};

const SOURCE_LABELS: Record<DiagnosticSource, string> = {
  lsp: "Language Server",
  typescript: "TypeScript",
  eslint: "ESLint",
  build: "Build Output",
  task: "Task",
  custom: "Custom",
};

// Storage key for persisting filter settings
const FILTER_STORAGE_KEY = "cortex_diagnostics_filter";

// ============================================================================
// Filter Token Types
// ============================================================================

type FilterTokenType = "severity" | "file" | "source" | "text";

interface FilterToken {
  type: FilterTokenType;
  value: string;
  raw: string;
}

interface ParsedFilter {
  tokens: FilterToken[];
  severities: Set<DiagnosticSeverity>;
  files: string[];
  sources: string[];
  textSearch: string;
}

// ============================================================================
// Filter Persistence
// ============================================================================

interface PersistedFilterSettings {
  filterInput: string;
  showErrors: boolean;
  showWarnings: boolean;
  showInformation: boolean;
  showHints: boolean;
  currentFileOnly: boolean;
}

function loadPersistedFilter(): PersistedFilterSettings | null {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as PersistedFilterSettings;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function savePersistedFilter(settings: PersistedFilterSettings): void {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

function clearPersistedFilter(): void {
  try {
    localStorage.removeItem(FILTER_STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}

// ============================================================================
// Filter Parsing
// ============================================================================

function parseFilterInput(input: string): ParsedFilter {
  const tokens: FilterToken[] = [];
  const severities = new Set<DiagnosticSeverity>();
  const files: string[] = [];
  const sources: string[] = [];
  const textParts: string[] = [];

  if (!input.trim()) {
    return { tokens, severities, files, sources, textSearch: "" };
  }

  // Tokenize input - handle quoted strings and special syntax
  const regex = /(?:file|source):(?:"[^"]+"|'[^']+'|\S+)|"[^"]+"|'[^']+'|\S+/gi;
  const matches = input.match(regex) || [];

  for (const match of matches) {
    const lowerMatch = match.toLowerCase();

    // Check for severity keywords
    if (lowerMatch === "error" || lowerMatch === "errors") {
      tokens.push({ type: "severity", value: "error", raw: match });
      severities.add("error");
    } else if (lowerMatch === "warning" || lowerMatch === "warnings" || lowerMatch === "warn") {
      tokens.push({ type: "severity", value: "warning", raw: match });
      severities.add("warning");
    } else if (lowerMatch === "info" || lowerMatch === "information") {
      tokens.push({ type: "severity", value: "information", raw: match });
      severities.add("information");
    } else if (lowerMatch === "hint" || lowerMatch === "hints") {
      tokens.push({ type: "severity", value: "hint", raw: match });
      severities.add("hint");
    }
    // Check for file: prefix
    else if (lowerMatch.startsWith("file:")) {
      const fileValue = extractPrefixValue(match, "file:");
      if (fileValue) {
        tokens.push({ type: "file", value: fileValue, raw: match });
        files.push(fileValue.toLowerCase());
      }
    }
    // Check for source: prefix
    else if (lowerMatch.startsWith("source:")) {
      const sourceValue = extractPrefixValue(match, "source:");
      if (sourceValue) {
        tokens.push({ type: "source", value: sourceValue, raw: match });
        sources.push(sourceValue.toLowerCase());
      }
    }
    // Everything else is text search
    else {
      const textValue = stripQuotes(match);
      tokens.push({ type: "text", value: textValue, raw: match });
      textParts.push(textValue.toLowerCase());
    }
  }

  return {
    tokens,
    severities,
    files,
    sources,
    textSearch: textParts.join(" "),
  };
}

function extractPrefixValue(input: string, prefix: string): string {
  const afterPrefix = input.slice(prefix.length);
  return stripQuotes(afterPrefix);
}

function stripQuotes(str: string): string {
  if ((str.startsWith('"') && str.endsWith('"')) || 
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
}

// ============================================================================
// Utility Functions
// ============================================================================

function getFileName(uri: string): string {
  const parts = uri.replace(/^file:\/\//, "").split(/[/\\]/);
  return parts[parts.length - 1];
}

function getRelativePath(uri: string): string {
  const fullPath = uri.replace(/^file:\/\//, "");
  const projectPath = getProjectPath();
  if (projectPath && fullPath.startsWith(projectPath)) {
    return fullPath.slice(projectPath.length + 1);
  }
  return fullPath;
}

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

// ============================================================================
// Lightbulb Icon Component
// ============================================================================

function LightbulbIcon(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <svg
      class={props.class ?? "w-4 h-4"}
      viewBox="0 0 16 16"
      fill="currentColor"
      style={props.style}
    >
      <path d="M8 1a4 4 0 0 0-4 4c0 1.098.5 2.09 1.316 2.883.432.42.773.835 1.021 1.242.264.435.445.905.538 1.414l.06.32H9.066l.06-.321c.092-.509.273-.978.537-1.413.248-.407.59-.822 1.021-1.242A3.999 3.999 0 0 0 8 1zM6 10.794c-.115-.357-.274-.713-.478-1.049-.288-.473-.654-.911-1.078-1.323A4.978 4.978 0 0 1 3 5c0-2.757 2.243-5 5-5s5 2.243 5 5a4.978 4.978 0 0 1-1.444 3.422c-.424.412-.79.85-1.078 1.323-.204.336-.363.692-.478 1.049H6z" />
      <path d="M6.5 12a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zM6.5 13.5a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zM7 15a1 1 0 0 0 1 1h0a1 1 0 0 0 1-1v-.5H7V15z" />
    </svg>
  );
}

// ============================================================================
// Quick Fix Menu Types
// ============================================================================

interface QuickFixMenuItem {
  id: string;
  label: string;
  icon: () => JSX.Element;
  action: () => void;
  isPreferred?: boolean;
  preview?: string;
  divider?: boolean;
  disabled?: boolean;
}

// Generate a preview of what the fix will do
function generateFixPreview(action: CodeAction): string | undefined {
  if (!action.edit?.changes) return undefined;

  const previews: string[] = [];
  for (const [_uri, edits] of Object.entries(action.edit.changes)) {
    for (const edit of edits) {
      if (edit.newText) {
        const preview = edit.newText.trim().slice(0, 100);
        if (preview) {
          previews.push(preview + (edit.newText.length > 100 ? "..." : ""));
        }
      }
    }
  }

  return previews.length > 0 ? previews.join("\n") : undefined;
}

// ============================================================================
// Quick Fix Menu Component
// ============================================================================

interface QuickFixMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  diagnostic: UnifiedDiagnostic | null;
  codeActions: CodeAction[];
  isLoading: boolean;
  onClose: () => void;
  onApplyFix: (action: CodeAction) => void;
  onFixAllInFile: (diagnostic: UnifiedDiagnostic) => void;
  onFixAllOfType: (diagnostic: UnifiedDiagnostic) => void;
}

function QuickFixMenu(props: QuickFixMenuProps) {
  const [hoveredId] = createSignal<string | null>(null);
  const [focusIndex, setFocusIndex] = createSignal(0);
  let menuRef: HTMLDivElement | undefined;

  // Build menu items from code actions and bulk fix options
  const menuItems = createMemo((): QuickFixMenuItem[] => {
    const items: QuickFixMenuItem[] = [];
    const diag = props.diagnostic;
    if (!diag) return items;

    // Add individual code actions
    for (let i = 0; i < props.codeActions.length; i++) {
      const action = props.codeActions[i];
items.push({
        id: `action-${i}`,
        label: action.title,
        icon: () => <Icon name="screwdriver-wrench" class="w-3.5 h-3.5" />,
        action: () => props.onApplyFix(action),
        isPreferred: action.isPreferred,
        preview: generateFixPreview(action),
      });
    }

    // Add divider if we have individual actions
    if (items.length > 0) {
      items.push({
        id: "divider-1",
        label: "",
        icon: () => <></>,
        action: () => {},
        divider: true,
      });
    }

    // Add bulk fix options
items.push({
      id: "fix-all-file",
      label: "Fix all in file",
      icon: () => <Icon name="file-lines" class="w-3.5 h-3.5" />,
      action: () => props.onFixAllInFile(diag),
    });

    if (diag.code) {
items.push({
        id: "fix-all-type",
        label: `Fix all "${diag.code}" issues`,
        icon: () => <Icon name="list" class="w-3.5 h-3.5" />,
        action: () => props.onFixAllOfType(diag),
      });
    }

    return items;
  });

  // Get navigable (non-divider) items for keyboard navigation
  const navigableItems = createMemo(() =>
    menuItems().filter((item) => !item.divider && !item.disabled)
  );

  // Handle keyboard navigation
  const handleMenuKeyDown = (e: KeyboardEvent) => {
    const navItems = navigableItems();
    if (navItems.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        setFocusIndex((prev) => (prev + 1) % navItems.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        setFocusIndex((prev) => (prev - 1 + navItems.length) % navItems.length);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        e.stopPropagation();
        const selectedItem = navItems[focusIndex()];
        if (selectedItem) {
          selectedItem.action();
          props.onClose();
        }
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        props.onClose();
        break;
    }
  };

  // Close menu when clicking outside
  createEffect(() => {
    if (!props.isOpen) {
      setFocusIndex(0);
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef && !menuRef.contains(e.target as Node)) {
        props.onClose();
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (props.isOpen) {
        handleMenuKeyDown(e);
      }
    };

    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("keydown", handleGlobalKeyDown);
    }, 0);

    onCleanup(() => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleGlobalKeyDown);
    });
  });

  // Focus management
  createEffect(() => {
    if (props.isOpen && menuRef) {
      menuRef.focus();
    }
  });

  // Calculate menu position to stay within viewport
  const menuPosition = createMemo(() => {
    let { x, y } = props.position;
    const menuWidth = 280;
    const estimatedMenuHeight = Math.min(menuItems().length * 36 + 80, 320);

    // Adjust horizontal position
    if (x + menuWidth > window.innerWidth - 16) {
      x = window.innerWidth - menuWidth - 16;
    }
    if (x < 16) x = 16;

    // Adjust vertical position - prefer showing below, but flip if not enough space
    if (y + estimatedMenuHeight > window.innerHeight - 16) {
      y = Math.max(16, y - estimatedMenuHeight - 8);
    }

    return { x, y };
  });

  return (
    <Show when={props.isOpen && props.diagnostic}>
      <Portal>
        <div
          ref={menuRef}
          class="fixed z-[9999] min-w-[220px] max-w-[320px] overflow-hidden"
          style={{
            left: `${menuPosition().x}px`,
            top: `${menuPosition().y}px`,
            background: tokens.colors.surface.elevated,
            border: `1px solid ${tokens.colors.border.default}`,
            "border-radius": tokens.radius.md,
            "box-shadow": "var(--jb-shadow-popup)",
            animation: "fadeIn 150ms ease-out",
          }}
          tabIndex={-1}
        >
          {/* Header */}
          <div
            class="px-3 py-2 flex items-center gap-2"
            style={{ "border-bottom": `1px solid ${tokens.colors.border.default}` }}
          >
            <LightbulbIcon class="w-4 h-4" style={{ color: tokens.colors.semantic.warning }} />
            <Text variant="body" weight="medium">Quick Fix</Text>
            <Show when={props.isLoading}>
              <div class="ml-auto">
                <div
                  class="w-3 h-3 rounded-full animate-spin"
                  style={{
                    border: `2px solid ${tokens.colors.semantic.info}`,
                    "border-top-color": "transparent",
                  }}
                />
              </div>
            </Show>
          </div>

          {/* Menu items */}
          <div class="max-h-[250px] overflow-y-auto py-1">
            <Show
              when={!props.isLoading && menuItems().length > 0}
              fallback={
                <div class="px-3 py-4 text-center">
                  <Text variant="muted" size="xs">
                    {props.isLoading
                      ? "Loading fixes..."
                      : "No quick fixes available"}
                  </Text>
                </div>
              }
            >
              <For each={menuItems()}>
                {(item) => (
                  <Show
                    when={!item.divider}
                    fallback={
                      <div style={{ height: "1px", margin: `${tokens.spacing.sm} ${tokens.spacing.md}`, background: tokens.colors.border.default }} />
                    }
                  >
                    <div>
                      <ListItem
                        icon={item.icon()}
                        label={item.label}
                        badge={item.isPreferred ? "Preferred" : undefined}
                        selected={navigableItems().indexOf(item) === focusIndex()}
                        disabled={item.disabled}
                        onClick={() => {
                          if (!item.disabled) {
                            item.action();
                            props.onClose();
                          }
                        }}
                        style={{
                          cursor: item.disabled ? "not-allowed" : "pointer",
                        }}
                      />

                      {/* Fix preview tooltip on hover */}
                      <Show when={hoveredId() === item.id && item.preview}>
                        <div
                          style={{
                            margin: `0 ${tokens.spacing.md} ${tokens.spacing.sm}`,
                            padding: `6px ${tokens.spacing.md}`,
                            "border-radius": tokens.radius.sm,
                            background: tokens.colors.surface.panel,
                            border: `1px solid ${tokens.colors.border.default}`,
                          }}
                        >
                          <Text variant="muted" size="xs" style={{ "margin-bottom": tokens.spacing.sm }}>
                            Preview:
                          </Text>
                          <pre
                            style={{
                              "font-size": "10px",
                              color: tokens.colors.text.primary,
                              "font-family": "var(--jb-font-mono)",
                              "white-space": "pre-wrap",
                              "word-break": "break-all",
                              "max-height": "60px",
                              overflow: "hidden",
                              margin: "0",
                            }}
                          >
                            {item.preview}
                          </pre>
                        </div>
                      </Show>
                    </div>
                  </Show>
                )}
              </For>
            </Show>
          </div>

          {/* Footer with keyboard hint */}
          <div
            class="px-3 py-1.5 flex items-center gap-3"
            style={{ "border-top": `1px solid ${tokens.colors.border.default}` }}
          >
            <Text variant="muted" size="xs">
              <kbd style={{ padding: `1px ${tokens.spacing.sm}`, "border-radius": tokens.radius.sm, background: tokens.colors.interactive.active }}>↑↓</kbd>{" "}
              Navigate
            </Text>
            <Text variant="muted" size="xs">
              <kbd style={{ padding: `1px ${tokens.spacing.sm}`, "border-radius": tokens.radius.sm, background: tokens.colors.interactive.active }}>Enter</kbd>{" "}
              Apply
            </Text>
            <Text variant="muted" size="xs">
              <kbd style={{ padding: `1px ${tokens.spacing.sm}`, "border-radius": tokens.radius.sm, background: tokens.colors.interactive.active }}>Esc</kbd>{" "}
              Close
            </Text>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

// ============================================================================
// DiagnosticItem Component
// ============================================================================

interface DiagnosticItemProps {
  item: UnifiedDiagnostic;
  isSelected: boolean;
  showFileName: boolean;
  showSource: boolean;
  onClick: () => void;
  onCopy: () => void;
  onQuickFix: (e: MouseEvent, buttonRect: DOMRect) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  ref?: (el: HTMLButtonElement) => void;
}

function DiagnosticItem(props: DiagnosticItemProps) {
  let quickFixButtonRef: HTMLButtonElement | undefined;
  const severity = () => props.item.severity ?? "information";
  const IconComponent = () => SEVERITY_ICONS[severity()];
  const color = () => SEVERITY_COLORS[severity()];

  const location = () => {
    const { start } = props.item.range;
    return `Ln ${start.line + 1}, Col ${start.character + 1}`;
  };

  const hasCodeActions = () =>
    props.item.codeActions && props.item.codeActions.length > 0;

  // Build the description string for ListItem
  const descriptionText = () => {
    const parts: string[] = [];
    if (props.showFileName) {
      parts.push(getFileName(props.item.uri));
    }
    parts.push(`(${location()})`);
    if (props.showSource && props.item.sourceName) {
      parts.push(`[${props.item.sourceName}]`);
    }
    return parts.join(" ");
  };

  return (
    <div
      class="group"
      style={{
        position: "relative",
      }}
    >
      <ListItem
        icon={
          <span style={{ color: color() }}>
            {IconComponent()()}
          </span>
        }
        label={props.item.message}
        description={descriptionText()}
        badge={props.item.code ? String(props.item.code) : undefined}
        selected={props.isSelected}
        onClick={props.onClick}
        style={{
          cursor: "pointer",
        }}
      />
      {/* Action buttons overlay - visible on hover */}
      <div
        class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          position: "absolute",
          right: tokens.spacing.md,
          top: "50%",
          transform: "translateY(-50%)",
          background: props.isSelected ? tokens.colors.interactive.selected : tokens.colors.surface.panel,
          "padding-left": tokens.spacing.sm,
        }}
      >
        <IconButton
          size="sm"
          tooltip="Copy message (Ctrl+C)"
          onClick={(e) => {
            e.stopPropagation();
            props.onCopy();
          }}
        >
          <Icon name="copy" />
        </IconButton>
        <IconButton
          ref={quickFixButtonRef}
          size="sm"
          tooltip="Quick Fix (Ctrl+.)"
          active={hasCodeActions()}
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            props.onQuickFix(e, rect);
          }}
          style={{
            color: hasCodeActions() ? tokens.colors.semantic.warning : undefined,
          }}
        >
          <LightbulbIcon class="w-3.5 h-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

// ============================================================================
// CollapsibleSection Component
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  count: number;
  icon?: JSX.Element;
  iconColor?: string;
  defaultOpen?: boolean;
  children: JSX.Element;
}

function CollapsibleSection(props: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = createSignal(props.defaultOpen ?? true);

  return (
    <div style={{ "border-bottom": `1px solid ${tokens.colors.border.default}` }}>
      <button
        class="w-full flex items-center gap-1.5 px-2 transition-colors text-left"
        style={{ height: "var(--jb-tree-row-height)" }}
        onClick={() => setIsOpen(!isOpen())}
      >
        <span style={{ color: tokens.colors.text.primary }}>
{isOpen() ? (
            <Icon name="chevron-down" class="w-3.5 h-3.5" />
          ) : (
            <Icon name="chevron-right" class="w-3.5 h-3.5" />
          )}
        </span>
        <Show when={props.icon}>
          <span style={{ color: props.iconColor }}>{props.icon}</span>
        </Show>
        <Text variant="body" truncate style={{ flex: "1" }}>
          {props.title}
        </Text>
        <Badge variant="default">{props.count}</Badge>
      </button>
      <Show when={isOpen()}>
        <div>{props.children}</div>
      </Show>
    </div>
  );
}

// ============================================================================
// Export Menu Component
// ============================================================================

interface ExportMenuProps {
  onExport: (format: "json" | "csv" | "markdown") => void;
}

function ExportMenu(props: ExportMenuProps) {
  const [isOpen, setIsOpen] = createSignal(false);

  return (
    <div class="relative">
      <IconButton
        size="md"
        tooltip="Export diagnostics"
        onClick={() => setIsOpen(!isOpen())}
      >
        <Icon name="download" />
      </IconButton>
      <Show when={isOpen()}>
        <div
          style={{
            position: "absolute",
            right: "0",
            top: "100%",
            "margin-top": tokens.spacing.sm,
            background: tokens.colors.surface.elevated,
            border: `1px solid ${tokens.colors.border.default}`,
            "border-radius": tokens.radius.md,
            "box-shadow": "var(--jb-shadow-popup)",
            "z-index": "50",
            "min-width": "140px",
          }}
          onMouseLeave={() => setIsOpen(false)}
        >
          <ListItem
            label="Export as JSON"
            onClick={() => {
              props.onExport("json");
              setIsOpen(false);
            }}
          />
          <ListItem
            label="Export as CSV"
            onClick={() => {
              props.onExport("csv");
              setIsOpen(false);
            }}
          />
          <ListItem
            label="Export as Markdown"
            onClick={() => {
              props.onExport("markdown");
              setIsOpen(false);
            }}
          />
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Filter Token Display Component
// ============================================================================

const TOKEN_COLORS: Record<FilterTokenType, { bg: string; text: string; border: string }> = {
  severity: { bg: "rgba(247, 84, 100, 0.15)", text: tokens.colors.semantic.error, border: "rgba(247, 84, 100, 0.3)" },
  file: { bg: "rgba(53, 116, 240, 0.15)", text: tokens.colors.semantic.info, border: "rgba(53, 116, 240, 0.3)" },
  source: { bg: "rgba(233, 170, 70, 0.15)", text: tokens.colors.semantic.warning, border: "rgba(233, 170, 70, 0.3)" },
  text: { bg: "rgba(108, 108, 108, 0.15)", text: tokens.colors.text.primary, border: "rgba(108, 108, 108, 0.3)" },
};

interface FilterTokenBadgeProps {
  token: FilterToken;
  onRemove: () => void;
}

function FilterTokenBadge(props: FilterTokenBadgeProps) {
  const colors = () => TOKEN_COLORS[props.token.type];
  const label = () => {
    switch (props.token.type) {
      case "severity":
        return props.token.value;
      case "file":
        return `file:${props.token.value}`;
      case "source":
        return `source:${props.token.value}`;
      case "text":
        return `"${props.token.value}"`;
    }
  };

  return (
    <span
      style={{
        display: "inline-flex",
        "align-items": "center",
        gap: tokens.spacing.sm,
        padding: "1px 6px",
        "border-radius": tokens.radius.sm,
        "font-size": "var(--jb-text-muted-size)",
        "font-weight": "500",
        background: colors().bg,
        color: colors().text,
        border: `1px solid ${colors().border}`,
      }}
    >
      <Text size="xs" truncate style={{ "max-width": "120px", color: "inherit" }}>
        {label()}
      </Text>
      <IconButton
        size="sm"
        tooltip="Remove filter"
        onClick={(e) => {
          e.stopPropagation();
          props.onRemove();
        }}
        style={{
          width: "14px",
          height: "14px",
          color: "inherit",
        }}
      >
        <Icon name="xmark" />
      </IconButton>
    </span>
  );
}

// ============================================================================
// Filter Input Bar Component
// ============================================================================

interface FilterInputBarProps {
  filterInput: string;
  parsedFilter: ParsedFilter;
  onFilterChange: (input: string) => void;
  onClear: () => void;
  activeFilterCount: number;
  onQuickFilter: (filter: string) => void;
}

function FilterInputBar(props: FilterInputBarProps) {
  let inputRef: HTMLInputElement | undefined;
  const [isFocused, setIsFocused] = createSignal(false);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      inputRef?.blur();
    } else if (e.key === "Backspace" && !props.filterInput && props.parsedFilter.tokens.length > 0) {
      // Remove last token when backspace on empty input
      const newTokens = props.parsedFilter.tokens.slice(0, -1);
      const newInput = newTokens.map((t) => t.raw).join(" ");
      props.onFilterChange(newInput);
    }
  };

  const removeToken = (index: number) => {
    const tokens = [...props.parsedFilter.tokens];
    tokens.splice(index, 1);
    const newInput = tokens.map((t) => t.raw).join(" ");
    props.onFilterChange(newInput);
  };

  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        gap: tokens.spacing.sm,
        padding: `0 ${tokens.spacing.md}`,
        height: "28px",
        background: tokens.colors.surface.panel,
        "border-bottom": `1px solid ${tokens.colors.border.default}`,
      }}
    >
      {/* Search input with icon */}
      <div
        style={{
          flex: "1",
          display: "flex",
          "align-items": "center",
          gap: tokens.spacing.sm,
          "min-width": "0",
          padding: "0 6px",
          height: "22px",
          "border-radius": tokens.radius.sm,
          background: isFocused() ? "var(--jb-input-bg-focus)" : "var(--jb-input-bg)",
          border: isFocused() ? `1px solid ${tokens.colors.semantic.info}` : `1px solid ${tokens.colors.border.default}`,
          transition: "background var(--cortex-transition-fast), border var(--cortex-transition-fast)",
        }}
        onClick={() => inputRef?.focus()}
      >
        <Icon name="magnifying-glass" style={{ width: "14px", height: "14px", color: tokens.colors.text.muted, "flex-shrink": "0" }} />

        {/* Token badges inline */}
        <For each={props.parsedFilter.tokens}>
          {(token, index) => (
            <FilterTokenBadge
              token={token}
              onRemove={() => removeToken(index())}
            />
          )}
        </For>

        <input
          ref={inputRef}
          type="text"
          style={{
            flex: "1",
            "min-width": "80px",
            background: "transparent",
            outline: "none",
            border: "none",
            "font-size": "var(--jb-text-body-size)",
            color: tokens.colors.text.primary,
          }}
          placeholder={props.parsedFilter.tokens.length === 0 ? "Filter (e.g. error, file:app.ts)" : ""}
          value={props.filterInput}
          onInput={(e) => props.onFilterChange(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </div>

      {/* Filter type buttons */}
      <div class="flex items-center gap-0.5">
        <IconButton
          size="sm"
          active={props.parsedFilter.severities.has("error")}
          tooltip="Filter errors"
          onClick={() => props.onQuickFilter("error")}
        >
          <span style={{ color: SEVERITY_COLORS.error }}>
            <ErrorIcon />
          </span>
        </IconButton>
        <IconButton
          size="sm"
          active={props.parsedFilter.severities.has("warning")}
          tooltip="Filter warnings"
          onClick={() => props.onQuickFilter("warning")}
        >
          <span style={{ color: SEVERITY_COLORS.warning }}>
            <WarningIcon />
          </span>
        </IconButton>
        <IconButton
          size="sm"
          active={props.parsedFilter.severities.has("information")}
          tooltip="Filter info"
          onClick={() => props.onQuickFilter("info")}
        >
          <span style={{ color: SEVERITY_COLORS.information }}>
            <InfoIcon />
          </span>
        </IconButton>
      </div>

      {/* Clear button */}
      <Show when={props.filterInput || props.activeFilterCount > 0}>
        <IconButton
          size="sm"
          tooltip="Clear all filters"
          onClick={props.onClear}
        >
          <Icon name="xmark" />
        </IconButton>
      </Show>
    </div>
  );
}

// ============================================================================
// Main DiagnosticsPanel Component
// ============================================================================

export interface DiagnosticsPanelProps {
  maxHeight?: string;
  showEmpty?: boolean;
  filterSeverity?: DiagnosticSeverity[];
  onDiagnosticClick?: (uri: string, line: number, column: number) => void;
  onClose?: () => void;
  isEmbedded?: boolean;
}

export function DiagnosticsPanel(props: DiagnosticsPanelProps) {
  const diagnostics = useDiagnostics();
  const lsp = useLSP();
  const { openFile } = useEditor();

  // Load persisted filter on mount
  const persistedFilter = loadPersistedFilter();

  // State for enhanced filtering
  const [filterInput, setFilterInput] = createSignal(persistedFilter?.filterInput ?? "");
  const [copiedId, setCopiedId] = createSignal<string | null>(null);
  const [showFilterBar, setShowFilterBar] = createSignal(true);

  // State for Quick Fix Menu
  const [quickFixMenuState, setQuickFixMenuState] = createSignal<{
    isOpen: boolean;
    position: { x: number; y: number };
    diagnostic: UnifiedDiagnostic | null;
    codeActions: CodeAction[];
    isLoading: boolean;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    diagnostic: null,
    codeActions: [],
    isLoading: false,
  });

  // Element refs for keyboard navigation
  let containerRef: HTMLDivElement | undefined;
  const itemRefs: Map<number, HTMLButtonElement> = new Map();

  // Computed values from context
  const groupMode = () => diagnostics.state.groupMode;
  const filter = () => diagnostics.state.filter;
  const selectedId = () => diagnostics.state.selectedDiagnosticId;
  const isRefreshing = () => diagnostics.state.isRefreshing;

  // Parse filter input into structured tokens
  const parsedFilter = createMemo(() => parseFilterInput(filterInput()));

  // Persist filter settings on change
  createEffect(() => {
    const currentFilter = filter();
    const settings: PersistedFilterSettings = {
      filterInput: filterInput(),
      showErrors: currentFilter.showErrors,
      showWarnings: currentFilter.showWarnings,
      showInformation: currentFilter.showInformation,
      showHints: currentFilter.showHints,
      currentFileOnly: currentFilter.currentFileOnly,
    };
    savePersistedFilter(settings);
  });

  // Apply persisted filter on mount
  onMount(() => {
    if (persistedFilter) {
      diagnostics.setFilter({
        showErrors: persistedFilter.showErrors,
        showWarnings: persistedFilter.showWarnings,
        showInformation: persistedFilter.showInformation,
        showHints: persistedFilter.showHints,
        currentFileOnly: persistedFilter.currentFileOnly,
      });
    }
  });

  // Computed: All diagnostics with enhanced filters applied
  const allDiagnostics = createMemo(() => {
    let items = diagnostics.getFilteredDiagnostics();
    const parsed = parsedFilter();

    // Apply prop-based severity filter if provided
    if (props.filterSeverity) {
      items = items.filter((d) => props.filterSeverity!.includes(d.severity));
    }

    // Apply parsed filter tokens
    if (parsed.tokens.length > 0) {
      // If specific severities are in filter, override the toggle filters
      if (parsed.severities.size > 0) {
        items = items.filter((d) => parsed.severities.has(d.severity));
      }

      // Filter by file name
      if (parsed.files.length > 0) {
        items = items.filter((d) => {
          const fileName = getFileName(d.uri).toLowerCase();
          const relativePath = getRelativePath(d.uri).toLowerCase();
          return parsed.files.some(
            (f) => fileName.includes(f) || relativePath.includes(f)
          );
        });
      }

      // Filter by source
      if (parsed.sources.length > 0) {
        items = items.filter((d) => {
          const source = d.source.toLowerCase();
          const sourceName = (d.sourceName || "").toLowerCase();
          return parsed.sources.some(
            (s) => source.includes(s) || sourceName.includes(s)
          );
        });
      }

      // Filter by text search in message
      if (parsed.textSearch) {
        const searchTerms = parsed.textSearch.toLowerCase().split(/\s+/);
        items = items.filter((d) => {
          const message = d.message.toLowerCase();
          const code = String(d.code || "").toLowerCase();
          return searchTerms.every(
            (term) => message.includes(term) || code.includes(term)
          );
        });
      }
    }

    return items;
  });

  // Computed: Active filter count for badge
  const activeFilterCount = createMemo(() => {
    let count = 0;
    const f = filter();
    const parsed = parsedFilter();

    // Count from parsed tokens
    count += parsed.tokens.length;

    // Count from toggle filters that are OFF (non-default state)
    if (!f.showErrors) count++;
    if (!f.showWarnings) count++;
    if (!f.showInformation) count++;
    if (!f.showHints) count++;
    if (f.currentFileOnly) count++;

    return count;
  });

  // Computed: Total counts for filters
  const totalCounts = createMemo(() => diagnostics.getCounts());

  // Computed: Flat list for keyboard navigation
  const flatList = createMemo(() => allDiagnostics());

  const isEmpty = () => allDiagnostics().length === 0;

  // Get selected index
  const selectedIndex = createMemo(() => {
    if (!selectedId()) return -1;
    return flatList().findIndex((d) => d.id === selectedId());
  });

  // Reset selection when diagnostics change
  createEffect(() => {
    const items = allDiagnostics();
    if (selectedIndex() >= items.length && items.length > 0) {
      diagnostics.selectDiagnostic(items[0].id);
    }
  });

  // Navigation handlers
  const handleDiagnosticClick = (item: UnifiedDiagnostic) => {
    const { start } = item.range;
    diagnostics.selectDiagnostic(item.id);

    if (props.onDiagnosticClick) {
      props.onDiagnosticClick(item.uri, start.line + 1, start.character + 1);
    } else {
      const filePath = item.uri.replace(/^file:\/\//, "");
      openFile(filePath);

      window.dispatchEvent(
        new CustomEvent("navigate-to-line", {
          detail: {
            line: start.line + 1,
            column: start.character + 1,
          },
        })
      );
    }
  };

  const handleCopy = async (item: UnifiedDiagnostic) => {
    const { start } = item.range;
    const message = `${getRelativePath(item.uri)}:${start.line + 1}:${start.character + 1}: ${item.message}`;
    await copyToClipboard(message);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open Quick Fix menu for a diagnostic
  const handleQuickFix = (item: UnifiedDiagnostic, _e: MouseEvent, buttonRect: DOMRect) => {
    // Set position based on button location
    const position = {
      x: buttonRect.left,
      y: buttonRect.bottom + 4,
    };

    // Set menu state with existing code actions
    setQuickFixMenuState({
      isOpen: true,
      position,
      diagnostic: item,
      codeActions: item.codeActions || [],
      isLoading: !item.codeActions || item.codeActions.length === 0,
    });

    // If no code actions are cached, request them from LSP
    if (!item.codeActions || item.codeActions.length === 0) {
      window.dispatchEvent(
        new CustomEvent("lsp:request-code-actions", {
          detail: {
            uri: item.uri,
            range: item.range,
            diagnostics: [item],
            callback: (actions: CodeAction[]) => {
              setQuickFixMenuState((prev) => ({
                ...prev,
                codeActions: actions,
                isLoading: false,
              }));
            },
          },
        })
      );

      // Fallback: Clear loading state after timeout
      setTimeout(() => {
        setQuickFixMenuState((prev) => ({
          ...prev,
          isLoading: false,
        }));
      }, 3000);
    }
  };

  // Close Quick Fix menu
  const closeQuickFixMenu = () => {
    setQuickFixMenuState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  };

  // Apply a single code action fix
  const handleApplyFix = (action: CodeAction) => {
    diagnostics.applyCodeAction(action);
    closeQuickFixMenu();
  };

  // Fix all issues in the same file
  const handleFixAllInFile = (diagnostic: UnifiedDiagnostic) => {
    const fileDiagnostics = diagnostics.getDiagnosticsForFile(diagnostic.uri);
    for (const diag of fileDiagnostics) {
      if (diag.codeActions && diag.codeActions.length > 0) {
        const preferred = diag.codeActions.find((a) => a.isPreferred);
        if (preferred) {
          diagnostics.applyCodeAction(preferred);
        } else {
          diagnostics.applyCodeAction(diag.codeActions[0]);
        }
      }
    }
    closeQuickFixMenu();
  };

  // Fix all issues of the same type (same diagnostic code)
  const handleFixAllOfType = (diagnostic: UnifiedDiagnostic) => {
    if (!diagnostic.code) {
      closeQuickFixMenu();
      return;
    }

    const allDiags = diagnostics.getAllDiagnostics();
    const sameTypeDiags = allDiags.filter((d) => d.code === diagnostic.code);

    for (const diag of sameTypeDiags) {
      if (diag.codeActions && diag.codeActions.length > 0) {
        const preferred = diag.codeActions.find((a) => a.isPreferred);
        if (preferred) {
          diagnostics.applyCodeAction(preferred);
        } else {
          diagnostics.applyCodeAction(diag.codeActions[0]);
        }
      }
    }
    closeQuickFixMenu();
  };

  const toggleSeverityFilter = (severity: DiagnosticSeverity) => {
    const key = `show${severity.charAt(0).toUpperCase() + severity.slice(1)}s` as keyof typeof filter;
    diagnostics.setFilter({ [key]: !filter()[key as keyof typeof filter] });
  };

  // Handle filter input change
  const handleFilterChange = (input: string) => {
    setFilterInput(input);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setFilterInput("");
    diagnostics.resetFilter();
    clearPersistedFilter();
  };

  // Handle quick filter button clicks - toggles filter on/off
  const handleQuickFilterClick = (filterText: string) => {
    const currentInput = filterInput();
    const parsed = parseFilterInput(currentInput);
    const alreadyExists = parsed.tokens.some(
      (t) => t.raw.toLowerCase() === filterText.toLowerCase()
    );
    
    if (alreadyExists) {
      // Remove it
      const newTokens = parsed.tokens.filter(
        (t) => t.raw.toLowerCase() !== filterText.toLowerCase()
      );
      setFilterInput(newTokens.map((t) => t.raw).join(" "));
    } else {
      // Add it
      const newInput = currentInput ? `${currentInput} ${filterText}` : filterText;
      setFilterInput(newInput);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    const items = flatList();
    if (items.length === 0) return;

    const currentIdx = selectedIndex();

    switch (e.key) {
      case "ArrowDown":
      case "j":
        e.preventDefault();
        if (currentIdx < items.length - 1) {
          diagnostics.selectDiagnostic(items[currentIdx + 1].id);
        }
        break;
      case "ArrowUp":
      case "k":
        e.preventDefault();
        if (currentIdx > 0) {
          diagnostics.selectDiagnostic(items[currentIdx - 1].id);
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (currentIdx >= 0 && currentIdx < items.length) {
          handleDiagnosticClick(items[currentIdx]);
        }
        break;
      case "Home":
        e.preventDefault();
        if (items.length > 0) {
          diagnostics.selectDiagnostic(items[0].id);
        }
        break;
      case "End":
        e.preventDefault();
        if (items.length > 0) {
          diagnostics.selectDiagnostic(items[items.length - 1].id);
        }
        break;
      case "c":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (currentIdx >= 0 && currentIdx < items.length) {
            handleCopy(items[currentIdx]);
          }
        }
        break;
      case ".":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (currentIdx >= 0 && currentIdx < items.length) {
            const itemEl = itemRefs.get(currentIdx);
            if (itemEl) {
              const rect = itemEl.getBoundingClientRect();
              // Create a mock rect at the right edge of the item
              const buttonRect = new DOMRect(rect.right - 32, rect.top, 24, rect.height);
              handleQuickFix(items[currentIdx], e as unknown as MouseEvent, buttonRect);
            }
          }
        }
        break;
      case "f":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setShowFilterBar(!showFilterBar());
        }
        break;
      case "Escape":
        if (props.onClose) {
          e.preventDefault();
          props.onClose();
        }
        break;
    }
  };

  // Focus selected item when selection changes
  createEffect(() => {
    const index = selectedIndex();
    const el = itemRefs.get(index);
    if (el) {
      el.focus();
      el.scrollIntoView({ block: "nearest" });
    }
  });

  // Global keyboard listener when panel is focused
  onMount(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!containerRef?.contains(document.activeElement)) return;
      handleKeyDown(e);
    };

    // Handle code action requests from the quick fix menu
    const handleCodeActionRequest = async (e: Event) => {
      const detail = (e as CustomEvent<{
        uri: string;
        range: { start: { line: number; character: number }; end: { line: number; character: number } };
        diagnostics: UnifiedDiagnostic[];
        callback: (actions: CodeAction[]) => void;
      }>).detail;

      if (!detail?.callback) return;

      try {
        // Get the server for this file
        const serverInfo = lsp.getServerForFile(detail.uri);
        if (!serverInfo || serverInfo.status !== "running") {
          detail.callback([]);
          return;
        }
        const serverId = serverInfo.id;

        // Convert UnifiedDiagnostic to the format expected by LSP
        const lspDiagnostics = detail.diagnostics.map((d) => ({
          range: d.range,
          severity: d.severity,
          code: d.code !== undefined ? String(d.code) : undefined,
          source: d.sourceName || d.source,
          message: d.message,
          relatedInformation: d.relatedInformation,
        }));

        // Request code actions from LSP
        const result = await lsp.getCodeActions(
          serverId,
          detail.uri,
          detail.range,
          lspDiagnostics
        );

        // Map the result actions to our CodeAction type
        const actions: CodeAction[] = result.actions.map((action) => ({
          title: action.title,
          kind: action.kind,
          isPreferred: action.isPreferred,
          edit: action.edit,
          command: action.command,
        }));

        detail.callback(actions);
      } catch (error) {
        console.error("[DiagnosticsPanel] Failed to get code actions:", error);
        detail.callback([]);
      }
    };

    // Handle LSP execute command requests
    const handleExecuteCommand = async (e: Event) => {
      const detail = (e as CustomEvent<{
        command: string;
        arguments?: unknown[];
      }>).detail;

      if (!detail?.command) return;

      try {
        // Find a running server to execute the command
        const servers = Object.keys(lsp.state.servers);
        const runningServer = servers.find(
          (id) => lsp.state.servers[id].status === "running"
        );

        if (runningServer) {
          // Execute via Tauri backend
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("lsp_execute_command", {
            serverId: runningServer,
            command: detail.command,
            arguments: detail.arguments || [],
          });
        }
      } catch (error) {
        console.error("[DiagnosticsPanel] Failed to execute command:", error);
      }
    };

    // Handle editor apply-edit requests for code actions
    const handleApplyEdit = (e: Event) => {
      const detail = (e as CustomEvent<{
        uri: string;
        range: { start: { line: number; character: number }; end: { line: number; character: number } };
        newText: string;
      }>).detail;

      if (!detail) return;

      // Dispatch to Monaco editor if available
      window.dispatchEvent(
        new CustomEvent("monaco:apply-edit", {
          detail: {
            uri: detail.uri,
            range: detail.range,
            text: detail.newText,
          },
        })
      );
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("lsp:request-code-actions", handleCodeActionRequest);
    window.addEventListener("lsp:execute-command", handleExecuteCommand);
    window.addEventListener("editor:apply-edit", handleApplyEdit);

    onCleanup(() => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("lsp:request-code-actions", handleCodeActionRequest);
      window.removeEventListener("lsp:execute-command", handleExecuteCommand);
      window.removeEventListener("editor:apply-edit", handleApplyEdit);
    });
  });

  // Render grouped by file
  const renderGroupedByFile = () => {
    const groups = diagnostics.getDiagnosticsGroupedByFile();
    const entries = Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    return (
      <For each={entries}>
        {([uri, items]) => (
          <CollapsibleSection
            title={getRelativePath(uri)}
            count={items.length}
            icon={<Icon name="file" class="w-3.5 h-3.5" />}
            defaultOpen={true}
          >
            <div>
              <For each={items}>
                {(item) => {
                  const index = flatList().findIndex((d) => d.id === item.id);
                  return (
                    <DiagnosticItem
                      item={item}
                      isSelected={selectedIndex() === index}
                      showFileName={false}
                      showSource={true}
                      onClick={() => handleDiagnosticClick(item)}
                      onCopy={() => handleCopy(item)}
                      onQuickFix={(e, rect) => handleQuickFix(item, e, rect)}
                      onKeyDown={handleKeyDown}
                      ref={(el) => itemRefs.set(index, el)}
                    />
                  );
                }}
              </For>
            </div>
          </CollapsibleSection>
        )}
      </For>
    );
  };

  // Render grouped by severity
  const renderGroupedBySeverity = () => {
    const groups = diagnostics.getDiagnosticsGroupedBySeverity();
    const severities: DiagnosticSeverity[] = [
      "error",
      "warning",
      "information",
      "hint",
    ];

    return (
      <For each={severities}>
        {(severity) => {
          const items = groups.get(severity) || [];
          if (items.length === 0) return null;

          return (
            <CollapsibleSection
              title={SEVERITY_LABELS[severity]}
              count={items.length}
              icon={SEVERITY_ICONS[severity]()}
              iconColor={SEVERITY_COLORS[severity]}
              defaultOpen={severity === "error" || severity === "warning"}
            >
              <div>
                <For each={items}>
                  {(item) => {
                    const index = flatList().findIndex((d) => d.id === item.id);
                    return (
                      <DiagnosticItem
                        item={item}
                        isSelected={selectedIndex() === index}
                        showFileName={true}
                        showSource={true}
                        onClick={() => handleDiagnosticClick(item)}
                        onCopy={() => handleCopy(item)}
                        onQuickFix={(e, rect) => handleQuickFix(item, e, rect)}
                        onKeyDown={handleKeyDown}
                        ref={(el) => itemRefs.set(index, el)}
                      />
                    );
                  }}
                </For>
              </div>
            </CollapsibleSection>
          );
        }}
      </For>
    );
  };

  // Render grouped by source
  const renderGroupedBySource = () => {
    const groups = diagnostics.getDiagnosticsGroupedBySource();
    const entries = Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    return (
      <For each={entries}>
        {([source, items]) => {
          if (items.length === 0) return null;

          const SourceIcon = SOURCE_ICONS[source];

          return (
            <CollapsibleSection
              title={SOURCE_LABELS[source]}
              count={items.length}
              icon={<SourceIcon />}
              defaultOpen={true}
            >
              <div>
                <For each={items}>
                  {(item) => {
                    const index = flatList().findIndex((d) => d.id === item.id);
                    return (
                      <DiagnosticItem
                        item={item}
                        isSelected={selectedIndex() === index}
                        showFileName={true}
                        showSource={false}
                        onClick={() => handleDiagnosticClick(item)}
                        onCopy={() => handleCopy(item)}
                        onQuickFix={(e, rect) => handleQuickFix(item, e, rect)}
                        onKeyDown={handleKeyDown}
                        ref={(el) => itemRefs.set(index, el)}
                      />
                    );
                  }}
                </For>
              </div>
            </CollapsibleSection>
          );
        }}
      </For>
    );
  };

  const handleExport = (format: "json" | "csv" | "markdown") => {
    diagnostics.exportToFile(format);
  };

  return (
    <div
      ref={containerRef}
      class="flex flex-col"
      style={{
        background: tokens.colors.surface.panel,
        "border-top": `1px solid ${tokens.colors.border.default}`,
        "max-height": props.maxHeight ?? "300px",
      }}
      tabIndex={-1}
    >
      {/* Header with counts and controls - JetBrains style */}
      <div
        class="flex items-center gap-1 px-2 shrink-0"
        style={{
          height: "35px",
          background: tokens.colors.surface.panel,
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
        }}
      >
        <Text variant="header">Problems</Text>

        {/* Severity counts with colored badges */}
        <div class="flex items-center gap-2 ml-2">
          <button
            class="flex items-center gap-1 transition-opacity hover:opacity-80"
            classList={{
              "opacity-100": filter().showErrors,
              "opacity-40": !filter().showErrors,
            }}
            onClick={() => toggleSeverityFilter("error")}
            title={`${filter().showErrors ? "Hide" : "Show"} errors`}
          >
            <span style={{ color: SEVERITY_COLORS.error }}>
              <ErrorIcon />
            </span>
            <Badge variant="error">{totalCounts().error}</Badge>
          </button>
          <button
            class="flex items-center gap-1 transition-opacity hover:opacity-80"
            classList={{
              "opacity-100": filter().showWarnings,
              "opacity-40": !filter().showWarnings,
            }}
            onClick={() => toggleSeverityFilter("warning")}
            title={`${filter().showWarnings ? "Hide" : "Show"} warnings`}
          >
            <span style={{ color: SEVERITY_COLORS.warning }}>
              <WarningIcon />
            </span>
            <Badge variant="warning">{totalCounts().warning}</Badge>
          </button>
          <Show when={totalCounts().information > 0}>
            <button
              class="flex items-center gap-1 transition-opacity hover:opacity-80"
              classList={{
                "opacity-100": filter().showInformation,
                "opacity-40": !filter().showInformation,
              }}
              onClick={() => toggleSeverityFilter("information")}
              title={`${filter().showInformation ? "Hide" : "Show"} info`}
            >
              <span style={{ color: SEVERITY_COLORS.information }}>
                <InfoIcon />
              </span>
              <Badge variant="accent">{totalCounts().information}</Badge>
            </button>
          </Show>
        </div>

        <div class="flex-1" />

        {/* Current file filter */}
        <IconButton
          size="md"
          active={filter().currentFileOnly}
          tooltip="Show only current file diagnostics"
          onClick={() =>
            diagnostics.setFilter({ currentFileOnly: !filter().currentFileOnly })
          }
        >
          <Icon name="crosshairs" />
        </IconButton>

        {/* Refresh button */}
        <IconButton
          size="md"
          tooltip="Refresh diagnostics"
          onClick={() => diagnostics.refreshDiagnostics()}
          style={{
            animation: isRefreshing() ? "spin 1s linear infinite" : undefined,
          }}
        >
          <Icon name="rotate" />
        </IconButton>

        {/* Export menu */}
        <ExportMenu onExport={handleExport} />

        {/* Group mode toggle */}
        <div
          class="flex items-center gap-0.5 rounded overflow-hidden"
          style={{ background: "var(--jb-surface-active)" }}
        >
          <IconButton
            size="md"
            active={groupMode() === "file"}
            tooltip="Group by file"
            onClick={() => diagnostics.setGroupMode("file")}
          >
            <Icon name="file" />
          </IconButton>
          <IconButton
            size="md"
            active={groupMode() === "severity"}
            tooltip="Group by severity"
            onClick={() => diagnostics.setGroupMode("severity")}
          >
            <Icon name="layer-group" />
          </IconButton>
          <IconButton
            size="md"
            active={groupMode() === "source"}
            tooltip="Group by source"
            onClick={() => diagnostics.setGroupMode("source")}
          >
            <Icon name="code" />
          </IconButton>
        </div>

        {/* Toggle filter bar */}
        <IconButton
          size="md"
          active={showFilterBar()}
          tooltip="Toggle filter bar (Ctrl+F)"
          onClick={() => setShowFilterBar(!showFilterBar())}
        >
          <Icon name="filter" />
        </IconButton>

        {/* Close button */}
        <Show when={props.onClose}>
          <IconButton
            size="md"
            tooltip="Close (Esc)"
            onClick={props.onClose}
          >
            <Icon name="xmark" />
          </IconButton>
        </Show>
      </div>

      {/* Enhanced Filter Bar */}
      <Show when={showFilterBar()}>
        <FilterInputBar
          filterInput={filterInput()}
          parsedFilter={parsedFilter()}
          onFilterChange={handleFilterChange}
          onClear={handleClearFilters}
          activeFilterCount={activeFilterCount()}
          onQuickFilter={handleQuickFilterClick}
        />
      </Show>

      {/* Diagnostics list */}
      <div class="flex-1 overflow-y-auto" style={{ background: tokens.colors.surface.panel }}>
        <Show when={!isEmpty()}>
          <Show
            when={groupMode() === "file"}
            fallback={
              <Show
                when={groupMode() === "severity"}
                fallback={renderGroupedBySource()}
              >
                {renderGroupedBySeverity()}
              </Show>
            }
          >
            {renderGroupedByFile()}
          </Show>
        </Show>
        <Show when={isEmpty() && props.showEmpty !== false}>
          <div
            class="flex flex-col items-center justify-center h-24"
            style={{ color: tokens.colors.text.muted }}
          >
            <Icon name="check" class="w-6 h-6 mb-2" style={{ color: tokens.colors.semantic.success }} />
            <Text variant="body">No problems detected</Text>
          </div>
        </Show>
      </div>

      {/* Keyboard shortcuts hint - JetBrains style */}
      <Show when={!isEmpty() && !props.isEmbedded}>
        <div
          class="flex items-center gap-3 px-2"
          style={{
            height: "22px",
            "border-top": `1px solid ${tokens.colors.border.default}`,
            background: tokens.colors.surface.panel,
          }}
        >
          <Text variant="muted" size="xs">
            <kbd style={{ padding: `1px ${tokens.spacing.sm}`, "border-radius": tokens.radius.sm, background: tokens.colors.interactive.active }}>
              ↑↓
            </kbd>{" "}
            Navigate
          </Text>
          <Text variant="muted" size="xs">
            <kbd style={{ padding: `1px ${tokens.spacing.sm}`, "border-radius": tokens.radius.sm, background: tokens.colors.interactive.active }}>
              Enter
            </kbd>{" "}
            Go to
          </Text>
          <Text variant="muted" size="xs">
            <kbd style={{ padding: `1px ${tokens.spacing.sm}`, "border-radius": tokens.radius.sm, background: tokens.colors.interactive.active }}>
              Ctrl+.
            </kbd>{" "}
            Quick Fix
          </Text>
        </div>
      </Show>

      {/* Copy notification */}
      <Show when={copiedId()}>
        <div
          class="absolute bottom-4 right-4 px-3 py-2 rounded shadow-lg"
          style={{
            background: tokens.colors.surface.elevated,
            border: `1px solid ${tokens.colors.border.default}`,
            "border-radius": tokens.radius.md,
          }}
        >
          <Text variant="body">Copied to clipboard</Text>
        </div>
      </Show>

      {/* Quick Fix Menu */}
      <QuickFixMenu
        isOpen={quickFixMenuState().isOpen}
        position={quickFixMenuState().position}
        diagnostic={quickFixMenuState().diagnostic}
        codeActions={quickFixMenuState().codeActions}
        isLoading={quickFixMenuState().isLoading}
        onClose={closeQuickFixMenu}
        onApplyFix={handleApplyFix}
        onFixAllInFile={handleFixAllInFile}
        onFixAllOfType={handleFixAllOfType}
      />
    </div>
  );
}

// ============================================================================
// DiagnosticsSummary - Compact status bar component
// ============================================================================

export interface DiagnosticsSummaryProps {
  onClick?: () => void;
}

export function DiagnosticsSummary(props: DiagnosticsSummaryProps) {
  // Try to use DiagnosticsContext, fall back to LSP context for backwards compatibility
  let counts: () => { error: number; warning: number; info: number };

  try {
    const diagnostics = useDiagnostics();
    counts = createMemo(() => {
      const c = diagnostics.getCounts();
      return {
        error: c.error,
        warning: c.warning,
        info: c.information,
      };
    });
  } catch {
    // Fall back to LSP context
    const lsp = useLSP();
    counts = createMemo(() => {
      const result = { error: 0, warning: 0, info: 0 };

      for (const doc of lsp.getAllDiagnostics()) {
        for (const diag of doc.diagnostics) {
          if (diag.severity === "error") result.error++;
          else if (diag.severity === "warning") result.warning++;
          else if (diag.severity === "information") result.info++;
        }
      }

      return result;
    });
  }

  const hasIssues = () => counts().error > 0 || counts().warning > 0;

  return (
    <button
      class="flex items-center gap-2 cursor-pointer"
      style={{
        padding: "0 5px",
        "line-height": "22px",
        transition: "background-color var(--cortex-transition-fast)",
        background: "transparent",
        border: "none",
      }}
      onClick={props.onClick}
      title={`${counts().error} errors, ${counts().warning} warnings - Click to show Problems panel`}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = tokens.colors.interactive.hover;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <Show
        when={hasIssues()}
        fallback={
          <span class="flex items-center gap-1" style={{ color: tokens.colors.semantic.success }}>
            <Icon name="check" class="w-3.5 h-3.5" />
          </span>
        }
      >
        <Show when={counts().error > 0}>
          <span
            style={{ color: SEVERITY_COLORS.error }}
            class="flex items-center gap-1"
          >
            <ErrorIcon />
            <Text size="sm" style={{ color: "inherit" }}>{counts().error}</Text>
          </span>
        </Show>
        <Show when={counts().warning > 0}>
          <span
            style={{ color: SEVERITY_COLORS.warning }}
            class="flex items-center gap-1"
          >
            <WarningIcon />
            <Text size="sm" style={{ color: "inherit" }}>{counts().warning}</Text>
          </span>
        </Show>
      </Show>
    </button>
  );
}

// ============================================================================
// InlineDiagnostics - For showing inline in editor
// ============================================================================

export interface InlineDiagnosticsProps {
  uri: string;
  line: number;
}

export function InlineDiagnostics(props: InlineDiagnosticsProps) {
  let lineDiagnostics: () => UnifiedDiagnostic[];

  try {
    const diagnostics = useDiagnostics();
    lineDiagnostics = createMemo(() => {
      const all = diagnostics.getDiagnosticsForFile(props.uri);
      return all.filter((d) => d.range.start.line === props.line);
    });
  } catch {
    // Fall back to LSP context
    const lsp = useLSP();
    lineDiagnostics = createMemo(() => {
      const diagnosticsRaw = lsp.getDiagnosticsForFile(props.uri);
      return diagnosticsRaw
        .filter((d) => d.range.start.line === props.line)
        .map((d) => ({
          id: `lsp-${props.line}-${d.message.slice(0, 20)}`,
          uri: props.uri,
          range: d.range,
          severity: d.severity ?? ("information" as DiagnosticSeverity),
          code: d.code,
          source: "lsp" as DiagnosticSource,
          sourceName: d.source,
          message: d.message,
          timestamp: Date.now(),
        }));
    });
  }

  const mostSevere = createMemo(() => {
    const diags = lineDiagnostics();
    if (diags.length === 0) return null;

    let mostSevere = diags[0];
    for (const diag of diags) {
      const currentOrder = SEVERITY_ORDER[diag.severity ?? "information"];
      const bestOrder = SEVERITY_ORDER[mostSevere.severity ?? "information"];
      if (currentOrder < bestOrder) {
        mostSevere = diag;
      }
    }
    return mostSevere;
  });

  return (
    <Show when={mostSevere()}>
      {(diag) => {
        const severity = diag().severity ?? "information";
        return (
          <Text
            size="xs"
            style={{
              "margin-left": "16px",
              opacity: "0.8",
              color: SEVERITY_COLORS[severity],
            }}
          >
            {diag().message}
          </Text>
        );
      }}
    </Show>
  );
}

// ============================================================================
// ProblemsBottomPanel - The toggleable bottom panel
// ============================================================================

export interface ProblemsBottomPanelProps {
  isOpen: boolean;
  onClose: () => void;
  height?: string;
}

export function ProblemsBottomPanel(props: ProblemsBottomPanelProps) {
  return (
    <Show when={props.isOpen}>
      <div
        class="transition-all duration-200"
        style={{
          height: props.height ?? "200px",
          "border-top": `1px solid ${tokens.colors.border.default}`,
        }}
      >
        <DiagnosticsPanel maxHeight="100%" onClose={props.onClose} showEmpty={true} />
      </div>
    </Show>
  );
}
