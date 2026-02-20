import { createSignal, createEffect, Show, For } from "solid-js";
import { Modal, Button, Input, Textarea, Text } from "@/components/ui";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui";
import type { DataBreakpointAccessType } from "@/context/DebugContext";

export type BreakpointType = "condition" | "hitCount" | "logMessage" | "data";

export interface ConditionalBreakpointDialogProps {
  open: boolean;
  filePath: string;
  line: number;
  column?: number;
  existingCondition?: string;
  existingHitCount?: string;
  existingLogMessage?: string;
  existingDataVariable?: string;
  existingDataAccessType?: DataBreakpointAccessType;
  onSave: (type: BreakpointType, value: string) => void;
  onCancel: () => void;
}

/**
 * ConditionalBreakpointDialog - VS Code-style dialog for editing breakpoint conditions
 * 
 * Supports three types of breakpoint conditions:
 * 1. Expression - Break when expression evaluates to true
 * 2. Hit Count - Break when hit count meets condition (=N, >N, >=N, %N)
 * 3. Log Message - Output message to console (logpoint) with {var} interpolation
 */
export function ConditionalBreakpointDialog(props: ConditionalBreakpointDialogProps) {
  // Determine initial tab based on existing values
  const getInitialType = (): BreakpointType => {
    if (props.existingLogMessage) return "logMessage";
    if (props.existingHitCount) return "hitCount";
    return "condition";
  };

  const [type, setType] = createSignal<BreakpointType>(getInitialType());
  const [condition, setCondition] = createSignal(props.existingCondition || "");
  const [hitCount, setHitCount] = createSignal(props.existingHitCount || "");
  const [logMessage, setLogMessage] = createSignal(props.existingLogMessage || "");
  const [hitCountOperator, setHitCountOperator] = createSignal<"=" | ">=" | ">" | "%">(">=");
  const [dataVariable, setDataVariable] = createSignal(props.existingDataVariable || "");
  const [dataAccessType, setDataAccessType] = createSignal<DataBreakpointAccessType>(props.existingDataAccessType || "write");

  // Parse existing hit count condition
  createEffect(() => {
    if (props.open) {
      const existing = props.existingHitCount || "";
      if (existing.startsWith("% ")) {
        setHitCountOperator("%");
        setHitCount(existing.replace(/^% (\d+).*/, "$1"));
      } else if (existing.startsWith(">= ")) {
        setHitCountOperator(">=");
        setHitCount(existing.replace(">= ", ""));
      } else if (existing.startsWith("> ")) {
        setHitCountOperator(">");
        setHitCount(existing.replace("> ", ""));
      } else if (existing.startsWith("= ")) {
        setHitCountOperator("=");
        setHitCount(existing.replace("= ", ""));
      } else {
        setHitCountOperator(">=");
        setHitCount(existing);
      }
      
      setCondition(props.existingCondition || "");
      setLogMessage(props.existingLogMessage || "");
      setDataVariable(props.existingDataVariable || "");
      setDataAccessType(props.existingDataAccessType || "write");
      setType(getInitialType());
    }
  });

  const handleSave = () => {
    const currentType = type();
    let value = "";

    switch (currentType) {
      case "condition":
        value = condition().trim();
        break;
      case "hitCount": {
        const count = hitCount().trim();
        if (count) {
          const op = hitCountOperator();
          if (op === "%") {
            value = `% ${count} == 0`;
          } else {
            value = `${op} ${count}`;
          }
        }
        break;
      }
      case "logMessage":
        value = logMessage().trim();
        break;
      case "data": {
        const varName = dataVariable().trim();
        if (varName) {
          value = JSON.stringify({ variable: varName, accessType: dataAccessType() });
        }
        break;
      }
    }

    props.onSave(currentType, value);
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

  // Hit count operator options with descriptions
  const hitCountOperators: Array<{ value: "=" | ">=" | ">" | "%"; label: string; description: string }> = [
    { value: "=", label: "=", description: "Break when hit count equals N" },
    { value: ">=", label: ">=", description: "Break when hit count is at least N" },
    { value: ">", label: ">", description: "Break when hit count is greater than N" },
    { value: "%", label: "%", description: "Break every Nth hit (modulo)" },
  ];

  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      title={`Edit Breakpoint - ${getFileName(props.filePath)}:${props.line}${props.column !== undefined ? `:${props.column}` : ""}`}
      size="md"
      footer={
        <div style={{ display: "flex", gap: "8px", "justify-content": "flex-end" }}>
          <Button variant="ghost" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </div>
      }
    >
      <div onKeyDown={handleKeyDown}>
        <Tabs defaultTab={type()} onChange={(id) => setType(id as BreakpointType)}>
          <TabList>
            <Tab id="condition">Expression</Tab>
            <Tab id="hitCount">Hit Count</Tab>
            <Tab id="logMessage">Log Message</Tab>
            <Tab id="data">Data</Tab>
          </TabList>

          {/* Expression Tab */}
          <TabPanel id="condition">
            <div style={{ padding: "16px 0" }}>
              <Text variant="muted" size="sm" as="div" style={{ "margin-bottom": "8px" }}>
                Break when expression evaluates to true
              </Text>
              <Input
                type="text"
                value={condition()}
                onInput={(e) => setCondition(e.currentTarget.value)}
                placeholder="e.g., x > 5 && y !== null"
                style={{ width: "100%" }}
                autofocus
              />
              <Text variant="muted" size="xs" as="div" style={{ "margin-top": "8px", opacity: 0.7 }}>
                Examples: <code style={{ background: "var(--surface-sunken)", padding: "2px 4px", "border-radius": "var(--cortex-radius-sm)" }}>count === 10</code>,{" "}
                <code style={{ background: "var(--surface-sunken)", padding: "2px 4px", "border-radius": "var(--cortex-radius-sm)" }}>user.name === "test"</code>,{" "}
                <code style={{ background: "var(--surface-sunken)", padding: "2px 4px", "border-radius": "var(--cortex-radius-sm)" }}>array.length {">"} 0</code>
              </Text>
            </div>
          </TabPanel>

          {/* Hit Count Tab */}
          <TabPanel id="hitCount">
            <div style={{ padding: "16px 0" }}>
              <Text variant="muted" size="sm" as="div" style={{ "margin-bottom": "8px" }}>
                Break when hit count meets condition
              </Text>
              <div style={{ display: "flex", gap: "8px", "align-items": "flex-end" }}>
                <div style={{ width: "120px" }}>
                  <Text variant="muted" size="xs" as="label" style={{ display: "block", "margin-bottom": "4px" }}>
                    Operator
                  </Text>
                  <select
                    value={hitCountOperator()}
                    onChange={(e) => setHitCountOperator(e.currentTarget.value as typeof hitCountOperator extends () => infer T ? T : never)}
                    style={{
                      width: "100%",
                      height: "var(--jb-input-height)",
                      padding: "0 8px",
                      background: "var(--jb-input-bg)",
                      border: "var(--jb-input-border)",
                      "border-radius": "var(--jb-input-radius)",
                      color: "var(--jb-input-color)",
                      "font-family": "var(--jb-font-ui)",
                      "font-size": "var(--jb-text-body-size)",
                      outline: "none",
                    }}
                  >
                    <For each={hitCountOperators}>
                      {(op) => (
                        <option value={op.value}>{op.label} - {op.description.split(" ").slice(1, 4).join(" ")}</option>
                      )}
                    </For>
                  </select>
                </div>
                <div style={{ flex: "1" }}>
                  <Text variant="muted" size="xs" as="label" style={{ display: "block", "margin-bottom": "4px" }}>
                    Count
                  </Text>
                  <Input
                    type="number"
                    min="1"
                    value={hitCount()}
                    onInput={(e) => setHitCount(e.currentTarget.value)}
                    placeholder="e.g., 5"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
              <Text variant="muted" size="xs" as="div" style={{ "margin-top": "8px", opacity: 0.7 }}>
                {hitCountOperator() === "%" 
                  ? `Break every ${hitCount() || "N"} hits (on hit 0, ${hitCount() || "N"}, ${parseInt(hitCount() || "0") * 2 || "2N"}, ...)`
                  : `Break when hit count ${hitCountOperators.find(o => o.value === hitCountOperator())?.description.split(" when ")[1] || ""}`
                }
              </Text>
            </div>
          </TabPanel>

          {/* Log Message Tab */}
          <TabPanel id="logMessage">
            <div style={{ padding: "16px 0" }}>
              <Text variant="muted" size="sm" as="div" style={{ "margin-bottom": "8px" }}>
                Log a message to the debug console (does not break execution)
              </Text>
              <Textarea
                value={logMessage()}
                onInput={(e) => setLogMessage(e.currentTarget.value)}
                placeholder='e.g., User clicked: {user.name}, count={count}'
                style={{ width: "100%", "min-height": "80px", "font-family": "monospace" }}
              />
              <div style={{ 
                "margin-top": "12px", 
                padding: "8px 12px", 
                background: "var(--surface-sunken)", 
                "border-radius": "var(--cortex-radius-sm)",
                "border-left": "3px solid var(--cortex-info)"
              }}>
                <Text variant="muted" size="xs" as="div" style={{ "margin-bottom": "6px", "font-weight": "500" }}>
                  Variable Interpolation Syntax
                </Text>
                <Text variant="muted" size="xs" as="div">
                  Use <code style={{ background: "var(--surface-base)", padding: "1px 4px", "border-radius": "var(--cortex-radius-sm)" }}>{"{expression}"}</code> to 
                  evaluate and insert values:
                </Text>
                <ul style={{ margin: "6px 0 0 16px", "font-size": "11px", color: "var(--text-muted)" }}>
                  <li><code>{"{x}"}</code> - Variable value</li>
                  <li><code>{"{user.name}"}</code> - Property access</li>
                  <li><code>{"{array.length}"}</code> - Array length</li>
                  <li><code>{"{JSON.stringify(obj)}"}</code> - Object as JSON</li>
                </ul>
              </div>
              
              {/* Preview */}
              <Show when={logMessage().trim()}>
                <div style={{ 
                  "margin-top": "12px", 
                  padding: "8px 12px", 
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
                    {logMessage().replace(/\{([^}]+)\}/g, (_, expr) => `<${expr}>`)}
                  </div>
                </div>
              </Show>
            </div>
          </TabPanel>

          {/* Data Breakpoint Tab */}
          <TabPanel id="data">
            <div style={{ padding: "16px 0" }}>
              <Text variant="muted" size="sm" as="div" style={{ "margin-bottom": "8px" }}>
                Break when a variable or memory location is accessed
              </Text>
              <div style={{ "margin-bottom": "12px" }}>
                <Text variant="muted" size="xs" as="label" style={{ display: "block", "margin-bottom": "4px" }}>
                  Variable or Expression
                </Text>
                <Input
                  type="text"
                  value={dataVariable()}
                  onInput={(e) => setDataVariable(e.currentTarget.value)}
                  placeholder="e.g., myVariable, obj.property, *ptr"
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ "margin-bottom": "12px" }}>
                <Text variant="muted" size="xs" as="label" style={{ display: "block", "margin-bottom": "4px" }}>
                  Access Type
                </Text>
                <select
                  value={dataAccessType()}
                  onChange={(e) => setDataAccessType(e.currentTarget.value as DataBreakpointAccessType)}
                  style={{
                    width: "100%",
                    height: "var(--jb-input-height)",
                    padding: "0 8px",
                    background: "var(--jb-input-bg)",
                    border: "var(--jb-input-border)",
                    "border-radius": "var(--jb-input-radius)",
                    color: "var(--jb-input-color)",
                    "font-family": "var(--jb-font-ui)",
                    "font-size": "var(--jb-text-body-size)",
                    outline: "none",
                  }}
                >
                  <option value="write">Write - Break when value is modified</option>
                  <option value="read">Read - Break when value is read</option>
                  <option value="readWrite">Read/Write - Break on any access</option>
                </select>
              </div>
              <div style={{ 
                padding: "8px 12px", 
                background: "var(--surface-sunken)", 
                "border-radius": "var(--cortex-radius-sm)",
                "border-left": "3px solid var(--cortex-warning)",
              }}>
                <Text variant="muted" size="xs" as="div">
                  Data breakpoints require hardware support and are only available for some debug adapters
                  (C/C++, Rust, etc.).
                </Text>
              </div>
            </div>
          </TabPanel>
        </Tabs>
      </div>
    </Modal>
  );
}

