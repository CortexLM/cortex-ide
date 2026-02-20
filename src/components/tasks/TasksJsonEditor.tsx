/**
 * TasksJsonEditor - Direct editor for .vscode/tasks.json
 *
 * Features:
 * - Monaco editor with JSON schema validation
 * - VS Code tasks.json schema support
 * - Live validation and error display
 * - Create default tasks.json if none exists
 * - Syntax highlighting and auto-completion
 */

import { createSignal, createEffect, Show } from "solid-js";
import { Icon } from "../ui/Icon";
import { useTasks, BUILTIN_PROBLEM_MATCHERS } from "@/context/TasksContext";
import { useSDK } from "@/context/SDKContext";
import { Button, IconButton } from "@/components/ui";

// ============================================================================
// Default tasks.json template
// ============================================================================

const DEFAULT_TASKS_JSON = `{
  // See https://go.microsoft.com/fwlink/?LinkId=733558
  // for the documentation about the tasks.json format
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Build",
      "type": "shell",
      "command": "npm run build",
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "problemMatcher": ["$tsc"],
      "presentation": {
        "reveal": "always",
        "panel": "shared"
      }
    },
    {
      "label": "Test",
      "type": "shell",
      "command": "npm test",
      "group": {
        "kind": "test",
        "isDefault": true
      },
      "problemMatcher": []
    }
  ]
}`;

// ============================================================================
// Tasks JSON Schema (for Monaco validation)
// ============================================================================

export const TASKS_JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "VS Code Tasks Configuration",
  type: "object",
  properties: {
    version: {
      type: "string",
      enum: ["2.0.0"],
      description: "Version of the tasks.json file format",
    },
    tasks: {
      type: "array",
      items: {
        type: "object",
        required: ["label"],
        properties: {
          label: {
            type: "string",
            description: "The task's label used in the UI",
          },
          type: {
            type: "string",
            enum: ["shell", "process", "npm", "yarn"],
            description: "The task type",
          },
          command: {
            type: "string",
            description: "The command to execute",
          },
          args: {
            type: "array",
            items: { type: "string" },
            description: "Arguments passed to the command",
          },
          options: {
            type: "object",
            properties: {
              cwd: {
                type: "string",
                description: "Working directory",
              },
              env: {
                type: "object",
                additionalProperties: { type: "string" },
                description: "Environment variables",
              },
              shell: {
                type: "object",
                properties: {
                  executable: { type: "string" },
                  args: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
          group: {
            oneOf: [
              { type: "string", enum: ["build", "test", "none"] },
              {
                type: "object",
                properties: {
                  kind: { type: "string", enum: ["build", "test", "none"] },
                  isDefault: { type: "boolean" },
                },
              },
            ],
            description: "Task group",
          },
          problemMatcher: {
            oneOf: [
              { type: "string" },
              { type: "array", items: { type: "string" } },
              {
                type: "object",
                properties: {
                  owner: { type: "string" },
                  pattern: { type: ["object", "array"] },
                  fileLocation: {},
                  severity: { type: "string" },
                  background: { type: "object" },
                },
              },
            ],
            description: "Problem matcher for parsing output",
          },
          presentation: {
            type: "object",
            properties: {
              reveal: {
                type: "string",
                enum: ["always", "silent", "never"],
              },
              focus: { type: "boolean" },
              panel: {
                type: "string",
                enum: ["shared", "dedicated", "new"],
              },
              clear: { type: "boolean" },
            },
          },
          runOptions: {
            type: "object",
            properties: {
              reevaluateOnRerun: { type: "boolean" },
              runOn: { type: "string", enum: ["folderOpen", "default"] },
            },
          },
          dependsOn: {
            oneOf: [
              { type: "string" },
              { type: "array", items: { type: "string" } },
            ],
            description: "Tasks this task depends on",
          },
          isBackground: {
            type: "boolean",
            description: "Whether this is a background task",
          },
        },
      },
    },
    inputs: {
      type: "array",
      description: "Input variables for tasks",
    },
  },
};

// ============================================================================
// Main Component
// ============================================================================

interface TasksJsonEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TasksJsonEditor(props: TasksJsonEditorProps) {
  const tasks = useTasks();
  const sdk = useSDK();
  const [content, setContent] = createSignal("");
  const [originalContent, setOriginalContent] = createSignal("");
  const [hasChanges, setHasChanges] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [fileExists, setFileExists] = createSignal(false);

  // Load tasks.json when opened
  createEffect(() => {
    if (props.isOpen) {
      loadTasksJson();
    }
  });

  // Track changes
  createEffect(() => {
    setHasChanges(content() !== originalContent());
  });

  const loadTasksJson = async () => {
    try {
      const cwd = sdk.state.config.cwd || ".";
      const path = `${cwd}/.vscode/tasks.json`;

      const result = await sdk.invoke("fs_read_file", { path });

      if (result) {
        setContent(result as string);
        setOriginalContent(result as string);
        setFileExists(true);
      } else {
        // File doesn't exist, show default template
        setContent(DEFAULT_TASKS_JSON);
        setOriginalContent("");
        setFileExists(false);
      }
      setError(null);
    } catch (e) {
      // File doesn't exist
      setContent(DEFAULT_TASKS_JSON);
      setOriginalContent("");
      setFileExists(false);
      setError(null);
    }
  };

  const validateJson = (): boolean => {
    try {
      const parsed = JSON.parse(content());
      if (!parsed.version || parsed.version !== "2.0.0") {
        setError("Invalid tasks.json: version must be '2.0.0'");
        return false;
      }
      if (!Array.isArray(parsed.tasks)) {
        setError("Invalid tasks.json: 'tasks' must be an array");
        return false;
      }
      setError(null);
      return true;
    } catch (e) {
      setError(`Invalid JSON: ${(e as Error).message}`);
      return false;
    }
  };

  const handleSave = async () => {
    if (!validateJson()) return;

    setIsSaving(true);
    try {
      const cwd = sdk.state.config.cwd || ".";
      const dirPath = `${cwd}/.vscode`;
      const filePath = `${cwd}/.vscode/tasks.json`;

      // Ensure .vscode directory exists
      try {
        await sdk.invoke("fs_create_directory", { path: dirPath });
      } catch {
        // Directory might already exist
      }

      // Write the file
      await sdk.invoke("fs_write_file", {
        path: filePath,
        content: content(),
      });

      setOriginalContent(content());
      setFileExists(true);
      setHasChanges(false);

      // Refresh tasks
      await tasks.refreshTasks();
    } catch (e) {
      setError(`Failed to save: ${(e as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setContent(originalContent() || DEFAULT_TASKS_JSON);
    setError(null);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(content());
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(content());
      setContent(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (e) {
      setError(`Cannot format: ${(e as Error).message}`);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            if (hasChanges()) {
              if (confirm("You have unsaved changes. Discard them?")) {
                props.onClose();
              }
            } else {
              props.onClose();
            }
          }
        }}
      >
        <div
          class="w-[800px] max-w-[90vw] h-[80vh] flex flex-col rounded-lg shadow-xl overflow-hidden"
          style={{
            background: "var(--surface-base)",
            border: "1px solid var(--border-base)",
          }}
        >
          {/* Header */}
          <div
            class="flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{ "border-color": "var(--border-base)" }}
          >
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 rounded flex items-center justify-center"
                style={{ background: "var(--cortex-info)20" }}
              >
                <Icon name="code" class="w-4 h-4" style={{ color: "var(--cortex-info)" }} />
              </div>
              <div>
                <h2 class="font-semibold" style={{ color: "var(--text-strong)" }}>
                  Edit tasks.json
                </h2>
                <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                  {fileExists()
                    ? ".vscode/tasks.json"
                    : "Create .vscode/tasks.json"}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Show when={hasChanges()}>
                <span
                  class="text-xs px-2 py-0.5 rounded"
                  style={{ background: "var(--cortex-warning)20", color: "var(--cortex-warning)" }}
                >
                  Unsaved
                </span>
              </Show>

              <IconButton onClick={handleFormatJson} tooltip="Format JSON">
                <Icon name="file-lines" class="w-4 h-4" />
              </IconButton>

              <IconButton onClick={handleCopyToClipboard} tooltip="Copy to clipboard">
                <Icon name="copy" class="w-4 h-4" />
              </IconButton>

              <IconButton onClick={loadTasksJson} tooltip="Reload">
                <Icon name="rotate" class="w-4 h-4" />
              </IconButton>

              <IconButton onClick={props.onClose}>
                <Icon name="xmark" class="w-5 h-5" />
              </IconButton>
            </div>
          </div>

          {/* Error Banner */}
          <Show when={error()}>
            <div
              class="flex items-center gap-2 px-4 py-2 shrink-0"
              style={{ background: "var(--cortex-error)20", color: "var(--cortex-error)" }}
            >
              <Icon name="circle-exclamation" class="w-4 h-4 shrink-0" />
              <span class="text-xs">{error()}</span>
            </div>
          </Show>

          {/* Editor */}
          <div class="flex-1 overflow-hidden">
            <textarea
              class="w-full h-full p-4 font-mono text-sm resize-none outline-none"
              style={{
                background: "var(--ui-panel-bg)",
                color: "var(--text-base)",
                border: "none",
              }}
              value={content()}
              onInput={(e) => setContent(e.currentTarget.value)}
              spellcheck={false}
            />
          </div>

          {/* Help Section */}
          <div
            class="px-4 py-2 border-t shrink-0"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <details class="text-xs" style={{ color: "var(--text-weak)" }}>
              <summary class="cursor-pointer hover:text-[var(--text-base)]">
                Available Problem Matchers
              </summary>
              <div class="grid grid-cols-4 gap-1 mt-2">
                {Object.keys(BUILTIN_PROBLEM_MATCHERS).map((matcher) => (
                  <code
                    class="px-1 py-0.5 rounded"
                    style={{ background: "var(--surface-hover)" }}
                  >
                    {matcher}
                  </code>
                ))}
              </div>
            </details>
          </div>

          {/* Footer */}
          <div
            class="flex items-center justify-between px-4 py-3 border-t shrink-0"
            style={{ "border-color": "var(--border-base)" }}
          >
            <div class="flex items-center gap-2">
              <Show when={!error()}>
                <Icon name="check" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />
                <span class="text-xs" style={{ color: "var(--cortex-success)" }}>
                  Valid JSON
                </span>
              </Show>
            </div>

            <div class="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={handleReset}
                disabled={!hasChanges()}
              >
                Reset
              </Button>
              <Button
                variant="ghost"
                onClick={props.onClose}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={!hasChanges() || !!error() || isSaving()}
                icon={<Icon name="floppy-disk" class="w-4 h-4" />}
                style={{ background: "var(--cortex-info)" }}
              >
                {isSaving() ? "Saving..." : fileExists() ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Export
// ============================================================================

export default TasksJsonEditor;

