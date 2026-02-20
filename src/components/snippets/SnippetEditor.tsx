import { createSignal, Show, For, createEffect } from "solid-js";
import { Icon } from '../ui/Icon';
import { useSnippets, type Snippet } from "@/context/SnippetsContext";

const AVAILABLE_LANGUAGES = [
  { value: "global", label: "Global (all languages)" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "rust", label: "Rust" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "shell", label: "Shell/Bash" },
  { value: "sql", label: "SQL" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
];

interface ValidationError {
  field: string;
  message: string;
}

export function SnippetEditor() {
  const snippets = useSnippets();
  const editing = () => snippets.state.editingSnippet;

  // Form state
  const [name, setName] = createSignal("");
  const [prefix, setPrefix] = createSignal("");
  const [body, setBody] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [language, setLanguage] = createSignal("global");
  const [errors, setErrors] = createSignal<ValidationError[]>([]);
  const [previewText, setPreviewText] = createSignal("");
  const [showHelp, setShowHelp] = createSignal(false);

  // Initialize form when editing snippet changes
  createEffect(() => {
    const edit = editing();
    if (edit) {
      setName(edit.snippet.name);
      setPrefix(edit.snippet.prefix);
      setBody(edit.snippet.body.join("\n"));
      setDescription(edit.snippet.description);
      setLanguage(edit.language);
      setErrors([]);
      updatePreview(edit.snippet.body.join("\n"));
    }
  });

  const isNewSnippet = () => {
    const edit = editing();
    return edit?.snippet.name === "";
  };

  const updatePreview = (bodyText: string) => {
    const parsed = snippets.parseSnippet(bodyText);
    setPreviewText(parsed.text);
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    updatePreview(value);
  };

  const validate = (): ValidationError[] => {
    const validationErrors: ValidationError[] = [];

    if (!name().trim()) {
      validationErrors.push({ field: "name", message: "Name is required" });
    }

    if (!prefix().trim()) {
      validationErrors.push({ field: "prefix", message: "Prefix is required" });
    } else if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(prefix().trim())) {
      validationErrors.push({
        field: "prefix",
        message: "Prefix must start with a letter and contain only letters, numbers, hyphens, or underscores",
      });
    }

    if (!body().trim()) {
      validationErrors.push({ field: "body", message: "Body is required" });
    }

    // Check for duplicate prefix in same language
    const existingSnippets = snippets.getSnippetsForLanguage(language());
    const existingWithPrefix = existingSnippets.find(
      (s) => s.prefix === prefix().trim() && s.name !== editing()?.snippet.name
    );
    if (existingWithPrefix) {
      validationErrors.push({
        field: "prefix",
        message: `Prefix "${prefix()}" already exists for ${language()}`,
      });
    }

    return validationErrors;
  };

  const handleSave = async () => {
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const snippet: Snippet = {
      name: name().trim(),
      prefix: prefix().trim(),
      body: body().split("\n"),
      description: description().trim(),
      scope: language() === "global" ? undefined : language(),
    };

    try {
      if (isNewSnippet()) {
        await snippets.addSnippet(language(), snippet);
      } else {
        await snippets.updateSnippet(language(), editing()!.snippet.name, snippet);
      }
      snippets.closeEditor();
    } catch (e) {
      setErrors([{ field: "general", message: String(e) }]);
    }
  };

  const getFieldError = (field: string): string | undefined => {
    return errors().find((e) => e.field === field)?.message;
  };

  return (
    <Show when={editing()}>
      <div
        class="fixed inset-0 z-[60] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) snippets.closeEditor();
        }}
      >
        <div
          class="w-[650px] max-h-[90vh] flex flex-col rounded-lg shadow-xl overflow-hidden"
          style={{ background: "var(--surface-base)", border: "1px solid var(--border-base)" }}
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
                  {isNewSnippet() ? "Create Snippet" : "Edit Snippet"}
                </h2>
                <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                  {isNewSnippet()
                    ? "Define a new code snippet"
                    : `Editing: ${editing()?.snippet.name}`}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                onClick={() => setShowHelp(!showHelp())}
                class="p-2 rounded hover:bg-[var(--surface-hover)]"
                title="Help"
              >
                <Icon name="circle-info" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
              </button>
              <button
                onClick={() => snippets.closeEditor()}
                class="p-2 rounded hover:bg-[var(--surface-hover)]"
              >
                <Icon name="xmark" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
              </button>
            </div>
          </div>

          {/* Help Section */}
          <Show when={showHelp()}>
            <div
              class="px-4 py-3 border-b text-xs"
              style={{
                "border-color": "var(--border-base)",
                background: "var(--cortex-info)10",
                color: "var(--text-base)",
              }}
            >
              <div class="font-semibold mb-2" style={{ color: "var(--text-strong)" }}>
                Snippet Placeholder Syntax
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <code class="text-[11px] px-1 rounded" style={{ background: "var(--ui-panel-bg)", color: "var(--cortex-text-primary)" }}>
                    $1, $2, $3...
                  </code>
                  <span class="ml-2">Tab stops (navigation order)</span>
                </div>
                <div>
                  <code class="text-[11px] px-1 rounded" style={{ background: "var(--ui-panel-bg)", color: "var(--cortex-text-primary)" }}>
                    $0
                  </code>
                  <span class="ml-2">Final cursor position</span>
                </div>
                <div>
                  <code class="text-[11px] px-1 rounded" style={{ background: "var(--ui-panel-bg)", color: "var(--cortex-text-primary)" }}>
                    {"${1:default}"}
                  </code>
                  <span class="ml-2">Tab stop with default value</span>
                </div>
                <div>
                  <code class="text-[11px] px-1 rounded" style={{ background: "var(--ui-panel-bg)", color: "var(--cortex-text-primary)" }}>
                    {"${1|one,two|}"}
                  </code>
                  <span class="ml-2">Tab stop with choices</span>
                </div>
                <div>
                  <code class="text-[11px] px-1 rounded" style={{ background: "var(--ui-panel-bg)", color: "var(--cortex-text-primary)" }}>
                    \$, \\, \{"\}"}
                  </code>
                  <span class="ml-2">Escape special chars</span>
                </div>
                <div>
                  <code class="text-[11px] px-1 rounded" style={{ background: "var(--ui-panel-bg)", color: "var(--cortex-text-primary)" }}>
                    \t
                  </code>
                  <span class="ml-2">Tab character (indent)</span>
                </div>
              </div>
            </div>
          </Show>

          {/* Form Content */}
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            {/* General Error */}
            <Show when={getFieldError("general")}>
              <div
                class="flex items-center gap-2 p-3 rounded text-sm"
                style={{ background: "var(--cortex-error)20", color: "var(--cortex-error)" }}
              >
                <Icon name="circle-exclamation" class="w-4 h-4 shrink-0" />
                {getFieldError("general")}
              </div>
            </Show>

            {/* Language */}
            <div>
              <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                Language / Scope
              </label>
              <select
                value={language()}
                onChange={(e) => setLanguage(e.currentTarget.value)}
                class="w-full px-3 py-2 rounded text-sm"
                style={{
                  background: "var(--surface-hover)",
                  color: "var(--text-base)",
                  border: "1px solid var(--border-base)",
                  outline: "none",
                }}
              >
                <For each={AVAILABLE_LANGUAGES}>
                  {(lang) => <option value={lang.value}>{lang.label}</option>}
                </For>
              </select>
              <p class="text-xs mt-1" style={{ color: "var(--text-weak)" }}>
                Choose which language this snippet applies to
              </p>
            </div>

            {/* Name */}
            <div>
              <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                Name *
              </label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="e.g., React Functional Component"
                class="w-full px-3 py-2 rounded text-sm"
                style={{
                  background: "var(--surface-hover)",
                  color: "var(--text-base)",
                  border: getFieldError("name")
                    ? "1px solid var(--cortex-error)"
                    : "1px solid var(--border-base)",
                  outline: "none",
                }}
              />
              <Show when={getFieldError("name")}>
                <p class="text-xs mt-1 text-red-400">{getFieldError("name")}</p>
              </Show>
            </div>

            {/* Prefix */}
            <div>
              <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                Prefix (Trigger) *
              </label>
              <input
                type="text"
                value={prefix()}
                onInput={(e) => setPrefix(e.currentTarget.value)}
                placeholder="e.g., rfc"
                class="w-full px-3 py-2 rounded text-sm font-mono"
                style={{
                  background: "var(--surface-hover)",
                  color: "var(--text-base)",
                  border: getFieldError("prefix")
                    ? "1px solid var(--cortex-error)"
                    : "1px solid var(--border-base)",
                  outline: "none",
                }}
              />
              <Show when={getFieldError("prefix")}>
                <p class="text-xs mt-1 text-red-400">{getFieldError("prefix")}</p>
              </Show>
              <p class="text-xs mt-1" style={{ color: "var(--text-weak)" }}>
                Type this prefix + Tab to expand the snippet
              </p>
            </div>

            {/* Description */}
            <div>
              <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                Description
              </label>
              <input
                type="text"
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                placeholder="e.g., Create a React functional component with TypeScript"
                class="w-full px-3 py-2 rounded text-sm"
                style={{
                  background: "var(--surface-hover)",
                  color: "var(--text-base)",
                  border: "1px solid var(--border-base)",
                  outline: "none",
                }}
              />
            </div>

            {/* Body */}
            <div>
              <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                Body *
              </label>
              <textarea
                value={body()}
                onInput={(e) => handleBodyChange(e.currentTarget.value)}
                placeholder={`Enter snippet body here...

Example:
function \${1:name}(\${2:params}) {
\t$0
}`}
                rows={10}
                class="w-full px-3 py-2 rounded text-sm font-mono resize-none"
                style={{
                  background: "var(--ui-panel-bg)",
                  color: "var(--cortex-text-primary)",
                  border: getFieldError("body")
                    ? "1px solid var(--cortex-error)"
                    : "1px solid var(--border-base)",
                  outline: "none",
                  "line-height": "1.5",
                }}
              />
              <Show when={getFieldError("body")}>
                <p class="text-xs mt-1 text-red-400">{getFieldError("body")}</p>
              </Show>
            </div>

            {/* Preview */}
            <div>
              <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                Preview (expanded)
              </label>
              <div
                class="w-full px-3 py-2 rounded text-sm font-mono overflow-x-auto"
                style={{
                  background: "var(--ui-panel-bg)",
                  color: "var(--cortex-syntax-variable)",
                  border: "1px solid var(--border-base)",
                  "white-space": "pre-wrap",
                  "min-height": "60px",
                  "max-height": "200px",
                  "line-height": "1.5",
                }}
              >
                {previewText() || "Preview will appear here..."}
              </div>
              <p class="text-xs mt-1" style={{ color: "var(--text-weak)" }}>
                Placeholders are shown with their default values
              </p>
            </div>
          </div>

          {/* Footer */}
          <div
            class="flex items-center justify-end gap-3 px-4 py-3 border-t shrink-0"
            style={{ "border-color": "var(--border-base)" }}
          >
            <button
              onClick={() => snippets.closeEditor()}
              class="px-4 py-2 rounded text-sm font-medium"
              style={{
                background: "var(--surface-hover)",
                color: "var(--text-base)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              class="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
              style={{ background: "var(--cortex-info)", color: "white" }}
            >
              <Icon name="floppy-disk" class="w-4 h-4" />
              {isNewSnippet() ? "Create Snippet" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

