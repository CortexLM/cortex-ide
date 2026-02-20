/**
 * =============================================================================
 * TERMINAL RENAME DIALOG
 * =============================================================================
 *
 * Dialog for renaming terminal tabs. Matches VS Code's terminal rename UX.
 *
 * Features:
 * - Inline text input for new name
 * - Auto-select existing name on open
 * - Enter to confirm, Escape to cancel
 * - Validates non-empty name
 *
 * Usage:
 *   <TerminalRenameDialog
 *     open={showRename()}
 *     currentName="bash"
 *     onRename={(name) => handleRename(name)}
 *     onCancel={() => setShowRename(false)}
 *   />
 * =============================================================================
 */

import { createSignal, createEffect } from "solid-js";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

// =============================================================================
// TYPES
// =============================================================================

export interface TerminalRenameDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Current terminal name */
  currentName: string;
  /** Callback when rename is confirmed */
  onRename: (newName: string) => void;
  /** Callback when dialog is cancelled */
  onCancel: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TerminalRenameDialog(props: TerminalRenameDialogProps) {
  const [name, setName] = createSignal(props.currentName);
  const [error, setError] = createSignal<string | undefined>(undefined);
  let inputRef: HTMLInputElement | undefined;

  // Reset name when dialog opens
  createEffect(() => {
    if (props.open) {
      setName(props.currentName);
      setError(undefined);
      // Focus and select input on next tick
      requestAnimationFrame(() => {
        inputRef?.focus();
        inputRef?.select();
      });
    }
  });

  const validate = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Name cannot be empty");
      return false;
    }
    if (trimmed.length > 50) {
      setError("Name must be 50 characters or less");
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleSubmit = () => {
    const trimmedName = name().trim();
    if (validate(trimmedName)) {
      props.onRename(trimmedName);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onCancel();
    }
  };

  const handleInput = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setName(value);
    // Clear error on input
    if (error()) {
      validate(value);
    }
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      title="Rename Terminal"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!name().trim()}>
            Rename
          </Button>
        </>
      }
    >
      <Input
        ref={inputRef}
        value={name()}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Terminal name"
        error={error()}
        autofocus
        style={{ width: "100%" }}
      />
    </Modal>
  );
}

export default TerminalRenameDialog;
