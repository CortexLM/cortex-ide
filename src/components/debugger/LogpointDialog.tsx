import { createSignal, createEffect, Show } from "solid-js";
import { Modal, Button, Textarea, Text } from "@/components/ui";

export interface LogpointDialogProps {
  open: boolean;
  filePath: string;
  line: number;
  column?: number;
  existingMessage?: string;
  onSave: (message: string) => void;
  onCancel: () => void;
}

/**
 * LogpointDialog - Simplified VS Code-style dialog for creating/editing logpoints
 * 
 * Logpoints are breakpoints that log a message to the debug console without
 * stopping execution. Messages can include expressions in {curly braces}.
 */
export function LogpointDialog(props: LogpointDialogProps) {
  const [message, setMessage] = createSignal(props.existingMessage || "");

  // Reset message when dialog opens
  createEffect(() => {
    if (props.open) {
      setMessage(props.existingMessage || "");
    }
  });

  const handleSave = () => {
    const msg = message().trim();
    if (msg) {
      props.onSave(msg);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      props.onCancel();
    }
  };

  const getFileName = (path: string): string => {
    return path.split(/[/\\]/).pop() || path;
  };

  // Preview the message with placeholders
  const previewMessage = () => {
    return message().replace(/\{([^}]+)\}/g, (_, expr) => `<${expr}>`);
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      title={`Add Logpoint - ${getFileName(props.filePath)}:${props.line}${props.column !== undefined ? `:${props.column}` : ""}`}
      size="md"
      footer={
        <div style={{ display: "flex", gap: "8px", "justify-content": "flex-end" }}>
          <Button variant="ghost" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSave}
            disabled={!message().trim()}
          >
            Add Logpoint
          </Button>
        </div>
      }
    >
      <div onKeyDown={handleKeyDown} style={{ padding: "8px 0" }}>
        {/* Description */}
        <Text variant="muted" size="sm" as="div" style={{ "margin-bottom": "12px" }}>
          Log a message to the debug console without breaking execution.
        </Text>

        {/* Message Input */}
        <div style={{ "margin-bottom": "12px" }}>
          <Text variant="muted" size="xs" as="label" style={{ display: "block", "margin-bottom": "4px" }}>
            Message
          </Text>
          <Textarea
            value={message()}
            onInput={(e) => setMessage(e.currentTarget.value)}
            placeholder='e.g., User clicked: {user.name}, count={count}'
            style={{ 
              width: "100%", 
              "min-height": "80px", 
              "font-family": "monospace",
              "font-size": "13px",
            }}
            autofocus
          />
        </div>

        {/* Variable Interpolation Help */}
        <div style={{ 
          padding: "10px 12px", 
          background: "var(--surface-sunken)", 
          "border-radius": "var(--cortex-radius-sm)",
          "border-left": "3px solid var(--cortex-info)",
          "margin-bottom": "12px",
        }}>
          <Text variant="muted" size="xs" as="div" style={{ "margin-bottom": "6px", "font-weight": "500" }}>
            Variable Interpolation
          </Text>
          <Text variant="muted" size="xs" as="div">
            Use <code style={{ background: "var(--surface-base)", padding: "1px 4px", "border-radius": "var(--cortex-radius-sm)" }}>{"{expression}"}</code> to 
            evaluate and insert values:
          </Text>
          <ul style={{ margin: "6px 0 0 16px", "font-size": "11px", color: "var(--text-muted)" }}>
            <li><code>{"{x}"}</code> - Variable value</li>
            <li><code>{"{user.name}"}</code> - Property access</li>
            <li><code>{"{items.length}"}</code> - Array length</li>
            <li><code>{"{JSON.stringify(obj)}"}</code> - Object as JSON</li>
          </ul>
        </div>

        {/* Preview */}
        <Show when={message().trim()}>
          <div style={{ 
            padding: "10px 12px", 
            background: "var(--surface-sunken)", 
            "border-radius": "var(--cortex-radius-sm)",
          }}>
            <Text variant="muted" size="xs" as="div" style={{ "margin-bottom": "4px" }}>
              Preview (expressions shown as placeholders):
            </Text>
            <div style={{ 
              "font-family": "monospace", 
              "font-size": "12px",
              color: "var(--text-base)",
              "white-space": "pre-wrap",
              "word-break": "break-word"
            }}>
              {previewMessage()}
            </div>
          </div>
        </Show>

        {/* Logpoint indicator info */}
        <div style={{ 
          "margin-top": "12px",
          display: "flex",
          "align-items": "center",
          gap: "8px",
        }}>
          <div style={{
            width: "12px",
            height: "12px",
            "border-radius": "var(--cortex-radius-full)",
            background: "var(--cortex-warning)",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
          }}>
            <div style={{
              width: "4px",
              height: "4px",
              "border-radius": "var(--cortex-radius-full)",
              background: "var(--cortex-bg-primary)",
            }} />
          </div>
          <Text variant="muted" size="xs">
            Logpoints appear as orange diamonds in the gutter
          </Text>
        </div>
      </div>
    </Modal>
  );
}

