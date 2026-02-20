/**
 * Configure Default Editor Dialog
 *
 * Dialog for configuring the default editor for a file type/pattern.
 * Features:
 * - Shows the file pattern being configured
 * - Lists all available editors with icons
 * - Radio selection for choosing default
 * - Option to apply to all similar files
 * - Reset to default option
 */

import {
  Show,
  For,
  createSignal,
  createMemo,
  createEffect,
  type JSX,
} from "solid-js";
import { Portal } from "solid-js/web";
import {
  useEditorAssociations,
  type AvailableEditor,
} from "@/context/EditorAssociationsContext";
import { Icon } from "./ui/Icon";
import { Button, Text, Badge } from "@/components/ui";

// ============================================================================
// Icon Mapping
// ============================================================================

const EDITOR_ICON_NAMES: Record<string, string> = {
  default: "file",
  monaco: "code",
  imagePreview: "image",
  videoPlayer: "play",
  audioPlayer: "volume-high",
  pdfViewer: "file-lines",
  hexEditor: "hexagon",
  markdownPreview: "book-open",
  notebookEditor: "box",
};

function getEditorIconName(editorId: string): string {
  return EDITOR_ICON_NAMES[editorId] || "file";
}

// ============================================================================
// Types
// ============================================================================

export interface ConfigureDefaultEditorDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** File pattern being configured (e.g., "*.png", "*.md") */
  pattern: string;
  /** Current default editor ID */
  currentEditor: string;
  /** Available editors for this file type */
  availableEditors: AvailableEditor[];
  /** Callback when an editor is selected and saved */
  onSave: (editorId: string) => void;
  /** Callback when dialog is cancelled */
  onCancel: () => void;
  /** Optional file path that triggered this dialog (for context) */
  filePath?: string;
}

// ============================================================================
// Styles
// ============================================================================

const overlayStyle: JSX.CSSProperties = {
  position: "fixed",
  inset: "0",
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  background: "var(--jb-overlay-backdrop)",
  "z-index": "var(--cortex-z-highest)",
};

const dialogStyle: JSX.CSSProperties = {
  background: "var(--jb-modal)",
  "border-radius": "var(--jb-radius-lg)",
  "box-shadow": "var(--jb-shadow-modal)",
  display: "flex",
  "flex-direction": "column",
  "max-height": "80vh",
  width: "480px",
  "max-width": "90vw",
  overflow: "hidden",
};

const headerStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  padding: "12px 16px",
  "border-bottom": "1px solid var(--jb-border-default)",
  "flex-shrink": "0",
};

const titleStyle: JSX.CSSProperties = {
  "font-family": "var(--jb-font-ui)",
  "font-size": "14px",
  "font-weight": "600",
  color: "var(--jb-text-body-color)",
  margin: "0",
};

const closeButtonStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  width: "24px",
  height: "24px",
  background: "transparent",
  border: "none",
  "border-radius": "var(--jb-radius-sm)",
  color: "var(--jb-text-muted-color)",
  cursor: "pointer",
  transition: "background var(--cortex-transition-fast)",
};

const bodyStyle: JSX.CSSProperties = {
  padding: "16px",
  "overflow-y": "auto",
  flex: "1",
  "font-family": "var(--jb-font-ui)",
  "font-size": "var(--jb-text-body-size)",
  color: "var(--jb-text-body-color)",
};

const footerStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  gap: "8px",
  padding: "12px 16px",
  "border-top": "1px solid var(--jb-border-default)",
  "flex-shrink": "0",
};

// ============================================================================
// Component
// ============================================================================

export function ConfigureDefaultEditorDialog(
  props: ConfigureDefaultEditorDialogProps
) {
  const editorAssociations = useEditorAssociations();
  const [selectedEditor, setSelectedEditor] = createSignal<string>(
    props.currentEditor
  );
  const [closeHover, setCloseHover] = createSignal(false);

  // Reset selection when dialog opens with new pattern
  createEffect(() => {
    if (props.isOpen) {
      setSelectedEditor(props.currentEditor);
    }
  });

  // Check if current association is user-defined
  const hasUserAssociation = createMemo(() =>
    editorAssociations.hasUserAssociation(props.pattern)
  );

  // Handle save
  const handleSave = () => {
    props.onSave(selectedEditor());
  };

  // Handle reset to default
  const handleReset = () => {
    editorAssociations.resetAssociation(props.pattern);
    // Get the new default editor after reset
    const newDefault = editorAssociations.getEditorForFile(
      props.filePath || props.pattern.replace("*", "file")
    );
    setSelectedEditor(newDefault);
  };

  // Handle overlay click
  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onCancel();
    }
  };

  // Handle keyboard
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      props.onCancel();
    } else if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      handleSave();
    }
  };

  // Get file type description
  const fileTypeDescription = createMemo(() => {
    const pattern = props.pattern;
    if (pattern.startsWith("*.")) {
      const ext = pattern.slice(2).toUpperCase();
      return `${ext} files`;
    }
    return `"${pattern}" files`;
  });

  return (
    <Show when={props.isOpen}>
      <Portal>
        <div
          style={overlayStyle}
          onClick={handleOverlayClick}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="configure-editor-title"
          tabIndex={-1}
        >
          <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={headerStyle}>
              <h2 id="configure-editor-title" style={titleStyle}>
                Configure Default Editor
              </h2>
              <button
                type="button"
                style={{
                  ...closeButtonStyle,
                  background: closeHover()
                    ? "var(--jb-surface-hover)"
                    : "transparent",
                }}
                onClick={props.onCancel}
                onMouseEnter={() => setCloseHover(true)}
                onMouseLeave={() => setCloseHover(false)}
                aria-label="Close dialog"
              >
                <Icon name="xmark" size={14} />
              </button>
            </div>

            {/* Body */}
            <div style={bodyStyle}>
              {/* Pattern info */}
              <div
                style={{
                  "margin-bottom": "16px",
                  padding: "12px",
                  background: "var(--jb-surface-bg)",
                  "border-radius": "var(--jb-radius-md)",
                  border: "1px solid var(--jb-border-default)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    "margin-bottom": "4px",
                  }}
                >
                  <Icon
                    name="file"
                    size={14}
                    style={{
                      color: "var(--jb-text-muted-color)",
                    }}
                  />
                  <Text size="sm" weight="medium">
                    File Pattern
                  </Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    "margin-left": "22px",
                  }}
                >
                  <code
                    style={{
                      "font-family": "var(--jb-font-mono)",
                      "font-size": "13px",
                      color: "var(--cortex-warning)",
                      background: "rgba(251, 191, 36, 0.1)",
                      padding: "2px 8px",
                      "border-radius": "var(--cortex-radius-sm)",
                    }}
                  >
                    {props.pattern}
                  </code>
                  <Text size="xs" style={{ color: "var(--jb-text-muted-color)" }}>
                    ({fileTypeDescription()})
                  </Text>
                </div>

                {/* Show if user-defined */}
                <Show when={hasUserAssociation()}>
                  <div
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "6px",
                      "margin-top": "8px",
                      "margin-left": "22px",
                    }}
                  >
                    <Badge size="sm" variant="accent">
                      Custom
                    </Badge>
                    <Text
                      size="xs"
                      style={{ color: "var(--jb-text-muted-color)" }}
                    >
                      You have a custom association for this pattern
                    </Text>
                  </div>
                </Show>
              </div>

              {/* Editor selection */}
              <div style={{ "margin-bottom": "8px" }}>
                <Text
                  size="sm"
                  weight="medium"
                  style={{ "margin-bottom": "12px", display: "block" }}
                >
                  Select Default Editor
                </Text>

                <div
                  style={{
                    display: "flex",
                    "flex-direction": "column",
                    gap: "4px",
                  }}
                >
                  <For each={props.availableEditors}>
                    {(editor) => {
                      const iconName = getEditorIconName(editor.id);
                      const isSelected = () => selectedEditor() === editor.id;
                      const isCurrentDefault = () =>
                        props.currentEditor === editor.id;

                      return (
                        <button
                          type="button"
                          onClick={() => setSelectedEditor(editor.id)}
                          style={{
                            display: "flex",
                            "align-items": "center",
                            gap: "12px",
                            padding: "10px 12px",
                            background: isSelected()
                              ? "rgba(53, 116, 240, 0.15)"
                              : "transparent",
                            border: isSelected()
                              ? "1px solid var(--jb-border-focus)"
                              : "1px solid transparent",
                            "border-radius": "var(--jb-radius-md)",
                            cursor: "pointer",
                            transition: "all var(--cortex-transition-fast)",
                            "text-align": "left",
                            width: "100%",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected()) {
                              e.currentTarget.style.background =
                                "var(--jb-surface-hover)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected()) {
                              e.currentTarget.style.background = "transparent";
                            }
                          }}
                        >
                          {/* Radio indicator */}
                          <div
                            style={{
                              width: "18px",
                              height: "18px",
                              "border-radius": "var(--cortex-radius-full)",
                              border: isSelected()
                                ? "none"
                                : "2px solid var(--jb-border-default)",
                              background: isSelected()
                                ? "var(--jb-btn-primary-bg)"
                                : "transparent",
                              display: "flex",
                              "align-items": "center",
                              "justify-content": "center",
                              "flex-shrink": "0",
                              transition: "all var(--cortex-transition-fast)",
                            }}
                          >
                            <Show when={isSelected()}>
                              <div
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  "border-radius": "var(--cortex-radius-full)",
                                  background: "var(--cortex-bg-primary)",
                                }}
                              />
                            </Show>
                          </div>

                          {/* Editor icon */}
                          <div
                            style={{
                              width: "28px",
                              height: "28px",
                              "border-radius": "var(--cortex-radius-md)",
                              background: "var(--jb-surface-bg)",
                              display: "flex",
                              "align-items": "center",
                              "justify-content": "center",
                              "flex-shrink": "0",
                            }}
                          >
                            <Icon
                              name={iconName}
                              size={16}
                              style={{
                                color: isSelected()
                                  ? "var(--jb-border-focus)"
                                  : "var(--jb-text-muted-color)",
                              }}
                            />
                          </div>

                          {/* Editor info */}
                          <div style={{ flex: "1", "min-width": "0" }}>
                            <div
                              style={{
                                display: "flex",
                                "align-items": "center",
                                gap: "8px",
                              }}
                            >
                              <Text
                                size="sm"
                                weight={isSelected() ? "medium" : "regular"}
                                style={{
                                  color: isSelected()
                                    ? "var(--jb-text-body-color)"
                                    : "var(--jb-text-body-color)",
                                }}
                              >
                                {editor.label}
                              </Text>
                              <Show when={isCurrentDefault()}>
                                <Badge size="sm" variant="success">
                                  Current
                                </Badge>
                              </Show>
                              <Show when={editor.isExtension}>
                                <Badge size="sm" variant="default">
                                  Extension
                                </Badge>
                              </Show>
                            </div>
                            <Show when={editor.extensionId}>
                              <Text
                                size="xs"
                                style={{
                                  color: "var(--jb-text-muted-color)",
                                  "margin-top": "2px",
                                }}
                              >
                                from {editor.extensionId}
                              </Text>
                            </Show>
                          </div>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </div>

              {/* No editors warning */}
              <Show when={props.availableEditors.length === 0}>
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    padding: "12px",
                    background: "rgba(239, 68, 68, 0.1)",
                    "border-radius": "var(--jb-radius-md)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                  }}
                >
                  <Icon
                    name="circle-exclamation"
                    size={16}
                    style={{ color: "var(--cortex-error)" }}
                  />
                  <Text size="sm" style={{ color: "var(--cortex-error)" }}>
                    No editors available for this file type
                  </Text>
                </div>
              </Show>
            </div>

            {/* Footer */}
            <div style={footerStyle}>
              {/* Left side - Reset button */}
              <div>
                <Show when={hasUserAssociation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    icon={<Icon name="rotate-left" size={14} />}
                  >
                    Reset to Default
                  </Button>
                </Show>
              </div>

              {/* Right side - Cancel/Save */}
              <div style={{ display: "flex", gap: "8px" }}>
                <Button variant="secondary" onClick={props.onCancel}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={
                    props.availableEditors.length === 0 ||
                    selectedEditor() === props.currentEditor
                  }
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

// ============================================================================
// Hook for managing dialog state
// ============================================================================

interface ConfigureEditorDialogState {
  isOpen: boolean;
  pattern: string;
  filePath?: string;
}

export function useConfigureDefaultEditorDialog() {
  const editorAssociations = useEditorAssociations();
  const [state, setState] = createSignal<ConfigureEditorDialogState>({
    isOpen: false,
    pattern: "",
    filePath: undefined,
  });

  const openDialog = (pattern: string, filePath?: string) => {
    setState({
      isOpen: true,
      pattern,
      filePath,
    });
  };

  const closeDialog = () => {
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleSave = (editorId: string) => {
    const { pattern } = state();
    editorAssociations.setAssociation(pattern, editorId);
    closeDialog();

    // Dispatch event for components that need to update
    window.dispatchEvent(
      new CustomEvent("editor:default-changed", {
        detail: { pattern, editorId },
      })
    );
  };

  // Computed values for the dialog
  const currentEditor = createMemo(() => {
    const { pattern, filePath } = state();
    if (!pattern) return "default";
    // Use filePath if available for better detection
    const testPath = filePath || pattern.replace("*", "file");
    return editorAssociations.getEditorForFile(testPath);
  });

  const availableEditors = createMemo(() => {
    const { pattern, filePath } = state();
    if (!pattern) return [];
    const testPath = filePath || pattern.replace("*", "file");
    return editorAssociations.getAvailableEditorsForFile(testPath);
  });

  return {
    state,
    openDialog,
    closeDialog,
    handleSave,
    currentEditor,
    availableEditors,
  };
}

// ============================================================================
// Standalone dialog with integrated state management
// ============================================================================

export interface ConfigureDefaultEditorDialogContainerProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** File pattern being configured */
  pattern: string;
  /** Optional file path for context */
  filePath?: string;
  /** Callback when dialog is closed */
  onClose: () => void;
}

export function ConfigureDefaultEditorDialogContainer(
  props: ConfigureDefaultEditorDialogContainerProps
) {
  const editorAssociations = useEditorAssociations();

  const currentEditor = createMemo(() => {
    if (!props.pattern) return "default";
    const testPath = props.filePath || props.pattern.replace("*", "file");
    return editorAssociations.getEditorForFile(testPath);
  });

  const availableEditors = createMemo(() => {
    if (!props.pattern) return [];
    const testPath = props.filePath || props.pattern.replace("*", "file");
    return editorAssociations.getAvailableEditorsForFile(testPath);
  });

  const handleSave = (editorId: string) => {
    editorAssociations.setAssociation(props.pattern, editorId);
    props.onClose();

    window.dispatchEvent(
      new CustomEvent("editor:default-changed", {
        detail: { pattern: props.pattern, editorId },
      })
    );
  };

  return (
    <ConfigureDefaultEditorDialog
      isOpen={props.isOpen}
      pattern={props.pattern}
      currentEditor={currentEditor()}
      availableEditors={availableEditors()}
      onSave={handleSave}
      onCancel={props.onClose}
      filePath={props.filePath}
    />
  );
}

