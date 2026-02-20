import { createSignal, For, Show } from "solid-js";
import { Icon } from "./ui/Icon";
import {
  Button,
  IconButton,
  Input,
  Textarea,
  Card,
  ListItem,
  SidebarHeader,
  SidebarSection,
  SidebarContent,
  Badge,
  StatusDot,
  ProgressBar,
  Text,
  LoadingSpinner,
} from "@/components/ui";
import { ui, mergeStyles } from "@/lib/ui-kit";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Types
// ============================================================================

type IndexStatus = "not-indexed" | "indexing" | "indexed" | "outdated" | "error";
type ViewMode = "main" | "settings" | "ask-result" | "doc-feature" | "doc-folder";

interface ProjectContext {
  status: IndexStatus;
  lastIndexed: Date | null;
  filesCount: number;
  progress: number;
  currentTask: string;
}

interface DocFile {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: DocFile[];
  expanded?: boolean;
}

interface CodeMapSettings {
  autoIndex: boolean;
  autoIndexTrigger: "save" | "commit" | "manual";
  updateScope: "changed" | "full";
  includePatterns: string;
  excludePatterns: string;
  detailLevel: "brief" | "standard" | "detailed";
  language: string;
}

interface RecentQuery {
  id: string;
  query: string;
  timestamp: Date;
}

// ============================================================================
// Status Helpers
// ============================================================================

const getStatusDotStatus = (status: IndexStatus): "idle" | "active" | "success" | "warning" | "error" => {
  switch (status) {
    case "indexed": return "success";
    case "indexing": return "active";
    case "outdated": return "warning";
    case "error": return "error";
    default: return "idle";
  }
};

const getStatusText = (status: IndexStatus): string => {
  switch (status) {
    case "indexed": return "Indexed";
    case "indexing": return "Indexing...";
    case "outdated": return "Outdated";
    case "error": return "Error";
    default: return "Not indexed";
  }
};

const formatTimeAgo = (date: Date | null): string => {
  if (!date) return "Never";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

// ============================================================================
// Component
// ============================================================================

export function CodemapsSidebar() {
  // State
  const [view, setView] = createSignal<ViewMode>("main");
  const [context, setContext] = createSignal<ProjectContext>({
    status: "not-indexed",
    lastIndexed: null,
    filesCount: 0,
    progress: 0,
    currentTask: "",
  });
  
  const [settings, setSettings] = createSignal<CodeMapSettings>({
    autoIndex: false,
    autoIndexTrigger: "commit",
    updateScope: "changed",
    includePatterns: "src/**, lib/**, *.config.*",
    excludePatterns: "node_modules, dist, .git, build",
    detailLevel: "standard",
    language: "en",
  });

  const [query, setQuery] = createSignal("");
  const [isAsking, setIsAsking] = createSignal(false);
  const [askResult, setAskResult] = createSignal<string | null>(null);
  
  const [featureName, setFeatureName] = createSignal("");
  const [featureDescription, setFeatureDescription] = createSignal("");
  const [featureEntryPoint, setFeatureEntryPoint] = createSignal("");
  
  const [selectedFolder, setSelectedFolder] = createSignal("");
  
  const [recentQueries, setRecentQueries] = createSignal<RecentQuery[]>([
    { id: "1", query: "How does authentication work?", timestamp: new Date(Date.now() - 3600000) },
    { id: "2", query: "Explain the state management", timestamp: new Date(Date.now() - 7200000) },
  ]);

  const [docFiles, setDocFiles] = createSignal<DocFile[]>([
    { name: "CONTEXT.md", path: ".codemap/CONTEXT.md", type: "file" },
    { name: "ARCHITECTURE.md", path: ".codemap/ARCHITECTURE.md", type: "file" },
    { name: "STACK.md", path: ".codemap/STACK.md", type: "file" },
    { name: "CONVENTIONS.md", path: ".codemap/CONVENTIONS.md", type: "file" },
    { name: "features", path: ".codemap/features", type: "folder", expanded: false, children: [
      { name: "authentication.md", path: ".codemap/features/authentication.md", type: "file" },
      { name: "api-integration.md", path: ".codemap/features/api-integration.md", type: "file" },
    ]},
    { name: "folders", path: ".codemap/folders", type: "folder", expanded: false, children: [
      { name: "src-components.md", path: ".codemap/folders/src-components.md", type: "file" },
      { name: "src-utils.md", path: ".codemap/folders/src-utils.md", type: "file" },
    ]},
  ]);

  const suggestedQuestions = [
    "Explain the project architecture",
    "How to add a new component?",
    "What's the folder structure?",
    "How does routing work?",
  ];

  const quickFolders = [
    "/src",
    "/src/components", 
    "/src/utils",
    "/src/hooks",
    "/src/context",
  ];

  // Actions
  const initializeIndex = () => {
    setContext(c => ({ ...c, status: "indexing", progress: 0, currentTask: "Scanning files..." }));
    
    const tasks = [
      "Scanning files...",
      "Analyzing structure...",
      "Generating CONTEXT.md...",
      "Generating ARCHITECTURE.md...",
      "Analyzing features...",
      "Generating folder docs...",
      "Finalizing...",
    ];
    
    let taskIndex = 0;
    const interval = setInterval(() => {
      setContext(c => {
        const newProgress = c.progress + 2;
        if (newProgress >= 100) {
          clearInterval(interval);
          return { 
            ...c, 
            status: "indexed", 
            progress: 100, 
            currentTask: "",
            lastIndexed: new Date(),
            filesCount: 245,
          };
        }
        if (newProgress > (taskIndex + 1) * (100 / tasks.length)) {
          taskIndex = Math.min(taskIndex + 1, tasks.length - 1);
        }
        return { ...c, progress: newProgress, currentTask: tasks[taskIndex] };
      });
    }, 50);
  };

  const reIndex = () => {
    setContext(c => ({ ...c, status: "indexing", progress: 0, currentTask: "Updating documentation..." }));
    
    const interval = setInterval(() => {
      setContext(c => {
        const newProgress = c.progress + 5;
        if (newProgress >= 100) {
          clearInterval(interval);
          return { ...c, status: "indexed", progress: 100, currentTask: "", lastIndexed: new Date() };
        }
        return { ...c, progress: newProgress };
      });
    }, 50);
  };

  const askQuestion = () => {
    if (!query().trim()) return;
    
    setIsAsking(true);
    setRecentQueries(q => [{ id: Date.now().toString(), query: query(), timestamp: new Date() }, ...q.slice(0, 9)]);
    
    setTimeout(() => {
      setAskResult(`## ${query()}

Based on the project analysis:

**Summary:**
This functionality is primarily handled in the following files:
- \`src/auth/AuthProvider.tsx\` - Main authentication context
- \`src/hooks/useAuth.ts\` - Authentication hook
- \`src/utils/jwt.ts\` - JWT token handling

**Key Points:**
1. Authentication uses JWT tokens stored in localStorage
2. Session management is handled via React Context
3. Protected routes use the \`PrivateRoute\` component

**Related Files:**
\`\`\`
src/auth/
├── AuthProvider.tsx
├── AuthContext.ts
├── PrivateRoute.tsx
└── types.ts
\`\`\`

**See Also:**
- \`.codemap/features/authentication.md\` for detailed documentation`);
      setIsAsking(false);
      setView("ask-result");
    }, 1500);
  };

  const documentFeature = () => {
    if (!featureName().trim()) return;
    
    setContext(c => ({ ...c, status: "indexing", currentTask: `Documenting ${featureName()}...` }));
    
    setTimeout(() => {
      setContext(c => ({ ...c, status: "indexed", currentTask: "" }));
      setDocFiles(files => {
        const features = files.find(f => f.name === "features");
        if (features && features.children) {
          features.children = [...features.children, {
            name: `${featureName().toLowerCase().replace(/\s+/g, "-")}.md`,
            path: `.codemap/features/${featureName().toLowerCase().replace(/\s+/g, "-")}.md`,
            type: "file",
          }];
        }
        return [...files];
      });
      setFeatureName("");
      setFeatureDescription("");
      setFeatureEntryPoint("");
      setView("main");
    }, 2000);
  };

  const documentFolder = () => {
    if (!selectedFolder().trim()) return;
    
    setContext(c => ({ ...c, status: "indexing", currentTask: `Documenting ${selectedFolder()}...` }));
    
    setTimeout(() => {
      setContext(c => ({ ...c, status: "indexed", currentTask: "" }));
      setSelectedFolder("");
      setView("main");
    }, 1500);
  };

  const toggleFolder = (path: string) => {
    setDocFiles(files => files.map(f => {
      if (f.path === path) return { ...f, expanded: !f.expanded };
      return f;
    }));
  };

  const openDocFile = (path: string) => {
    window.dispatchEvent(new CustomEvent("open-file", { detail: { path } }));
  };

  const updateSetting = <K extends keyof CodeMapSettings>(key: K, value: CodeMapSettings[K]) => {
    setSettings(s => ({ ...s, [key]: value }));
  };

  // ============================================================================
  // Render: Main View
  // ============================================================================
  const renderMainView = () => (
    <>
      <SidebarHeader 
        title="CodeMap"
        actions={
          <IconButton tooltip="Settings" onClick={() => setView("settings")}>
            <Icon name="gear" />
          </IconButton>
        }
      />

      <SidebarContent>
        {/* Project Status Card - Not Indexed */}
        <Show when={context().status === "not-indexed"}>
          <SidebarSection>
            <Card>
              <div style={mergeStyles(ui.row, { "align-items": "flex-start" })}>
                <Icon name="book" style={mergeStyles(ui.icon, { width: "24px", height: "24px", "margin-top": "2px" })} />
                <div style={mergeStyles(ui.column, ui.flex1, ui.gapSm)}>
                  <Text weight="medium">Welcome to CodeMap</Text>
                  <Text variant="muted" style={{ "line-height": "1.5" }}>
                    Generate context files to help AI agents understand your codebase instantly.
                  </Text>
                  <div style={mergeStyles(ui.row, { "margin-top": "4px" })}>
                    <Badge>~245 files detected</Badge>
                    <Text variant="muted">·</Text>
                    <Text variant="muted">Est. time: ~2 min</Text>
                  </div>
                  <Button 
                    variant="primary" 
                    icon={<Icon name="bolt" size={14} />}
                    onClick={initializeIndex}
                    style={{ "margin-top": "8px" }}
                  >
                    Initialize CodeMap
                  </Button>
                </div>
              </div>
            </Card>
          </SidebarSection>
        </Show>

        {/* Project Status Card - Indexing */}
        <Show when={context().status === "indexing"}>
          <SidebarSection>
            <Card>
              <div style={mergeStyles(ui.row, { "margin-bottom": "12px" })}>
                <LoadingSpinner size="sm" />
                <Text weight="medium">Indexing Project...</Text>
              </div>
              <ProgressBar value={context().progress} />
              <div style={mergeStyles(ui.spaceBetween, { "margin-top": "8px" })}>
                <Text variant="muted" size="sm">{context().currentTask}</Text>
                <Text variant="muted" size="sm">{context().progress}%</Text>
              </div>
            </Card>
          </SidebarSection>
        </Show>

        {/* Project Status Card - Indexed */}
        <Show when={context().status === "indexed" || context().status === "outdated"}>
          <SidebarSection>
            <Card variant="outlined">
              <div style={mergeStyles(ui.row, { "margin-bottom": "10px" })}>
                <StatusDot status={getStatusDotStatus(context().status)} size="md" />
                <Text weight="medium" style={ui.flex1}>{getStatusText(context().status)}</Text>
                <Text variant="muted" size="sm">{formatTimeAgo(context().lastIndexed)}</Text>
              </div>
              <Text variant="muted" size="sm" style={{ "margin-bottom": "12px" }}>
                {context().filesCount} files indexed
              </Text>
              <div style={mergeStyles(ui.row, ui.gapMd)}>
                <Button 
                  variant="secondary"
                  icon={<Icon name="rotate" size={12} />}
                  onClick={reIndex}
                  style={ui.flex1}
                >
                  Re-index
                </Button>
                <Button 
                  variant="secondary"
                  icon={<Icon name="file-lines" size={12} />}
                  onClick={() => openDocFile(".codemap/CONTEXT.md")}
                  style={ui.flex1}
                >
                  View Docs
                </Button>
              </div>
            </Card>
          </SidebarSection>
        </Show>

        {/* Ask Section */}
        <Show when={context().status === "indexed" || context().status === "outdated"}>
          <SidebarSection title="Ask about this project">
            <div style={{ position: "relative" }}>
              <Input
                placeholder="How does X work?"
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && askQuestion()}
                iconRight={
                  <IconButton 
                    size="sm" 
                    onClick={askQuestion}
                    disabled={isAsking()}
                  >
                    <Show when={isAsking()} fallback={<Icon name="paper-plane" />}>
                      <LoadingSpinner size="sm" />
                    </Show>
                  </IconButton>
                }
              />
            </div>
            
            <div style={{ "margin-top": "8px" }}>
              <For each={suggestedQuestions.slice(0, 3)}>
                {(q) => (
                  <ListItem
                    icon={<Text variant="muted">·</Text>}
                    label={q}
                    onClick={() => { setQuery(q); askQuestion(); }}
                    style={{ height: "auto", padding: "4px 8px" }}
                  />
                )}
              </For>
            </div>
          </SidebarSection>
        </Show>

        {/* Quick Actions */}
        <Show when={context().status === "indexed" || context().status === "outdated"}>
          <SidebarSection title="Quick Actions">
            <ListItem
              icon={<Icon name="plus" style={ui.icon} />}
              label="Document a feature"
              onClick={() => setView("doc-feature")}
            />
            <ListItem
              icon={<Icon name="plus" style={ui.icon} />}
              label="Document a folder"
              onClick={() => setView("doc-folder")}
            />
            <ListItem
              icon={<Icon name="pen" style={ui.icon} />}
              label="Edit CONTEXT.md"
              onClick={() => openDocFile(".codemap/CONTEXT.md")}
            />
          </SidebarSection>
        </Show>

        {/* Documentation Files */}
        <Show when={context().status === "indexed" || context().status === "outdated"}>
          <SidebarSection title="Documentation Files">
            <For each={docFiles()}>
              {(file) => (
                <Show when={file.type === "folder"} fallback={
                  <ListItem
                    icon={<Icon name="file-lines" style={ui.icon} />}
                    label={file.name}
                    iconRight={<Icon name="arrow-up-right-from-square" style={mergeStyles(ui.icon, { opacity: "0.5" })} />}
                    onClick={() => openDocFile(file.path)}
                  />
                }>
                  <div>
                    <ListItem
                      icon={file.expanded 
                        ? <Icon name="chevron-down" style={ui.icon} /> 
                        : <Icon name="chevron-right" style={ui.icon} />
                      }
                      label={`${file.name}/`}
                      badge={file.children?.length || 0}
                      onClick={() => toggleFolder(file.path)}
                    />
                    <Show when={file.expanded && file.children}>
                      <For each={file.children}>
                        {(child) => (
                          <ListItem
                            icon={<Icon name="file-lines" style={ui.icon} />}
                            label={child.name}
                            onClick={() => openDocFile(child.path)}
                            style={{ "padding-left": "32px" }}
                          />
                        )}
                      </For>
                    </Show>
                  </div>
                </Show>
              )}
            </For>
          </SidebarSection>
        </Show>

        {/* Recent Queries */}
        <Show when={recentQueries().length > 0 && (context().status === "indexed" || context().status === "outdated")}>
          <SidebarSection title="Recent Queries">
            <For each={recentQueries().slice(0, 5)}>
              {(item) => (
                <ListItem
                  icon={<Icon name="clock" style={ui.icon} />}
                  label={item.query}
                  onClick={() => { setQuery(item.query); askQuestion(); }}
                  style={{ height: "auto" }}
                />
              )}
            </For>
          </SidebarSection>
        </Show>
      </SidebarContent>
    </>
  );

  // ============================================================================
  // Render: Settings View
  // ============================================================================
  const renderSettingsView = () => (
    <>
      <SidebarHeader 
        title="Settings"
        actions={
          <IconButton tooltip="Back" onClick={() => setView("main")}>
            <Icon name="chevron-left" />
          </IconButton>
        }
        style={{ "flex-direction": "row-reverse" }}
      />

      <SidebarContent>
        {/* Auto-Indexing */}
        <SidebarSection title="Auto-Indexing">
          <Card>
            <label style={mergeStyles(ui.row, { cursor: "pointer", "margin-bottom": "12px" })}>
              <input
                type="checkbox"
                checked={settings().autoIndex}
                onChange={(e) => updateSetting("autoIndex", e.currentTarget.checked)}
                style={{ width: "14px", height: "14px" }}
              />
              <Text>Enable auto-indexing</Text>
            </label>

            <Show when={settings().autoIndex}>
              <div style={{ "margin-bottom": "12px" }}>
                <Text variant="muted" size="sm" style={{ "margin-bottom": "6px" }}>Trigger:</Text>
                <For each={[
                  { value: "save", label: "On file save" },
                  { value: "commit", label: "On git commit" },
                  { value: "manual", label: "Manual only" },
                ] as const}>
                  {(option) => (
                    <label style={mergeStyles(ui.row, { cursor: "pointer", padding: "4px 0" })}>
                      <input
                        type="radio"
                        name="trigger"
                        checked={settings().autoIndexTrigger === option.value}
                        onChange={() => updateSetting("autoIndexTrigger", option.value)}
                      />
                      <Text variant="muted">{option.label}</Text>
                    </label>
                  )}
                </For>
              </div>

              <div>
                <Text variant="muted" size="sm" style={{ "margin-bottom": "6px" }}>Update scope:</Text>
                <For each={[
                  { value: "changed", label: "Changed files only" },
                  { value: "full", label: "Full re-index" },
                ] as const}>
                  {(option) => (
                    <label style={mergeStyles(ui.row, { cursor: "pointer", padding: "4px 0" })}>
                      <input
                        type="radio"
                        name="scope"
                        checked={settings().updateScope === option.value}
                        onChange={() => updateSetting("updateScope", option.value)}
                      />
                      <Text variant="muted">{option.label}</Text>
                    </label>
                  )}
                </For>
              </div>
            </Show>
          </Card>
        </SidebarSection>

        {/* Include/Exclude */}
        <SidebarSection title="Include / Exclude">
          <Card>
            <div style={{ "margin-bottom": "12px" }}>
              <Input
                label="Include patterns:"
                value={settings().includePatterns}
                onChange={(e) => updateSetting("includePatterns", e.currentTarget.value)}
                placeholder="src/**, lib/**"
              />
            </div>
            <div>
              <Input
                label="Exclude patterns:"
                value={settings().excludePatterns}
                onChange={(e) => updateSetting("excludePatterns", e.currentTarget.value)}
                placeholder="node_modules, dist"
              />
            </div>
          </Card>
        </SidebarSection>

        {/* Documentation Style */}
        <SidebarSection title="Documentation Style">
          <Card>
            <div style={{ "margin-bottom": "12px" }}>
              <Text variant="muted" size="sm" style={{ "margin-bottom": "6px" }}>Detail level:</Text>
              <For each={[
                { value: "brief", label: "Brief (faster, less tokens)" },
                { value: "standard", label: "Standard" },
                { value: "detailed", label: "Detailed (comprehensive)" },
              ] as const}>
                {(option) => (
                  <label style={mergeStyles(ui.row, { cursor: "pointer", padding: "4px 0" })}>
                    <input
                      type="radio"
                      name="detail"
                      checked={settings().detailLevel === option.value}
                      onChange={() => updateSetting("detailLevel", option.value)}
                    />
                    <Text variant="muted">{option.label}</Text>
                  </label>
                )}
              </For>
            </div>

            <div>
              <Text variant="muted" size="sm" style={{ "margin-bottom": "4px" }}>Language:</Text>
              <select
                value={settings().language}
                onChange={(e) => updateSetting("language", e.currentTarget.value)}
                style={{
                  width: "100%",
                  height: "var(--jb-input-height)",
                  padding: "var(--jb-input-padding)",
                  background: "var(--jb-input-bg)",
                  border: "var(--jb-input-border)",
                  "border-radius": "var(--jb-input-radius)",
                  color: "var(--jb-input-color)",
                  "font-family": "var(--jb-font-ui)",
                  "font-size": "var(--jb-text-body-size)",
                  outline: "none",
                }}
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
                <option value="de">Deutsch</option>
              </select>
            </div>
          </Card>
        </SidebarSection>

        {/* Danger Zone */}
        <SidebarSection title="Danger Zone">
          <ListItem
            icon={<Icon name="trash" style={mergeStyles(ui.icon, { color: tokens.colors.semantic.error })} />}
            label="Delete all documentation"
            onClick={() => {
              setContext({ status: "not-indexed", lastIndexed: null, filesCount: 0, progress: 0, currentTask: "" });
              setView("main");
            }}
            style={{ color: tokens.colors.semantic.error }}
          />
        </SidebarSection>
      </SidebarContent>
    </>
  );

  // ============================================================================
  // Render: Ask Result View
  // ============================================================================
  const renderAskResultView = () => (
    <>
      <SidebarHeader 
        title="Result"
        actions={
          <IconButton tooltip="Back" onClick={() => { setView("main"); setAskResult(null); setQuery(""); }}>
            <Icon name="chevron-left" />
          </IconButton>
        }
        style={{ "flex-direction": "row-reverse" }}
      />

      <SidebarContent>
        <SidebarSection>
          <Card style={{ "margin-bottom": "12px" }}>
            <Text variant="muted" size="sm" style={{ "margin-bottom": "4px" }}>Query:</Text>
            <Text weight="medium">{query()}</Text>
          </Card>

          <Text 
            as="div" 
            style={{ 
              "line-height": "1.6",
              "white-space": "pre-wrap",
            }}
          >
            {askResult()}
          </Text>
        </SidebarSection>
      </SidebarContent>
    </>
  );

  // ============================================================================
  // Render: Document Feature View
  // ============================================================================
  const renderDocFeatureView = () => (
    <>
      <SidebarHeader 
        title="Document Feature"
        actions={
          <IconButton tooltip="Back" onClick={() => setView("main")}>
            <Icon name="chevron-left" />
          </IconButton>
        }
        style={{ "flex-direction": "row-reverse" }}
      />

      <SidebarContent>
        <SidebarSection>
          <Card style={mergeStyles(ui.row, { "align-items": "flex-start", "margin-bottom": "16px" })}>
            <Icon name="bolt" style={mergeStyles(ui.icon, { width: "20px", height: "20px" })} />
            <Text variant="muted" style={{ "line-height": "1.5" }}>
              Document a specific feature. AI will analyze related code and create a dedicated .md file.
            </Text>
          </Card>
        </SidebarSection>

        <SidebarSection title="Feature Name">
          <Input
            placeholder="e.g., User Authentication"
            value={featureName()}
            onInput={(e) => setFeatureName(e.currentTarget.value)}
          />
        </SidebarSection>

        <SidebarSection title="Description (optional)">
          <Textarea
            placeholder="What should be documented? Key flows, components, etc."
            value={featureDescription()}
            onInput={(e) => setFeatureDescription(e.currentTarget.value)}
            rows={3}
          />
        </SidebarSection>

        <SidebarSection title="Entry Point (optional)">
          <Input
            placeholder="e.g., src/auth/"
            value={featureEntryPoint()}
            onInput={(e) => setFeatureEntryPoint(e.currentTarget.value)}
          />
        </SidebarSection>

        <SidebarSection>
          <Button 
            variant="primary"
            icon={context().status === "indexing" 
              ? <LoadingSpinner size="sm" /> 
              : <Icon name="file-lines" size={14} />
            }
            onClick={documentFeature}
            disabled={!featureName().trim() || context().status === "indexing"}
            style={{ width: "100%", opacity: featureName().trim() ? "1" : "0.5" }}
          >
            {context().status === "indexing" ? "Generating..." : "Generate Documentation"}
          </Button>
        </SidebarSection>
      </SidebarContent>
    </>
  );

  // ============================================================================
  // Render: Document Folder View
  // ============================================================================
  const renderDocFolderView = () => (
    <>
      <SidebarHeader 
        title="Document Folder"
        actions={
          <IconButton tooltip="Back" onClick={() => setView("main")}>
            <Icon name="chevron-left" />
          </IconButton>
        }
        style={{ "flex-direction": "row-reverse" }}
      />

      <SidebarContent>
        <SidebarSection>
          <Card style={mergeStyles(ui.row, { "align-items": "flex-start", "margin-bottom": "16px" })}>
            <Icon name="folder" style={mergeStyles(ui.icon, { width: "20px", height: "20px" })} />
            <Text variant="muted" style={{ "line-height": "1.5" }}>
              Generate documentation for a specific folder explaining its purpose and contents.
            </Text>
          </Card>
        </SidebarSection>

        <SidebarSection title="Quick Select">
          <For each={quickFolders}>
            {(folder) => (
              <ListItem
                icon={<Icon name="folder" style={ui.icon} />}
                label={folder}
                iconRight={selectedFolder() === folder ? <Icon name="check" style={ui.iconActive} /> : undefined}
                selected={selectedFolder() === folder}
                onClick={() => setSelectedFolder(folder)}
              />
            )}
          </For>
        </SidebarSection>

        <SidebarSection title="Or Custom Path">
          <Input
            placeholder="/path/to/folder"
            value={selectedFolder()}
            onInput={(e) => setSelectedFolder(e.currentTarget.value)}
          />
        </SidebarSection>

        <SidebarSection>
          <Button 
            variant="primary"
            icon={context().status === "indexing" 
              ? <LoadingSpinner size="sm" /> 
              : <Icon name="file-lines" size={14} />
            }
            onClick={documentFolder}
            disabled={!selectedFolder().trim() || context().status === "indexing"}
            style={{ width: "100%", opacity: selectedFolder().trim() ? "1" : "0.5" }}
          >
            {context().status === "indexing" ? "Generating..." : "Generate Documentation"}
          </Button>
        </SidebarSection>
      </SidebarContent>
    </>
  );

  // ============================================================================
  // Main Render
  // ============================================================================
  return (
    <div style={ui.panel}>
      <Show when={view() === "main"}>{renderMainView()}</Show>
      <Show when={view() === "settings"}>{renderSettingsView()}</Show>
      <Show when={view() === "ask-result"}>{renderAskResultView()}</Show>
      <Show when={view() === "doc-feature"}>{renderDocFeatureView()}</Show>
      <Show when={view() === "doc-folder"}>{renderDocFolderView()}</Show>
    </div>
  );
}
