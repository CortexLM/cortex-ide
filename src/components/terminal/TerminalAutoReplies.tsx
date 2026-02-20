/**
 * Terminal Auto Replies - Automatically respond to prompts
 *
 * Useful for:
 * - "Are you sure? (y/n)"
 * - "Overwrite file? [y/N]"
 * - "Continue? [Y/n]"
 * - Password prompts (careful!)
 */

import {
  createSignal,
  createEffect,
  For,
  Show,
  createMemo,
  onMount,
  onCleanup,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Icon } from "../ui/Icon";
import { Button, IconButton, Input, Text, Badge } from "@/components/ui";
import { terminalLogger } from "../../utils/logger";

// ============================================================================
// Types
// ============================================================================

/**
 * Auto-reply rule configuration
 */
export interface AutoReplyRule {
  /** Unique identifier for the rule */
  id: string;
  /** Display name for the rule */
  name: string;
  /** Regex pattern to match terminal output */
  pattern: string;
  /** Response to send when pattern matches */
  reply: string;
  /** Whether the rule is enabled */
  enabled: boolean;
  /** Whether pattern matching is case sensitive */
  caseSensitive: boolean;
  /** Optional terminal ID filter - only apply to specific terminals */
  terminalFilter?: string;
  /** Optional delay before sending reply (ms) */
  delay?: number;
  /** Number of times this rule has been triggered */
  triggerCount?: number;
  /** Last triggered timestamp */
  lastTriggered?: number;
}

/**
 * Props for the AutoReplyManager component
 */
interface AutoReplyManagerProps {
  /** Callback when the manager is closed */
  onClose: () => void;
  /** Initial rules (if loading from storage) */
  initialRules?: AutoReplyRule[];
  /** Callback when rules change */
  onRulesChange?: (rules: AutoReplyRule[]) => void;
}

/**
 * Props for the rule editor component
 */
interface RuleEditorProps {
  /** Rule being edited (null for new rule) */
  rule: AutoReplyRule | null;
  /** Callback when save is clicked */
  onSave: (rule: AutoReplyRule) => void;
  /** Callback when cancel is clicked */
  onCancel: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Storage key for persisting auto-reply rules */
const STORAGE_KEY = "cortex_terminal_auto_replies";

/** Default auto-reply rules */
export const DEFAULT_AUTO_REPLIES: AutoReplyRule[] = [
  {
    id: "confirm-yes",
    name: "Confirm Yes",
    pattern: "\\[y/N\\]|\\(y/n\\)",
    reply: "y\n",
    enabled: false,
    caseSensitive: false,
  },
  {
    id: "continue",
    name: "Continue",
    pattern: "Continue\\?|Press any key|press any key to continue",
    reply: "\n",
    enabled: false,
    caseSensitive: false,
  },
  {
    id: "overwrite-yes",
    name: "Overwrite Yes",
    pattern: "Overwrite\\?|overwrite\\s*\\?|already exists.*overwrite",
    reply: "y\n",
    enabled: false,
    caseSensitive: false,
  },
  {
    id: "proceed-yes",
    name: "Proceed Yes",
    pattern: "Do you want to proceed\\?|proceed\\?.*\\[Y/n\\]",
    reply: "Y\n",
    enabled: false,
    caseSensitive: false,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID for a rule
 */
const generateId = (): string => {
  return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Validate a regex pattern
 */
const validatePattern = (pattern: string): { valid: boolean; error?: string } => {
  try {
    new RegExp(pattern);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : "Invalid pattern" };
  }
};

/**
 * Test a pattern against sample text
 */
const testPattern = (pattern: string, text: string, caseSensitive: boolean): boolean => {
  try {
    const flags = caseSensitive ? "g" : "gi";
    const regex = new RegExp(pattern, flags);
    return regex.test(text);
  } catch {
    return false;
  }
};

// ============================================================================
// Rule Editor Component
// ============================================================================

function RuleEditor(props: RuleEditorProps) {
  const isEditing = () => props.rule !== null;
  
  const [name, setName] = createSignal(props.rule?.name || "");
  const [pattern, setPattern] = createSignal(props.rule?.pattern || "");
  const [reply, setReply] = createSignal(props.rule?.reply || "");
  const [caseSensitive, setCaseSensitive] = createSignal(props.rule?.caseSensitive || false);
  const [terminalFilter, setTerminalFilter] = createSignal(props.rule?.terminalFilter || "");
  const [delay, setDelay] = createSignal(props.rule?.delay?.toString() || "0");
  const [testText, setTestText] = createSignal("");
  
  const patternValidation = createMemo(() => validatePattern(pattern()));
  const testResult = createMemo(() => {
    if (!testText() || !patternValidation().valid) return null;
    return testPattern(pattern(), testText(), caseSensitive());
  });

  const handleSave = () => {
    if (!name().trim() || !pattern().trim() || !patternValidation().valid) return;
    
    const rule: AutoReplyRule = {
      id: props.rule?.id || generateId(),
      name: name().trim(),
      pattern: pattern(),
      reply: reply(),
      enabled: props.rule?.enabled ?? true,
      caseSensitive: caseSensitive(),
      terminalFilter: terminalFilter() || undefined,
      delay: parseInt(delay()) || 0,
      triggerCount: props.rule?.triggerCount || 0,
      lastTriggered: props.rule?.lastTriggered,
    };
    
    props.onSave(rule);
  };

  // Format reply for display (show escape sequences)
  const formatReply = (r: string): string => {
    return r
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
  };

  // Parse reply from display format
  const parseReply = (r: string): string => {
    return r
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t");
  };

  return (
    <div class="p-4 space-y-4" style={{ background: "var(--jb-panel)" }}>
      <Text as="h3" weight="semibold" size="md">
        {isEditing() ? "Edit Rule" : "New Rule"}
      </Text>

      {/* Name */}
      <div class="space-y-1">
        <Text size="sm" weight="medium">Name</Text>
        <Input
          type="text"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          placeholder="Rule name"
        />
      </div>

      {/* Pattern */}
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <Text size="sm" weight="medium">Pattern (Regex)</Text>
          <Show when={!patternValidation().valid}>
            <Badge variant="error" size="sm">Invalid</Badge>
          </Show>
        </div>
        <Input
          type="text"
          value={pattern()}
          onInput={(e) => setPattern(e.currentTarget.value)}
          placeholder="\\[y/N\\]|\\(y/n\\)"
          style={{
            "font-family": "monospace",
            "border-color": patternValidation().valid ? undefined : "var(--jb-danger)",
          }}
        />
        <Show when={patternValidation().error}>
          <Text size="xs" style={{ color: "var(--jb-danger)" }}>
            {patternValidation().error}
          </Text>
        </Show>
      </div>

      {/* Reply */}
      <div class="space-y-1">
        <Text size="sm" weight="medium">Reply</Text>
        <Input
          type="text"
          value={formatReply(reply())}
          onInput={(e) => setReply(parseReply(e.currentTarget.value))}
          placeholder="y\n"
          style={{ "font-family": "monospace" }}
        />
        <Text size="xs" style={{ color: "var(--jb-text-muted-color)" }}>
          Use \n for newline, \r for carriage return, \t for tab
        </Text>
      </div>

      {/* Options */}
      <div class="grid grid-cols-2 gap-4">
        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            id="case-sensitive"
            checked={caseSensitive()}
            onChange={(e) => setCaseSensitive(e.currentTarget.checked)}
          />
          <label for="case-sensitive">
            <Text size="sm">Case Sensitive</Text>
          </label>
        </div>
        
        <div class="space-y-1">
          <Text size="sm" weight="medium">Delay (ms)</Text>
          <Input
            type="number"
            value={delay()}
            onInput={(e) => setDelay(e.currentTarget.value)}
            placeholder="0"
            min="0"
            max="10000"
            style={{ width: "100px" }}
          />
        </div>
      </div>

      {/* Terminal Filter */}
      <div class="space-y-1">
        <Text size="sm" weight="medium">Terminal Filter (optional)</Text>
        <Input
          type="text"
          value={terminalFilter()}
          onInput={(e) => setTerminalFilter(e.currentTarget.value)}
          placeholder="Leave empty to apply to all terminals"
        />
        <Text size="xs" style={{ color: "var(--jb-text-muted-color)" }}>
          Terminal name pattern to match (e.g., "bash", "powershell")
        </Text>
      </div>

      {/* Pattern Tester */}
      <div class="space-y-2 p-3 rounded-lg" style={{ background: "var(--jb-bg-secondary)" }}>
        <Text size="sm" weight="medium">Test Pattern</Text>
        <Input
          type="text"
          value={testText()}
          onInput={(e) => setTestText(e.currentTarget.value)}
          placeholder="Enter test text to check pattern match"
        />
        <Show when={testText()}>
          <div class="flex items-center gap-2">
            <Show when={testResult() !== null}>
              <Show
                when={testResult()}
                fallback={
                  <Badge variant="error" size="sm">
                    <Icon name="xmark" class="h-3 w-3 mr-1" />
                    No Match
                  </Badge>
                }
              >
                <Badge variant="success" size="sm">
                  <Icon name="check" class="h-3 w-3 mr-1" />
                  Match Found
                </Badge>
              </Show>
            </Show>
          </div>
        </Show>
      </div>

      {/* Actions */}
      <div class="flex justify-end gap-2 pt-4 border-t" style={{ "border-color": "var(--jb-border-default)" }}>
        <Button variant="ghost" onClick={props.onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!name().trim() || !pattern().trim() || !patternValidation().valid}
        >
          {isEditing() ? "Save Changes" : "Create Rule"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Rule List Item Component
// ============================================================================

interface RuleListItemProps {
  rule: AutoReplyRule;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function RuleListItem(props: RuleListItemProps) {
  const formatLastTriggered = () => {
    if (!props.rule.lastTriggered) return "Never";
    const date = new Date(props.rule.lastTriggered);
    return date.toLocaleString();
  };

  return (
    <div
      class="flex items-center gap-3 p-3 rounded-lg transition-colors"
      style={{
        background: props.rule.enabled ? "var(--jb-bg-secondary)" : "transparent",
        opacity: props.rule.enabled ? 1 : 0.6,
        border: "1px solid var(--jb-border-default)",
      }}
    >
      {/* Toggle */}
      <IconButton
        onClick={props.onToggle}
        size="sm"
        title={props.rule.enabled ? "Disable" : "Enable"}
      >
        <Show
          when={props.rule.enabled}
          fallback={<Icon name="toggle-off" class="h-5 w-5" style={{ color: "var(--jb-text-muted-color)" }} />}
        >
          <Icon name="toggle-on" class="h-5 w-5" style={{ color: "var(--jb-success)" }} />
        </Show>
      </IconButton>

      {/* Info */}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <Text weight="medium" size="sm" style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
            {props.rule.name}
          </Text>
          <Show when={props.rule.terminalFilter}>
            <Badge size="sm" variant="default">
              {props.rule.terminalFilter}
            </Badge>
          </Show>
        </div>
        <div class="flex items-center gap-4 mt-1">
          <Text size="xs" style={{ color: "var(--jb-text-muted-color)", "font-family": "monospace" }}>
            /{props.rule.pattern}/
          </Text>
          <Text size="xs" style={{ color: "var(--jb-text-muted-color)" }}>
            → "{props.rule.reply.replace(/\n/g, "\\n")}"
          </Text>
        </div>
        <Show when={props.rule.triggerCount}>
          <Text size="xs" style={{ color: "var(--jb-text-muted-color)", "margin-top": "4px" }}>
            Triggered {props.rule.triggerCount} times • Last: {formatLastTriggered()}
          </Text>
        </Show>
      </div>

      {/* Actions */}
      <div class="flex items-center gap-1">
        <IconButton onClick={props.onEdit} size="sm" title="Edit">
          <Icon name="pen" class="h-4 w-4" />
        </IconButton>
        <IconButton onClick={props.onDelete} size="sm" title="Delete">
          <Icon name="trash" class="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

// ============================================================================
// Main Auto Reply Manager Component
// ============================================================================

export function AutoReplyManager(props: AutoReplyManagerProps) {
  const [rules, setRules] = createStore<AutoReplyRule[]>(
    props.initialRules || loadRulesFromStorage()
  );
  const [editingRule, setEditingRule] = createSignal<AutoReplyRule | null>(null);
  const [isAddingRule, setIsAddingRule] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");

  // Load rules from localStorage
  function loadRulesFromStorage(): AutoReplyRule[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      terminalLogger.error("[AutoReply] Failed to load rules from storage:", e);
    }
    return [...DEFAULT_AUTO_REPLIES];
  }

  // Save rules to localStorage
  function saveRulesToStorage(rulesToSave: AutoReplyRule[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rulesToSave));
    } catch (e) {
      terminalLogger.error("[AutoReply] Failed to save rules to storage:", e);
    }
  }

  // Persist rules on change
  createEffect(() => {
    saveRulesToStorage([...rules]);
    props.onRulesChange?.([...rules]);
  });

  // Filtered rules based on search
  const filteredRules = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return rules;
    return rules.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.pattern.toLowerCase().includes(query)
    );
  });

  // Stats
  const enabledCount = createMemo(() => rules.filter((r) => r.enabled).length);

  // Handlers
  const handleToggleRule = (id: string) => {
    setRules(
      produce((draft) => {
        const rule = draft.find((r) => r.id === id);
        if (rule) rule.enabled = !rule.enabled;
      })
    );
  };

  const handleSaveRule = (rule: AutoReplyRule) => {
    const existingIndex = rules.findIndex((r) => r.id === rule.id);
    if (existingIndex >= 0) {
      setRules(existingIndex, rule);
    } else {
      setRules(produce((draft) => draft.push(rule)));
    }
    setEditingRule(null);
    setIsAddingRule(false);
  };

  const handleDeleteRule = (id: string) => {
    if (confirm("Are you sure you want to delete this rule?")) {
      setRules(produce((draft) => {
        const index = draft.findIndex((r) => r.id === id);
        if (index >= 0) draft.splice(index, 1);
      }));
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(rules, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "terminal-auto-replies.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const imported = JSON.parse(text) as AutoReplyRule[];
        if (!Array.isArray(imported)) throw new Error("Invalid format");
        
        // Validate each rule
        for (const rule of imported) {
          if (!rule.id || !rule.name || !rule.pattern) {
            throw new Error("Invalid rule format");
          }
          validatePattern(rule.pattern);
        }
        
        // Merge with existing rules (avoid duplicates by ID)
        setRules(produce((draft) => {
          for (const rule of imported) {
            const existingIndex = draft.findIndex((r) => r.id === rule.id);
            if (existingIndex >= 0) {
              draft[existingIndex] = rule;
            } else {
              draft.push(rule);
            }
          }
        }));
      } catch (e) {
        alert(`Failed to import rules: ${e instanceof Error ? e.message : "Unknown error"}`);
      }
    };
    input.click();
  };

  const handleResetToDefaults = () => {
    if (confirm("Reset to default rules? This will remove all custom rules.")) {
      setRules([...DEFAULT_AUTO_REPLIES]);
    }
  };

  // Keyboard handling
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (editingRule() !== null || isAddingRule()) {
        setEditingRule(null);
        setIsAddingRule(false);
      } else {
        props.onClose();
      }
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div
      class="flex flex-col h-full"
      style={{
        background: "var(--jb-modal)",
        "border-radius": "var(--jb-radius-lg)",
        border: "1px solid var(--jb-border-default)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        class="flex items-center justify-between p-4"
        style={{
          "border-bottom": "1px solid var(--jb-border-default)",
          background: "var(--jb-panel)",
        }}
      >
        <div class="flex items-center gap-3">
          <Text as="h2" size="lg" weight="semibold">
            Terminal Auto Replies
          </Text>
          <Badge size="sm">
            {enabledCount()} / {rules.length} active
          </Badge>
        </div>
        <div class="flex items-center gap-2">
          <IconButton onClick={handleExport} size="sm" title="Export Rules">
            <Icon name="download" class="h-4 w-4" />
          </IconButton>
          <IconButton onClick={handleImport} size="sm" title="Import Rules">
            <Icon name="upload" class="h-4 w-4" />
          </IconButton>
          <IconButton onClick={props.onClose} size="lg">
            <Icon name="xmark" class="h-5 w-5" />
          </IconButton>
        </div>
      </div>

      {/* Warning Banner */}
      <div
        class="flex items-center gap-2 px-4 py-2"
        style={{
          background: "rgba(245, 158, 11, 0.1)",
          "border-bottom": "1px solid rgba(245, 158, 11, 0.2)",
        }}
      >
        <Icon name="triangle-exclamation" class="h-4 w-4" style={{ color: "var(--cortex-warning)" }} />
        <Text size="xs" style={{ color: "var(--cortex-warning)" }}>
          Auto-replies can be dangerous. Never auto-reply to password prompts or
          destructive operations without careful consideration.
        </Text>
      </div>

      {/* Content */}
      <Show
        when={!editingRule() && !isAddingRule()}
        fallback={
          <div class="flex-1 overflow-y-auto">
            <RuleEditor
              rule={editingRule()}
              onSave={handleSaveRule}
              onCancel={() => {
                setEditingRule(null);
                setIsAddingRule(false);
              }}
            />
          </div>
        }
      >
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Search and Add */}
          <div class="flex items-center gap-2">
            <Input
              type="text"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              placeholder="Search rules..."
              class="flex-1"
            />
            <Button
              variant="primary"
              onClick={() => setIsAddingRule(true)}
              icon={<Icon name="plus" class="h-4 w-4" />}
            >
              Add Rule
            </Button>
          </div>

          {/* Rules List */}
          <Show
            when={filteredRules().length > 0}
            fallback={
              <div class="text-center py-8">
                <Text style={{ color: "var(--jb-text-muted-color)" }}>
                  {searchQuery() ? "No rules match your search" : "No rules configured"}
                </Text>
              </div>
            }
          >
            <div class="space-y-2">
              <For each={filteredRules()}>
                {(rule) => (
                  <RuleListItem
                    rule={rule}
                    onToggle={() => handleToggleRule(rule.id)}
                    onEdit={() => setEditingRule(rule)}
                    onDelete={() => handleDeleteRule(rule.id)}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      {/* Footer */}
      <Show when={!editingRule() && !isAddingRule()}>
        <div
          class="flex items-center justify-between p-4"
          style={{
            "border-top": "1px solid var(--jb-border-default)",
            background: "var(--jb-panel)",
          }}
        >
          <Button variant="ghost" size="sm" onClick={handleResetToDefaults}>
            Reset to Defaults
          </Button>
          <Text size="xs" style={{ color: "var(--jb-text-muted-color)" }}>
            Rules are saved automatically
          </Text>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export { STORAGE_KEY as AUTO_REPLY_STORAGE_KEY };
export default AutoReplyManager;

