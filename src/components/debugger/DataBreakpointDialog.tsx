import { createSignal, createEffect, For } from "solid-js";
import { Modal, Button, Input, Text } from "@/components/ui";
import type { DataBreakpointAccessType } from "@/context/DebugContext";

export interface DataBreakpointDialogProps {
  open: boolean;
  existingVariableName?: string;
  existingAccessType?: DataBreakpointAccessType;
  existingCondition?: string;
  onSave: (variableName: string, accessType: DataBreakpointAccessType, condition?: string) => void;
  onCancel: () => void;
}

/**
 * DataBreakpointDialog - VS Code-style dialog for creating/editing data breakpoints (watchpoints)
 * 
 * Data breakpoints break execution when a variable's value is read or written.
 * They are supported by some debug adapters (C/C++, Rust, etc.) but not all.
 */
export function DataBreakpointDialog(props: DataBreakpointDialogProps) {
  const [variableName, setVariableName] = createSignal(props.existingVariableName || "");
  const [accessType, setAccessType] = createSignal<DataBreakpointAccessType>(props.existingAccessType || "write");
  const [condition, setCondition] = createSignal(props.existingCondition || "");

  // Reset values when dialog opens
  createEffect(() => {
    if (props.open) {
      setVariableName(props.existingVariableName || "");
      setAccessType(props.existingAccessType || "write");
      setCondition(props.existingCondition || "");
    }
  });

  const handleSave = () => {
    const name = variableName().trim();
    if (name) {
      const cond = condition().trim() || undefined;
      props.onSave(name, accessType(), cond);
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

  const accessTypeOptions: Array<{ value: DataBreakpointAccessType; label: string; description: string }> = [
    { value: "write", label: "Write", description: "Break when value is modified" },
    { value: "read", label: "Read", description: "Break when value is read" },
    { value: "readWrite", label: "Read/Write", description: "Break on any access" },
  ];

  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      title={props.existingVariableName ? "Edit Data Breakpoint" : "Add Data Breakpoint"}
      size="md"
      footer={
        <div style={{ display: "flex", gap: "8px", "justify-content": "flex-end" }}>
          <Button variant="ghost" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSave}
            disabled={!variableName().trim()}
          >
            {props.existingVariableName ? "Save" : "Add"}
          </Button>
        </div>
      }
    >
      <div onKeyDown={handleKeyDown} style={{ padding: "8px 0" }}>
        {/* Description */}
        <Text variant="muted" size="sm" as="div" style={{ "margin-bottom": "16px" }}>
          Break execution when a variable or memory location is accessed.
        </Text>

        {/* Variable Expression */}
        <div style={{ "margin-bottom": "16px" }}>
          <Text variant="muted" size="xs" as="label" style={{ display: "block", "margin-bottom": "4px" }}>
            Variable or Expression
          </Text>
          <Input
            type="text"
            value={variableName()}
            onInput={(e) => setVariableName(e.currentTarget.value)}
            placeholder="e.g., myVariable, obj.property, *ptr"
            style={{ width: "100%" }}
            autofocus
          />
          <Text variant="muted" size="xs" as="div" style={{ "margin-top": "4px", opacity: 0.7 }}>
            Enter a variable name, property path, or memory address expression
          </Text>
        </div>

        {/* Access Type */}
        <div style={{ "margin-bottom": "16px" }}>
          <Text variant="muted" size="xs" as="label" style={{ display: "block", "margin-bottom": "8px" }}>
            Access Type
          </Text>
          <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
            <For each={accessTypeOptions}>
              {(option) => (
                <label
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    padding: "8px 12px",
                    background: accessType() === option.value ? "var(--surface-hover)" : "var(--surface-sunken)",
                    "border-radius": "var(--cortex-radius-sm)",
                    cursor: "pointer",
                    border: accessType() === option.value ? "1px solid var(--border-focus)" : "1px solid transparent",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="radio"
                    name="accessType"
                    value={option.value}
                    checked={accessType() === option.value}
                    onChange={() => setAccessType(option.value)}
                    style={{ 
                      width: "14px", 
                      height: "14px",
                      "accent-color": "var(--accent)",
                    }}
                  />
                  <div>
                    <Text size="sm" style={{ "font-weight": "500" }}>{option.label}</Text>
                    <Text variant="muted" size="xs" as="div">{option.description}</Text>
                  </div>
                </label>
              )}
            </For>
          </div>
        </div>

        {/* Condition (Optional) */}
        <div style={{ "margin-bottom": "16px" }}>
          <Text variant="muted" size="xs" as="label" style={{ display: "block", "margin-bottom": "4px" }}>
            Condition (optional)
          </Text>
          <Input
            type="text"
            value={condition()}
            onInput={(e) => setCondition(e.currentTarget.value)}
            placeholder="e.g., newValue > 100"
            style={{ width: "100%" }}
          />
          <Text variant="muted" size="xs" as="div" style={{ "margin-top": "4px", opacity: 0.7 }}>
            Only break when this expression evaluates to true
          </Text>
        </div>

        {/* Info box */}
        <div style={{ 
          padding: "10px 12px", 
          background: "var(--surface-sunken)", 
          "border-radius": "var(--cortex-radius-sm)",
          "border-left": "3px solid var(--cortex-warning)",
        }}>
          <Text variant="muted" size="xs" as="div" style={{ "margin-bottom": "4px", "font-weight": "500" }}>
            Note
          </Text>
          <Text variant="muted" size="xs" as="div">
            Data breakpoints require hardware support and are only available for some debug adapters 
            (C/C++, Rust, etc.). The debugger will report if data breakpoints are not supported.
          </Text>
        </div>

        {/* Visual indicator */}
        <div style={{ 
          "margin-top": "12px",
          display: "flex",
          "align-items": "center",
          gap: "8px",
        }}>
          <div style={{
            width: "12px",
            height: "12px",
            background: "var(--cortex-error)",
            transform: "rotate(45deg)",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
          }}>
            <div style={{
              width: "4px",
              height: "4px",
              background: "var(--cortex-bg-primary)",
              "border-radius": "var(--cortex-radius-full)",
            }} />
          </div>
          <Text variant="muted" size="xs">
            Data breakpoints appear as red diamonds in the Breakpoints panel
          </Text>
        </div>
      </div>
    </Modal>
  );
}

