import { createSignal, Show, For, createMemo } from "solid-js";
import { Icon } from '../ui/Icon';
import { useSnippets, type Snippet } from "@/context/SnippetsContext";
import { Button, IconButton, Input, Textarea, Text, Badge } from "@/components/ui";

interface SnippetsByLanguage {
  language: string;
  label: string;
  isGlobal: boolean;
  snippets: Snippet[];
}

export function SnippetsPanel() {
  const snippets = useSnippets();
  const [expandedLanguages, setExpandedLanguages] = createSignal<Set<string>>(
    new Set(["global", "typescript", "javascript"])
  );
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedLanguageFilter, setSelectedLanguageFilter] = createSignal<string | null>(null);
  const [showImportModal, setShowImportModal] = createSignal(false);
  const [importContent, setImportContent] = createSignal("");
  const [importLanguage, setImportLanguage] = createSignal("global");
  const [importResult, setImportResult] = createSignal<{ imported: number; errors: string[] } | null>(null);
  const [showExportMenu, setShowExportMenu] = createSignal(false);

  const toggleLanguage = (language: string) => {
    setExpandedLanguages((prev) => {
      const next = new Set(prev);
      if (next.has(language)) {
        next.delete(language);
      } else {
        next.add(language);
      }
      return next;
    });
  };

  const allSnippets = createMemo(() => snippets.getAllSnippets());

  const groupedSnippets = createMemo((): SnippetsByLanguage[] => {
    const all = allSnippets();
    const query = searchQuery().toLowerCase();
    const langFilter = selectedLanguageFilter();

    const groups: Record<string, { isGlobal: boolean; snippets: Snippet[] }> = {};

    for (const item of all) {
      // Apply language filter
      if (langFilter && item.language !== langFilter) continue;

      // Apply search filter
      if (query) {
        const matchesSearch =
          item.snippet.name.toLowerCase().includes(query) ||
          item.snippet.prefix.toLowerCase().includes(query) ||
          item.snippet.description.toLowerCase().includes(query);
        if (!matchesSearch) continue;
      }

      if (!groups[item.language]) {
        groups[item.language] = {
          isGlobal: item.language === "global",
          snippets: [],
        };
      }
      groups[item.language].snippets.push(item.snippet);
    }

    const languageLabels: Record<string, string> = {
      global: "Global",
      typescript: "TypeScript",
      javascript: "JavaScript",
      rust: "Rust",
      python: "Python",
      go: "Go",
      html: "HTML",
      css: "CSS",
      json: "JSON",
      markdown: "Markdown",
      shell: "Shell",
    };

    return Object.entries(groups)
      .map(([language, data]) => ({
        language,
        label: languageLabels[language] || language.charAt(0).toUpperCase() + language.slice(1),
        isGlobal: data.isGlobal,
        snippets: data.snippets.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => {
        // Global first, then alphabetically
        if (a.isGlobal) return -1;
        if (b.isGlobal) return 1;
        return a.label.localeCompare(b.label);
      });
  });

  const availableLanguages = createMemo(() => {
    const langs = new Set<string>();
    for (const item of allSnippets()) {
      langs.add(item.language);
    }
    return Array.from(langs).sort((a, b) => {
      if (a === "global") return -1;
      if (b === "global") return 1;
      return a.localeCompare(b);
    });
  });

  const totalSnippetCount = createMemo(() => {
    return groupedSnippets().reduce((sum, group) => sum + group.snippets.length, 0);
  });

  const handleEditSnippet = (snippet: Snippet, language: string) => {
    snippets.editSnippet(snippet, language);
  };

  const handleDeleteSnippet = async (snippet: Snippet, language: string) => {
    await snippets.deleteSnippet(language, snippet.name);
  };

  const handleCreateSnippet = () => {
    snippets.createNewSnippet(selectedLanguageFilter() || undefined);
  };

  const handleImport = async () => {
    const content = importContent();
    const language = importLanguage();
    
    if (!content.trim()) {
      setImportResult({ imported: 0, errors: ["No content to import"] });
      return;
    }
    
    const result = await snippets.importSnippets(content, language);
    setImportResult(result);
    
    if (result.imported > 0 && result.errors.length === 0) {
      // Close modal after successful import with no errors
      setTimeout(() => {
        setShowImportModal(false);
        setImportContent("");
        setImportResult(null);
      }, 1500);
    }
  };

  const handleExport = (language?: string) => {
    const exported = language 
      ? snippets.exportSnippetsForLanguage(language)
      : snippets.exportSnippets();
    
    // Copy to clipboard
    navigator.clipboard.writeText(exported);
    setShowExportMenu(false);
  };

  const handleExportToFile = (language?: string) => {
    const exported = language 
      ? snippets.exportSnippetsForLanguage(language)
      : snippets.exportSnippets();
    
    // Create blob and download
    const blob = new Blob([exported], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = language ? `${language}-snippets.json` : "all-snippets.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleFileImport = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportContent(content);
    };
    reader.readAsText(file);
    input.value = ""; // Reset input
  };

  const getLanguageIcon = (_language: string, isGlobal: boolean) => {
    if (isGlobal) {
      return <Icon name="globe" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />;
    }
    return <Icon name="folder" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />;
  };

  const formatSnippetPreview = (body: string[]): string => {
    const preview = body.join("\n").slice(0, 100);
    return preview.length < body.join("\n").length ? preview + "..." : preview;
  };

  return (
    <Show when={snippets.state.showPanel}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) snippets.closePanel();
        }}
      >
        <div
          class="w-[700px] max-h-[80vh] flex flex-col rounded-lg shadow-xl overflow-hidden"
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
                  Snippets
                </h2>
                <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                  {totalSnippetCount()} snippets available
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              {/* Import Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowImportModal(true)}
                title="Import Snippets"
              >
                <Icon name="upload" class="w-4 h-4" />
                Import
              </Button>
              
              {/* Export Dropdown */}
              <div class="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowExportMenu(!showExportMenu())}
                  title="Export Snippets"
                >
                  <Icon name="download" class="w-4 h-4" />
                  Export
                </Button>
                <Show when={showExportMenu()}>
                  <div
                    class="absolute right-0 top-full mt-1 w-48 rounded-md shadow-lg z-10"
                    style={{ background: "var(--surface-base)", border: "1px solid var(--border-base)" }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExport()}
                      class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left justify-start"
                    >
                      <Icon name="copy" class="w-4 h-4" />
                      Copy All to Clipboard
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExportToFile()}
                      class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left justify-start"
                    >
                      <Icon name="file" class="w-4 h-4" />
                      Download All as JSON
                    </Button>
                    <Show when={selectedLanguageFilter()}>
                      <div class="border-t" style={{ "border-color": "var(--border-base)" }} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExport(selectedLanguageFilter()!)}
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left justify-start"
                      >
                        <Icon name="copy" class="w-4 h-4" />
                        Copy {selectedLanguageFilter()} to Clipboard
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExportToFile(selectedLanguageFilter()!)}
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left justify-start"
                      >
                        <Icon name="file" class="w-4 h-4" />
                        Download {selectedLanguageFilter()} as JSON
                      </Button>
                    </Show>
                  </div>
                </Show>
              </div>
              
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateSnippet}
              >
                <Icon name="plus" class="w-4 h-4" />
                New Snippet
              </Button>
              <IconButton
                variant="ghost"
                size="sm"
                onClick={() => snippets.closePanel()}
                aria-label="Close panel"
              >
                <Icon name="xmark" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
              </IconButton>
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div
            class="flex items-center gap-3 px-4 py-2 border-b shrink-0"
            style={{ "border-color": "var(--border-base)" }}
          >
            <div class="flex-1 relative">
              <Icon
                name="magnifying-glass"
                class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10"
                style={{ color: "var(--text-weak)" }}
              />
              <Input
                type="text"
                placeholder="Search snippets..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="w-full pl-10"
              />
            </div>

            <select
              value={selectedLanguageFilter() || ""}
              onChange={(e) =>
                setSelectedLanguageFilter(e.currentTarget.value || null)
              }
              class="px-3 py-1.5 rounded text-sm"
              style={{
                background: "var(--surface-hover)",
                color: "var(--text-base)",
                border: "1px solid var(--border-base)",
                outline: "none",
              }}
            >
              <option value="">All Languages</option>
              <For each={availableLanguages()}>
                {(lang) => (
                  <option value={lang}>
                    {lang === "global"
                      ? "Global"
                      : lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </option>
                )}
              </For>
            </select>
          </div>

          {/* Snippets List */}
          <div class="flex-1 overflow-y-auto">
            <Show
              when={groupedSnippets().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center py-12">
                  <div
                    class="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ background: "var(--surface-hover)" }}
                  >
                    <Icon name="code" class="w-8 h-8" style={{ color: "var(--text-weak)" }} />
                  </div>
                  <p class="text-sm font-medium mb-1" style={{ color: "var(--text-strong)" }}>
                    No snippets found
                  </p>
                  <p class="text-xs mb-4" style={{ color: "var(--text-weak)" }}>
                    {searchQuery()
                      ? "Try a different search term"
                      : "Create your first snippet to get started"}
                  </p>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleCreateSnippet}
                  >
                    Create Snippet
                  </Button>
                </div>
              }
            >
              <For each={groupedSnippets()}>
                {(group) => (
                  <div class="border-b" style={{ "border-color": "var(--border-base)" }}>
                    {/* Language Group Header */}
                    <Button
                      variant="ghost"
                      class="w-full flex items-center gap-2 px-4 py-2 text-left justify-start"
                      onClick={() => toggleLanguage(group.language)}
                    >
                      {expandedLanguages().has(group.language) ? (
                        <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                      ) : (
                        <Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                      )}
                      {getLanguageIcon(group.language, group.isGlobal)}
                      <Text size="sm" weight="medium" color="default">
                        {group.label}
                      </Text>
                      <Badge variant="muted" size="sm">
                        {group.snippets.length}
                      </Badge>
                    </Button>

                    {/* Snippets in Group */}
                    <Show when={expandedLanguages().has(group.language)}>
                      <div class="pb-2">
                        <For each={group.snippets}>
                          {(snippet) => (
                            <SnippetItem
                              snippet={snippet}
                              language={group.language}
                              onEdit={() => handleEditSnippet(snippet, group.language)}
                              onDelete={() => handleDeleteSnippet(snippet, group.language)}
                              preview={formatSnippetPreview(snippet.body)}
                            />
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </Show>
          </div>

          {/* Footer */}
          <div
            class="flex items-center justify-between px-4 py-2 border-t shrink-0 text-xs"
            style={{
              "border-color": "var(--border-base)",
              color: "var(--text-weak)",
            }}
          >
            <span>Snippets stored in: {snippets.state.userSnippetsDir || "~/.cortex/snippets/"}</span>
            <span>Type prefix + Tab to expand</span>
          </div>
        </div>
        
        {/* Import Modal */}
        <Show when={showImportModal()}>
          <div
            class="fixed inset-0 z-[60] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowImportModal(false);
                setImportContent("");
                setImportResult(null);
              }
            }}
          >
            <div
              class="w-[550px] max-h-[80vh] flex flex-col rounded-lg shadow-xl overflow-hidden"
              style={{ background: "var(--surface-base)", border: "1px solid var(--border-base)" }}
            >
              {/* Modal Header */}
              <div
                class="flex items-center justify-between px-4 py-3 border-b"
                style={{ "border-color": "var(--border-base)" }}
              >
                <div class="flex items-center gap-3">
                  <Icon name="upload" class="w-5 h-5" style={{ color: "var(--cortex-info)" }} />
                  <h2 class="font-semibold" style={{ color: "var(--text-strong)" }}>
                    Import Snippets
                  </h2>
                </div>
                <IconButton
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportContent("");
                    setImportResult(null);
                  }}
                  aria-label="Close modal"
                >
                  <Icon name="xmark" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
                </IconButton>
              </div>
              
              {/* Modal Content */}
              <div class="flex-1 overflow-y-auto p-4 space-y-4">
                <p class="text-sm" style={{ color: "var(--text-base)" }}>
                  Paste VSCode-compatible snippet JSON or upload a snippet file.
                </p>
                
                {/* Language Selection */}
                <div>
                  <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                    Import to Language
                  </label>
                  <select
                    value={importLanguage()}
                    onChange={(e) => setImportLanguage(e.currentTarget.value)}
                    class="w-full px-3 py-2 rounded text-sm"
                    style={{
                      background: "var(--surface-hover)",
                      color: "var(--text-base)",
                      border: "1px solid var(--border-base)",
                      outline: "none",
                    }}
                  >
                    <option value="global">Global (all languages)</option>
                    <option value="typescript">TypeScript</option>
                    <option value="javascript">JavaScript</option>
                    <option value="rust">Rust</option>
                    <option value="python">Python</option>
                    <option value="go">Go</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                  </select>
                </div>
                
                {/* File Upload */}
                <div>
                  <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                    Upload File
                  </label>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleFileImport}
                    class="w-full text-sm"
                  />
                </div>
                
                {/* JSON Content */}
                <div>
                  <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                    Or Paste JSON
                  </label>
                  <Textarea
                    value={importContent()}
                    onInput={(e) => setImportContent(e.currentTarget.value)}
                    placeholder={`{
  "Snippet Name": {
    "prefix": "prefix",
    "body": ["line 1", "line 2"],
    "description": "Description"
  }
}`}
                    rows={10}
                    class="w-full font-mono resize-none"
                    style={{
                      background: "var(--ui-panel-bg)",
                      color: "var(--cortex-text-primary)",
                    }}
                  />
                </div>
                
                {/* Import Result */}
                <Show when={importResult()}>
                  <div
                    class="p-3 rounded text-sm"
                    style={{
                      background: importResult()!.errors.length > 0 ? "var(--cortex-error)20" : "var(--cortex-success)20",
                      color: importResult()!.errors.length > 0 ? "var(--cortex-error)" : "var(--cortex-success)",
                    }}
                  >
                    <p class="font-medium">
                      {importResult()!.imported > 0 
                        ? `Successfully imported ${importResult()!.imported} snippet(s)`
                        : "No snippets imported"}
                    </p>
                    <Show when={importResult()!.errors.length > 0}>
                      <ul class="mt-2 text-xs list-disc list-inside">
                        <For each={importResult()!.errors}>
                          {(error) => <li>{error}</li>}
                        </For>
                      </ul>
                    </Show>
                  </div>
                </Show>
              </div>
              
              {/* Modal Footer */}
              <div
                class="flex items-center justify-end gap-3 px-4 py-3 border-t"
                style={{ "border-color": "var(--border-base)" }}
              >
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportContent("");
                    setImportResult(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleImport}
                >
                  <Icon name="upload" class="w-4 h-4" />
                  Import Snippets
                </Button>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}

// ============================================================================
// Snippet Item Component
// ============================================================================

interface SnippetItemProps {
  snippet: Snippet;
  language: string;
  onEdit: () => void;
  onDelete: () => void;
  preview: string;
}

function SnippetItem(props: SnippetItemProps) {
  const [showPreview, setShowPreview] = createSignal(false);

  return (
    <div
      class="mx-2 mb-1 rounded hover:bg-[var(--surface-hover)] group"
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => setShowPreview(false)}
    >
      <div class="flex items-start gap-3 px-3 py-2">
        {/* Prefix Badge */}
        <div
          class="shrink-0 px-2 py-0.5 rounded text-xs font-mono"
          style={{
            background: "var(--cortex-info)20",
            color: "var(--cortex-info)",
          }}
        >
          {props.snippet.prefix}
        </div>

        {/* Snippet Info */}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium truncate" style={{ color: "var(--text-strong)" }}>
              {props.snippet.name}
            </span>
          </div>
          <Show when={props.snippet.description}>
            <p class="text-xs truncate mt-0.5" style={{ color: "var(--text-weak)" }}>
              {props.snippet.description}
            </p>
          </Show>
        </div>

        {/* Actions */}
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <IconButton
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              props.onEdit();
            }}
            title="Edit snippet"
            aria-label="Edit snippet"
          >
            <Icon name="pen" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
          </IconButton>
          <IconButton
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              props.onDelete();
            }}
            title="Delete snippet"
            aria-label="Delete snippet"
            class="hover:bg-red-500/20"
          >
            <Icon name="trash" class="w-3.5 h-3.5 text-red-400" />
          </IconButton>
        </div>
      </div>

      {/* Preview on hover */}
      <Show when={showPreview()}>
        <div
          class="mx-3 mb-2 p-2 rounded text-xs font-mono overflow-x-auto"
          style={{
            background: "var(--ui-panel-bg)",
            color: "var(--cortex-text-primary)",
            border: "1px solid var(--border-base)",
            "white-space": "pre-wrap",
            "max-height": "120px",
          }}
        >
          {props.preview}
        </div>
      </Show>
    </div>
  );
}

