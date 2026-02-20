/**
 * =============================================================================
 * RULES EDITOR - Interception Rules Management
 * =============================================================================
 * 
 * A comprehensive panel/dialog for editing interception rules in the Agent
 * Factory. Supports creating, editing, reordering, and testing rules that
 * determine how agent actions are intercepted.
 * 
 * Features:
 * - List of rules with enable/disable toggle
 * - Add/edit/delete rules
 * - Rule ordering via drag-and-drop
 * - Pattern matching (regex)
 * - Actions: deny, allow, pause, modify
 * - Risk level assignment
 * - Test rules against sample input
 * - Import/Export rules
 * - Preset rules library
 * 
 * =============================================================================
 */

import {
  createSignal,
  createEffect,
  createMemo,
  For,
  Show,
  JSX,
} from "solid-js";
import { Modal } from "../../ui/Modal";
import { Input, Textarea } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { Checkbox } from "../../ui/Checkbox";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import { Toggle } from "../../ui/Toggle";

// =============================================================================
// TYPES
// =============================================================================

export type RuleAction = "deny" | "allow" | "pause" | "modify";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface InterceptionRule {
  id: string;
  name: string;
  enabled: boolean;
  pattern: string;
  action: RuleAction;
  message?: string;
  riskLevel: RiskLevel;
  tags: string[];
  modifyScript?: string;
}

export interface RulesEditorProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Current rules */
  rules: InterceptionRule[];
  /** Callback when rules are saved */
  onSave?: (rules: InterceptionRule[]) => void;
  /** Loading state */
  loading?: boolean;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export interface TestResult {
  matched: boolean;
  rule?: InterceptionRule;
  action?: RuleAction;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RISK_LEVELS: { value: RiskLevel; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "var(--cortex-success)" },
  { value: "medium", label: "Medium", color: "var(--cortex-warning)" },
  { value: "high", label: "High", color: "var(--cortex-warning)" },
  { value: "critical", label: "Critical", color: "var(--cortex-error)" },
];

const RULE_ACTIONS: { value: RuleAction; label: string; description: string }[] = [
  { value: "allow", label: "Allow", description: "Allow the action to proceed" },
  { value: "deny", label: "Deny", description: "Block the action entirely" },
  { value: "pause", label: "Pause", description: "Pause for human review" },
  { value: "modify", label: "Modify", description: "Transform the action before proceeding" },
];

const PRESET_RULES: InterceptionRule[] = [
  {
    id: "preset_no_delete_system",
    name: "Protect System Files",
    enabled: true,
    pattern: "^(rm|del|remove).*(/etc|/usr|/bin|C:\\\\Windows)",
    action: "deny",
    message: "Deleting system files is not allowed",
    riskLevel: "critical",
    tags: ["security", "filesystem"],
  },
  {
    id: "preset_no_network_exfil",
    name: "Block Data Exfiltration",
    enabled: true,
    pattern: "(curl|wget|nc|netcat).*(-d|--data|<)",
    action: "pause",
    message: "Outbound data transfer requires approval",
    riskLevel: "high",
    tags: ["security", "network"],
  },
  {
    id: "preset_no_sudo",
    name: "Block Privilege Escalation",
    enabled: true,
    pattern: "^(sudo|su |doas|runas)",
    action: "deny",
    message: "Privilege escalation is not allowed",
    riskLevel: "critical",
    tags: ["security"],
  },
  {
    id: "preset_sensitive_env",
    name: "Protect Sensitive Environment",
    enabled: true,
    pattern: "(API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY)",
    action: "pause",
    message: "Accessing sensitive environment variables requires review",
    riskLevel: "high",
    tags: ["security", "secrets"],
  },
  {
    id: "preset_git_force_push",
    name: "Block Force Push",
    enabled: true,
    pattern: "git.*push.*(--force|-f)",
    action: "deny",
    message: "Force pushing is not allowed",
    riskLevel: "medium",
    tags: ["git", "safety"],
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const generateId = () => `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const testPattern = (pattern: string, input: string): boolean => {
  try {
    const regex = new RegExp(pattern, "i");
    return regex.test(input);
  } catch {
    return false;
  }
};

const isValidRegex = (pattern: string): boolean => {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

// =============================================================================
// RULE ITEM COMPONENT
// =============================================================================

interface RuleItemProps {
  rule: InterceptionRule;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function RuleItem(props: RuleItemProps) {
  const [hovered, setHovered] = createSignal(false);

  const getRiskColor = (level: RiskLevel) => {
    return RISK_LEVELS.find(r => r.value === level)?.color || "var(--jb-text-muted-color)";
  };

  const getActionBadgeVariant = (action: RuleAction): "default" | "accent" | "success" | "warning" | "error" => {
    switch (action) {
      case "allow": return "success";
      case "deny": return "error";
      case "pause": return "warning";
      case "modify": return "accent";
      default: return "default";
    }
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "12px",
    padding: "12px",
    background: hovered() ? "var(--jb-surface-hover)" : "var(--jb-surface-panel)",
    "border-radius": "var(--jb-radius-md)",
    border: "1px solid var(--jb-border-divider)",
    "margin-bottom": "8px",
    opacity: props.rule.enabled ? "1" : "0.6",
    transition: "background var(--cortex-transition-fast), opacity var(--cortex-transition-fast)",
  });

  const orderStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "2px",
  };

  const orderButtonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "20px",
    height: "16px",
    background: "transparent",
    border: "none",
    "border-radius": "var(--jb-radius-sm)",
    cursor: "pointer",
    color: "var(--jb-text-muted-color)",
    padding: "0",
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    "min-width": "0",
  };

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "margin-bottom": "4px",
  };

  const nameStyle: JSX.CSSProperties = {
    "font-size": "13px",
    "font-weight": "500",
    color: "var(--jb-text-body-color)",
  };

  const patternStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-mono)",
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "max-width": "300px",
  };

  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    gap: "4px",
  };

  const actionButtonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "28px",
    height: "28px",
    background: "transparent",
    border: "none",
    "border-radius": "var(--jb-radius-sm)",
    cursor: "pointer",
    color: "var(--jb-text-muted-color)",
    padding: "0",
  };

  return (
    <div
      style={containerStyle()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Reorder buttons */}
      <div style={orderStyle}>
        <button
          type="button"
          style={{ ...orderButtonStyle, opacity: props.isFirst ? "0.3" : "1" }}
          onClick={props.onMoveUp}
          disabled={props.isFirst}
          title="Move up"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M5 2L1 6h8L5 2z"/>
          </svg>
        </button>
        <button
          type="button"
          style={{ ...orderButtonStyle, opacity: props.isLast ? "0.3" : "1" }}
          onClick={props.onMoveDown}
          disabled={props.isLast}
          title="Move down"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M5 8L1 4h8L5 8z"/>
          </svg>
        </button>
      </div>

      {/* Toggle */}
      <Toggle
        checked={props.rule.enabled}
        onChange={props.onToggle}
        size="sm"
        aria-label={`Enable rule ${props.rule.name}`}
      />

      {/* Content */}
      <div style={contentStyle}>
        <div style={headerStyle}>
          <span style={nameStyle}>{props.rule.name}</span>
          <Badge variant={getActionBadgeVariant(props.rule.action)} size="sm">
            {props.rule.action}
          </Badge>
          <span style={{ 
            width: "8px", 
            height: "8px", 
            "border-radius": "var(--cortex-radius-full)", 
            background: getRiskColor(props.rule.riskLevel),
          }} title={`Risk: ${props.rule.riskLevel}`} />
        </div>
        <div style={patternStyle} title={props.rule.pattern}>
          {props.rule.pattern}
        </div>
      </div>

      {/* Tags */}
      <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap", "max-width": "150px" }}>
        <For each={props.rule.tags.slice(0, 2)}>
          {(tag) => (
            <Badge variant="default" size="sm">{tag}</Badge>
          )}
        </For>
        <Show when={props.rule.tags.length > 2}>
          <Badge variant="default" size="sm">+{props.rule.tags.length - 2}</Badge>
        </Show>
      </div>

      {/* Actions */}
      <div style={actionsStyle}>
        <button
          type="button"
          style={actionButtonStyle}
          onClick={props.onEdit}
          title="Edit rule"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M10.586 0.586a2 2 0 0 1 2.828 2.828L4.5 12.328l-4 1 1-4L10.586 0.586z"/>
          </svg>
        </button>
        <button
          type="button"
          style={{ ...actionButtonStyle, color: "var(--cortex-error)" }}
          onClick={props.onDelete}
          title="Delete rule"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M5 0v1H1v2h12V1H9V0H5zM2 4v9h10V4H2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// RULE EDITOR DIALOG
// =============================================================================

interface RuleEditorDialogProps {
  open: boolean;
  rule: InterceptionRule | null;
  onClose: () => void;
  onSave: (rule: InterceptionRule) => void;
}

function RuleEditorDialog(props: RuleEditorDialogProps) {
  const [editedRule, setEditedRule] = createSignal<InterceptionRule | null>(null);
  const [patternError, setPatternError] = createSignal<string | null>(null);
  const [tagsInput, setTagsInput] = createSignal("");

  createEffect(() => {
    if (props.open && props.rule) {
      setEditedRule({ ...props.rule });
      setPatternError(null);
      setTagsInput("");
    } else if (props.open) {
      // New rule
      setEditedRule({
        id: generateId(),
        name: "",
        enabled: true,
        pattern: "",
        action: "pause",
        message: "",
        riskLevel: "medium",
        tags: [],
      });
      setPatternError(null);
      setTagsInput("");
    }
  });

  const updateRule = <K extends keyof InterceptionRule>(field: K, value: InterceptionRule[K]) => {
    setEditedRule(prev => prev ? { ...prev, [field]: value } : null);
    if (field === "pattern") {
      const pattern = value as string;
      if (pattern && !isValidRegex(pattern)) {
        setPatternError("Invalid regular expression");
      } else {
        setPatternError(null);
      }
    }
  };

  const addTag = () => {
    const tag = tagsInput().trim();
    if (tag && editedRule() && !editedRule()!.tags.includes(tag)) {
      updateRule("tags", [...editedRule()!.tags, tag]);
      setTagsInput("");
    }
  };

  const removeTag = (tag: string) => {
    if (editedRule()) {
      updateRule("tags", editedRule()!.tags.filter(t => t !== tag));
    }
  };

  const handleSave = () => {
    const rule = editedRule();
    if (!rule) return;

    if (!rule.name.trim()) return;
    if (!rule.pattern.trim()) return;
    if (patternError()) return;

    props.onSave(rule);
    props.onClose();
  };

  const isValid = () => {
    const rule = editedRule();
    return rule && rule.name.trim() && rule.pattern.trim() && !patternError();
  };

  const fieldStyle: JSX.CSSProperties = {
    "margin-bottom": "16px",
  };

  const footer = (
    <>
      <Button variant="ghost" onClick={props.onClose}>Cancel</Button>
      <Button variant="primary" onClick={handleSave} disabled={!isValid()}>
        Save Rule
      </Button>
    </>
  );

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.rule ? "Edit Rule" : "New Rule"}
      size="md"
      footer={footer}
    >
      <Show when={editedRule()}>
        <div style={fieldStyle}>
          <Input
            label="Name"
            value={editedRule()!.name}
            onInput={(e) => updateRule("name", e.currentTarget.value)}
            placeholder="Rule name"
          />
        </div>

        <div style={fieldStyle}>
          <Input
            label="Pattern (Regex)"
            value={editedRule()!.pattern}
            onInput={(e) => updateRule("pattern", e.currentTarget.value)}
            placeholder="^rm.*-rf.*/"
            error={patternError() || undefined}
            hint="Regular expression to match against input"
            style={{ "font-family": "var(--jb-font-mono)" }}
          />
        </div>

        <div style={{ display: "flex", gap: "16px", ...fieldStyle }}>
          <div style={{ flex: 1 }}>
            <label style={{ 
              "font-size": "var(--jb-text-muted-size)", 
              color: "var(--jb-text-muted-color)", 
              display: "block", 
              "margin-bottom": "6px" 
            }}>
              Action
            </label>
            <Select
              options={RULE_ACTIONS.map(a => ({ value: a.value, label: a.label }))}
              value={editedRule()!.action}
              onChange={(value) => updateRule("action", value as RuleAction)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ 
              "font-size": "var(--jb-text-muted-size)", 
              color: "var(--jb-text-muted-color)", 
              display: "block", 
              "margin-bottom": "6px" 
            }}>
              Risk Level
            </label>
            <Select
              options={RISK_LEVELS.map(r => ({ value: r.value, label: r.label }))}
              value={editedRule()!.riskLevel}
              onChange={(value) => updateRule("riskLevel", value as RiskLevel)}
            />
          </div>
        </div>

        <Show when={editedRule()!.action === "deny" || editedRule()!.action === "pause"}>
          <div style={fieldStyle}>
            <Textarea
              label="Message"
              value={editedRule()!.message || ""}
              onInput={(e) => updateRule("message", e.currentTarget.value)}
              placeholder="Message to show when this rule is triggered"
              style={{ "min-height": "60px" }}
            />
          </div>
        </Show>

        <Show when={editedRule()!.action === "modify"}>
          <div style={fieldStyle}>
            <Textarea
              label="Modify Script"
              value={editedRule()!.modifyScript || ""}
              onInput={(e) => updateRule("modifyScript", e.currentTarget.value)}
              placeholder="// JavaScript to transform the input\nreturn input.replace(/dangerous/, 'safe');"
              style={{ 
                "min-height": "100px",
                "font-family": "var(--jb-font-mono)",
                "font-size": "12px",
              }}
            />
          </div>
        </Show>

        <div style={fieldStyle}>
          <label style={{ 
            "font-size": "var(--jb-text-muted-size)", 
            color: "var(--jb-text-muted-color)", 
            display: "block", 
            "margin-bottom": "6px" 
          }}>
            Tags
          </label>
          <div style={{ display: "flex", "flex-wrap": "wrap", gap: "6px", "margin-bottom": "8px" }}>
            <For each={editedRule()!.tags}>
              {(tag) => (
                <Badge variant="default" style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                  {tag}
                  <button
                    type="button"
                    style={{
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "center",
                      width: "12px",
                      height: "12px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "inherit",
                      padding: "0",
                    }}
                    onClick={() => removeTag(tag)}
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                      <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" stroke-width="1.5" fill="none"/>
                    </svg>
                  </button>
                </Badge>
              )}
            </For>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Input
              value={tagsInput()}
              onInput={(e) => setTagsInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add tag..."
              style={{ flex: 1 }}
            />
            <Button variant="secondary" size="sm" onClick={addTag}>Add</Button>
          </div>
        </div>
      </Show>
    </Modal>
  );
}

// =============================================================================
// TEST PANEL COMPONENT
// =============================================================================

interface TestPanelProps {
  rules: InterceptionRule[];
}

function TestPanel(props: TestPanelProps) {
  const [testInput, setTestInput] = createSignal("");
  const [testResult, setTestResult] = createSignal<TestResult | null>(null);

  const runTest = () => {
    const input = testInput();
    if (!input) {
      setTestResult(null);
      return;
    }

    // Test against enabled rules in order
    for (const rule of props.rules.filter(r => r.enabled)) {
      if (testPattern(rule.pattern, input)) {
        setTestResult({
          matched: true,
          rule,
          action: rule.action,
        });
        return;
      }
    }

    setTestResult({ matched: false });
  };

  const containerStyle: JSX.CSSProperties = {
    padding: "16px",
    background: "var(--jb-surface-panel)",
    "border-radius": "var(--jb-radius-md)",
    border: "1px solid var(--jb-border-divider)",
    "margin-top": "16px",
  };

  const titleStyle: JSX.CSSProperties = {
    "font-size": "13px",
    "font-weight": "600",
    color: "var(--jb-text-header-color)",
    "margin-bottom": "12px",
  };

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>Test Rules</div>
      <div style={{ display: "flex", gap: "8px", "margin-bottom": "12px" }}>
        <Input
          value={testInput()}
          onInput={(e) => setTestInput(e.currentTarget.value)}
          placeholder="Enter test input (e.g., 'rm -rf /')"
          style={{ flex: 1, "font-family": "var(--jb-font-mono)" }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              runTest();
            }
          }}
        />
        <Button variant="secondary" onClick={runTest}>Test</Button>
      </div>
      <Show when={testResult()}>
        <div style={{
          padding: "12px",
          background: testResult()!.matched 
            ? testResult()!.action === "allow" 
              ? "rgba(89, 168, 105, 0.1)" 
              : testResult()!.action === "deny" 
                ? "rgba(247, 84, 100, 0.1)"
                : "rgba(233, 170, 70, 0.1)"
            : "var(--jb-canvas)",
          "border-radius": "var(--jb-radius-sm)",
          border: `1px solid ${
            testResult()!.matched 
              ? testResult()!.action === "allow" 
                ? "var(--cortex-success)" 
                : testResult()!.action === "deny" 
                  ? "var(--cortex-error)"
                  : "var(--cortex-warning)"
              : "var(--jb-border-default)"
          }`,
        }}>
          <Show when={testResult()!.matched}>
            <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "8px" }}>
              <Badge variant={
                testResult()!.action === "allow" ? "success" :
                testResult()!.action === "deny" ? "error" : "warning"
              }>
                {testResult()!.action?.toUpperCase()}
              </Badge>
              <span style={{ "font-size": "13px", color: "var(--jb-text-body-color)" }}>
                Matched: {testResult()!.rule?.name}
              </span>
            </div>
            <Show when={testResult()!.rule?.message}>
              <div style={{ 
                "font-size": "12px", 
                color: "var(--jb-text-muted-color)",
                "font-style": "italic",
              }}>
                "{testResult()!.rule?.message}"
              </div>
            </Show>
          </Show>
          <Show when={!testResult()!.matched}>
            <div style={{ 
              display: "flex", 
              "align-items": "center", 
              gap: "8px",
              color: "var(--jb-text-muted-color)",
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2a5 5 0 1 1 0 10A5 5 0 0 1 8 3z"/>
              </svg>
              <span>No rules matched. Action would be allowed.</span>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

// =============================================================================
// PRESET LIBRARY DIALOG
// =============================================================================

interface PresetLibraryDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (rules: InterceptionRule[]) => void;
  existingRuleIds: Set<string>;
}

function PresetLibraryDialog(props: PresetLibraryDialogProps) {
  const [selected, setSelected] = createSignal<Set<string>>(new Set<string>());

  createEffect(() => {
    if (props.open) {
      setSelected(new Set<string>());
    }
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleImport = () => {
    const selectedRules = PRESET_RULES
      .filter(r => selected().has(r.id))
      .map(r => ({ ...r, id: generateId() })); // Generate new IDs
    props.onImport(selectedRules);
    props.onClose();
  };

  const footer = (
    <>
      <Button variant="ghost" onClick={props.onClose}>Cancel</Button>
      <Button variant="primary" onClick={handleImport} disabled={selected().size === 0}>
        Import {selected().size > 0 ? `(${selected().size})` : ""}
      </Button>
    </>
  );

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Preset Rules Library"
      size="md"
      footer={footer}
    >
      <div style={{ "margin-bottom": "12px", color: "var(--jb-text-muted-color)", "font-size": "12px" }}>
        Select preset rules to import into your workflow:
      </div>
      <For each={PRESET_RULES}>
        {(rule) => {
          const alreadyExists = props.existingRuleIds.has(rule.id);
          return (
            <div style={{
              display: "flex",
              "align-items": "flex-start",
              gap: "12px",
              padding: "12px",
              background: "var(--jb-surface-panel)",
              "border-radius": "var(--jb-radius-md)",
              border: "1px solid var(--jb-border-divider)",
              "margin-bottom": "8px",
              opacity: alreadyExists ? "0.5" : "1",
            }}>
              <Checkbox
                checked={selected().has(rule.id)}
                onChange={() => toggleSelect(rule.id)}
                disabled={alreadyExists}
                aria-label={`Select ${rule.name}`}
              />
              <div style={{ flex: 1 }}>
                <div style={{ 
                  display: "flex", 
                  "align-items": "center", 
                  gap: "8px",
                  "margin-bottom": "4px",
                }}>
                  <span style={{ 
                    "font-size": "13px", 
                    "font-weight": "500", 
                    color: "var(--jb-text-body-color)" 
                  }}>
                    {rule.name}
                  </span>
                  <Badge variant={
                    rule.action === "allow" ? "success" :
                    rule.action === "deny" ? "error" : "warning"
                  } size="sm">
                    {rule.action}
                  </Badge>
                </div>
                <div style={{ 
                  "font-family": "var(--jb-font-mono)",
                  "font-size": "11px",
                  color: "var(--jb-text-muted-color)",
                  "margin-bottom": "4px",
                }}>
                  {rule.pattern}
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                  <For each={rule.tags}>
                    {(tag) => <Badge variant="default" size="sm">{tag}</Badge>}
                  </For>
                </div>
                <Show when={alreadyExists}>
                  <div style={{ 
                    "margin-top": "4px",
                    "font-size": "11px",
                    color: "var(--cortex-warning)",
                  }}>
                    Already imported
                  </div>
                </Show>
              </div>
            </div>
          );
        }}
      </For>
    </Modal>
  );
}

// =============================================================================
// MAIN RULES EDITOR COMPONENT
// =============================================================================

export function RulesEditor(props: RulesEditorProps) {
  const [localRules, setLocalRules] = createSignal<InterceptionRule[]>([]);
  const [editingRule, setEditingRule] = createSignal<InterceptionRule | null>(null);
  const [showRuleEditor, setShowRuleEditor] = createSignal(false);
  const [showPresetLibrary, setShowPresetLibrary] = createSignal(false);

  // Initialize rules when opening
  createEffect(() => {
    if (props.open) {
      setLocalRules([...props.rules]);
    }
  });

  const existingRuleIds = createMemo(() => new Set(localRules().map(r => r.id)));

  const addRule = () => {
    setEditingRule(null);
    setShowRuleEditor(true);
  };

  const editRule = (rule: InterceptionRule) => {
    setEditingRule(rule);
    setShowRuleEditor(true);
  };

  const saveRule = (rule: InterceptionRule) => {
    setLocalRules(prev => {
      const idx = prev.findIndex(r => r.id === rule.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = rule;
        return updated;
      }
      return [...prev, rule];
    });
  };

  const deleteRule = (id: string) => {
    setLocalRules(prev => prev.filter(r => r.id !== id));
  };

  const toggleRule = (id: string, enabled: boolean) => {
    setLocalRules(prev => prev.map(r => 
      r.id === id ? { ...r, enabled } : r
    ));
  };

  const moveRule = (index: number, direction: "up" | "down") => {
    setLocalRules(prev => {
      const newRules = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newRules.length) return prev;
      [newRules[index], newRules[targetIndex]] = [newRules[targetIndex], newRules[index]];
      return newRules;
    });
  };

  const importRules = (rules: InterceptionRule[]) => {
    setLocalRules(prev => [...prev, ...rules]);
  };

  const exportRules = () => {
    const json = JSON.stringify(localRules(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "interception-rules.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFromFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const rules = JSON.parse(e.target?.result as string) as InterceptionRule[];
          if (Array.isArray(rules)) {
            // Generate new IDs to avoid conflicts
            const newRules = rules.map(r => ({ ...r, id: generateId() }));
            importRules(newRules);
          }
        } catch (err) {
          console.error("Failed to parse rules file:", err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleSave = () => {
    props.onSave?.(localRules());
    props.onClose();
  };

  // Modal footer
  const footer = (
    <div style={{ display: "flex", "align-items": "center", gap: "8px", width: "100%" }}>
      <div style={{ flex: 1 }} />
      <Button variant="ghost" onClick={props.onClose} disabled={props.loading}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSave} loading={props.loading}>
        Save Rules
      </Button>
    </div>
  );

  const toolbarStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "margin-bottom": "16px",
    "flex-wrap": "wrap",
  };

  return (
    <>
      <Modal
        open={props.open}
        onClose={props.onClose}
        title="Interception Rules"
        size="lg"
        footer={footer}
        style={{ width: "720px", "max-width": "90vw", "max-height": "85vh" }}
      >
        {/* Toolbar */}
        <div style={toolbarStyle}>
          <Button variant="primary" size="sm" onClick={addRule}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ "margin-right": "4px" }}>
              <path d="M6 0v12M0 6h12" stroke="currentColor" stroke-width="2" fill="none"/>
            </svg>
            Add Rule
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowPresetLibrary(true)}>
            Presets
          </Button>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" size="sm" onClick={importFromFile}>
            Import
          </Button>
          <Button variant="ghost" size="sm" onClick={exportRules} disabled={localRules().length === 0}>
            Export
          </Button>
        </div>

        {/* Rules List */}
        <Show when={localRules().length > 0} fallback={
          <div style={{
            padding: "48px 24px",
            "text-align": "center",
            color: "var(--jb-text-muted-color)",
            background: "var(--jb-surface-panel)",
            "border-radius": "var(--jb-radius-md)",
            border: "1px dashed var(--jb-border-default)",
          }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor" style={{ opacity: 0.3, "margin-bottom": "12px" }}>
              <path d="M24 4c-11.046 0-20 8.954-20 20s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4zm0 4c8.837 0 16 7.163 16 16s-7.163 16-16 16S8 32.837 8 24 15.163 8 24 8zm-4 8v16h8V16h-8z"/>
            </svg>
            <div style={{ "font-size": "14px", "font-weight": "500", "margin-bottom": "4px" }}>
              No Rules Defined
            </div>
            <div style={{ "font-size": "12px", "margin-bottom": "16px" }}>
              Rules are evaluated from top to bottom. The first matching rule wins.
            </div>
            <div style={{ display: "flex", gap: "8px", "justify-content": "center" }}>
              <Button variant="primary" size="sm" onClick={addRule}>Add Rule</Button>
              <Button variant="secondary" size="sm" onClick={() => setShowPresetLibrary(true)}>
                Browse Presets
              </Button>
            </div>
          </div>
        }>
          <div style={{ 
            "max-height": "350px", 
            "overflow-y": "auto",
            "padding-right": "4px",
          }}>
            <For each={localRules()}>
              {(rule, index) => (
                <RuleItem
                  rule={rule}
                  index={index()}
                  isEditing={false}
                  onEdit={() => editRule(rule)}
                  onToggle={(enabled) => toggleRule(rule.id, enabled)}
                  onDelete={() => deleteRule(rule.id)}
                  onMoveUp={() => moveRule(index(), "up")}
                  onMoveDown={() => moveRule(index(), "down")}
                  isFirst={index() === 0}
                  isLast={index() === localRules().length - 1}
                />
              )}
            </For>
          </div>
        </Show>

        {/* Test Panel */}
        <Show when={localRules().length > 0}>
          <TestPanel rules={localRules()} />
        </Show>

        {/* Info */}
        <div style={{
          "margin-top": "16px",
          padding: "12px",
          background: "rgba(53, 116, 240, 0.1)",
          "border-radius": "var(--jb-radius-md)",
          "font-size": "12px",
          color: "var(--jb-text-muted-color)",
        }}>
          <strong style={{ color: "var(--jb-text-body-color)" }}>How Rules Work:</strong>
          <ul style={{ margin: "8px 0 0 0", padding: "0 0 0 16px" }}>
            <li>Rules are evaluated from top to bottom</li>
            <li>The first matching rule determines the action</li>
            <li>If no rules match, the action is allowed</li>
            <li>Patterns use JavaScript regular expressions</li>
          </ul>
        </div>
      </Modal>

      {/* Rule Editor Dialog */}
      <RuleEditorDialog
        open={showRuleEditor()}
        rule={editingRule()}
        onClose={() => setShowRuleEditor(false)}
        onSave={saveRule}
      />

      {/* Preset Library Dialog */}
      <PresetLibraryDialog
        open={showPresetLibrary()}
        onClose={() => setShowPresetLibrary(false)}
        onImport={importRules}
        existingRuleIds={existingRuleIds()}
      />
    </>
  );
}

export default RulesEditor;

