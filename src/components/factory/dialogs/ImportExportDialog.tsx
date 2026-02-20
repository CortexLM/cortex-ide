/**
 * =============================================================================
 * IMPORT/EXPORT DIALOG - Workflow Import & Export
 * =============================================================================
 * 
 * A dialog for importing and exporting workflow configurations. Supports
 * multiple formats and provides conflict resolution options.
 * 
 * Features:
 * - Export tab:
 *   - Format selector: YAML, JSON
 *   - Include dependencies checkbox (agents, rules)
 *   - Export to file button
 *   - Copy to clipboard button
 *   - Generate shareable link
 * - Import tab:
 *   - Drag & drop file area
 *   - Paste content area
 *   - Import from URL input
 *   - Preview imported workflow
 *   - Conflict resolution options
 *   - Import button
 * - History of recent imports/exports
 * 
 * =============================================================================
 */

import {
  createSignal,
  For,
  Show,
  JSX,
} from "solid-js";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { Input, Textarea } from "../../ui/Input";
import { Badge } from "../../ui/Badge";
import { Checkbox } from "../../ui/Checkbox";
import { Select } from "../../ui/Select";
import { Tabs, TabList, Tab, TabPanel } from "../../ui/Tabs";
import { EmptyState } from "../../ui/EmptyState";

// =============================================================================
// TYPES
// =============================================================================

export type ExportFormat = "yaml" | "json";

export type ConflictResolution = "skip" | "replace" | "rename";

export interface ImportExportHistoryEntry {
  id: string;
  type: "import" | "export";
  format: ExportFormat;
  workflowName: string;
  timestamp: Date;
  size?: number;
}

export interface WorkflowPreview {
  name: string;
  description?: string;
  nodeCount: number;
  connectionCount: number;
  agentCount: number;
  hasConflicts: boolean;
  conflicts?: string[];
}

export interface ImportExportDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Current workflow name */
  workflowName?: string;
  /** Export callback */
  onExport?: (format: ExportFormat, includeDependencies: boolean) => void;
  /** Copy to clipboard callback */
  onCopyToClipboard?: (format: ExportFormat, includeDependencies: boolean) => void;
  /** Generate shareable link callback */
  onGenerateLink?: () => Promise<string>;
  /** Import from content callback */
  onImportContent?: (content: string, conflictResolution: ConflictResolution) => void;
  /** Import from file callback */
  onImportFile?: (file: File, conflictResolution: ConflictResolution) => void;
  /** Import from URL callback */
  onImportUrl?: (url: string, conflictResolution: ConflictResolution) => void;
  /** Preview workflow from content */
  onPreviewContent?: (content: string) => WorkflowPreview | null;
  /** Recent history */
  history?: ImportExportHistoryEntry[];
  /** Initial tab */
  initialTab?: "export" | "import" | "history";
  /** Loading state */
  loading?: boolean;
}

// =============================================================================
// FILE DROP ZONE COMPONENT
// =============================================================================

interface FileDropZoneProps {
  onFileDrop: (file: File) => void;
  accept?: string;
}

function FileDropZone(props: FileDropZoneProps) {
  const [isDragging, setIsDragging] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      props.onFileDrop(files[0]);
    }
  };

  const handleFileChange = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      props.onFileDrop(input.files[0]);
    }
  };

  const dropZoneStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    gap: "12px",
    padding: "32px",
    border: isDragging()
      ? "2px dashed var(--jb-border-focus)"
      : "2px dashed var(--jb-border-default)",
    "border-radius": "var(--jb-radius-lg)",
    background: isDragging() ? "rgba(53, 116, 240, 0.05)" : "transparent",
    cursor: "pointer",
    transition: "all var(--cortex-transition-fast)",
  });

  return (
    <div
      style={dropZoneStyle()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => inputRef?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={props.accept || ".yaml,.yml,.json"}
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor" style={{ color: "var(--jb-icon-color-default)", opacity: "0.6" }}>
        <path d="M16 4l-8 8h5v8h6v-8h5l-8-8zm-10 18v4h20v-4h-2v2H8v-2H6z" />
      </svg>
      <div style={{ "text-align": "center" }}>
        <div style={{ "font-size": "13px", color: "var(--jb-text-body-color)", "margin-bottom": "4px" }}>
          Drop file here or click to browse
        </div>
        <div style={{ "font-size": "11px", color: "var(--jb-text-muted-color)" }}>
          Supports YAML and JSON formats
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// WORKFLOW PREVIEW COMPONENT
// =============================================================================

interface WorkflowPreviewCardProps {
  preview: WorkflowPreview;
}

function WorkflowPreviewCard(props: WorkflowPreviewCardProps) {
  const cardStyle: JSX.CSSProperties = {
    background: "var(--jb-surface-panel)",
    border: props.preview.hasConflicts
      ? "1px solid var(--cortex-warning)"
      : "1px solid var(--jb-border-default)",
    "border-radius": "var(--jb-radius-md)",
    padding: "12px",
    "margin-top": "12px",
  };

  const statsStyle: JSX.CSSProperties = {
    display: "flex",
    gap: "16px",
    "margin-top": "8px",
    "flex-wrap": "wrap",
  };

  const statItemStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "4px",
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "8px" }}>
        <div style={{ "font-size": "13px", "font-weight": "600", color: "var(--jb-text-body-color)" }}>
          {props.preview.name}
        </div>
        <Show when={props.preview.hasConflicts}>
          <Badge variant="warning" size="sm">Has Conflicts</Badge>
        </Show>
      </div>
      
      <Show when={props.preview.description}>
        <div style={{ "font-size": "12px", color: "var(--jb-text-muted-color)", "margin-bottom": "8px" }}>
          {props.preview.description}
        </div>
      </Show>

      <div style={statsStyle}>
        <div style={statItemStyle}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1" fill="none" />
          </svg>
          {props.preview.nodeCount} nodes
        </div>
        <div style={statItemStyle}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2 6h8M8 3l3 3-3 3" stroke="currentColor" stroke-width="1" fill="none" />
          </svg>
          {props.preview.connectionCount} connections
        </div>
        <div style={statItemStyle}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="6" cy="4" r="2" />
            <path d="M2 10c0-2.2 1.8-4 4-4s4 1.8 4 4" />
          </svg>
          {props.preview.agentCount} agents
        </div>
      </div>

      <Show when={props.preview.conflicts && props.preview.conflicts.length > 0}>
        <div style={{ "margin-top": "12px" }}>
          <div style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase", "letter-spacing": "0.5px", color: "var(--cortex-warning)", "margin-bottom": "6px" }}>
            Conflicts Detected
          </div>
          <ul style={{ margin: "0", padding: "0 0 0 16px", "font-size": "11px", color: "var(--jb-text-muted-color)" }}>
            <For each={props.preview.conflicts}>
              {(conflict) => <li>{conflict}</li>}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  );
}

// =============================================================================
// HISTORY ENTRY COMPONENT
// =============================================================================

interface HistoryEntryRowProps {
  entry: ImportExportHistoryEntry;
  onReuse?: () => void;
}

function HistoryEntryRow(props: HistoryEntryRowProps) {
  const [isHovered, setIsHovered] = createSignal(false);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const rowStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "12px",
    padding: "10px 12px",
    background: isHovered() ? "var(--jb-surface-hover)" : "transparent",
    "border-radius": "var(--jb-radius-sm)",
    transition: "background var(--cortex-transition-fast)",
  });

  return (
    <div
      style={rowStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ display: "flex", "align-items": "center", "justify-content": "center", width: "28px", height: "28px", "border-radius": "var(--jb-radius-sm)", background: props.entry.type === "export" ? "rgba(89, 168, 105, 0.15)" : "rgba(53, 116, 240, 0.15)" }}>
        <Show when={props.entry.type === "export"}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ color: "var(--cortex-success)" }}>
            <path d="M7 1l4 4h-3v5H6V5H3l4-4zm-5 10h10v2H2v-2z" />
          </svg>
        </Show>
        <Show when={props.entry.type === "import"}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ color: "var(--jb-border-focus)" }}>
            <path d="M7 10L3 6h3V1h2v5h3L7 10zm-5 1h10v2H2v-2z" />
          </svg>
        </Show>
      </div>
      
      <div style={{ flex: "1", "min-width": "0" }}>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <span style={{ "font-size": "12px", "font-weight": "500", color: "var(--jb-text-body-color)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
            {props.entry.workflowName}
          </span>
          <Badge variant="default" size="sm">{props.entry.format.toUpperCase()}</Badge>
        </div>
        <div style={{ "font-size": "11px", color: "var(--jb-text-muted-color)", display: "flex", gap: "8px" }}>
          <span>{formatDate(props.entry.timestamp)}</span>
          <Show when={props.entry.size}>
            <span>{formatSize(props.entry.size)}</span>
          </Show>
        </div>
      </div>

      <Show when={isHovered()}>
        <Button variant="ghost" size="sm" onClick={props.onReuse}>
          {props.entry.type === "export" ? "Export Again" : "Import Again"}
        </Button>
      </Show>
    </div>
  );
}

// =============================================================================
// IMPORT/EXPORT DIALOG COMPONENT
// =============================================================================

export function ImportExportDialog(props: ImportExportDialogProps) {
  const [activeTab, setActiveTab] = createSignal(props.initialTab || "export");
  
  // Export state
  const [exportFormat, setExportFormat] = createSignal<ExportFormat>("yaml");
  const [includeDependencies, setIncludeDependencies] = createSignal(true);
  const [shareableLink, setShareableLink] = createSignal<string | null>(null);
  const [generatingLink, setGeneratingLink] = createSignal(false);
  const [copied, setCopied] = createSignal(false);

  // Import state
  const [importContent, setImportContent] = createSignal("");
  const [importUrl, setImportUrl] = createSignal("");
  const [conflictResolution, setConflictResolution] = createSignal<ConflictResolution>("skip");
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
  const [preview, setPreview] = createSignal<WorkflowPreview | null>(null);

  const history = () => props.history || [];

  const handleExport = () => {
    props.onExport?.(exportFormat(), includeDependencies());
  };

  const handleCopyToClipboard = async () => {
    props.onCopyToClipboard?.(exportFormat(), includeDependencies());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateLink = async () => {
    if (!props.onGenerateLink) return;
    setGeneratingLink(true);
    try {
      const link = await props.onGenerateLink();
      setShareableLink(link);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleFileDrop = (file: File) => {
    setSelectedFile(file);
    // Read file and preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const previewResult = props.onPreviewContent?.(content);
      setPreview(previewResult || null);
    };
    reader.readAsText(file);
  };

  const handleImportContent = () => {
    const content = importContent().trim();
    if (content) {
      props.onImportContent?.(content, conflictResolution());
    }
  };

  const handleImportFile = () => {
    const file = selectedFile();
    if (file) {
      props.onImportFile?.(file, conflictResolution());
    }
  };

  const handleImportUrl = () => {
    const url = importUrl().trim();
    if (url) {
      props.onImportUrl?.(url, conflictResolution());
    }
  };

  // Update preview when content changes
  const handleContentChange = (content: string) => {
    setImportContent(content);
    if (content.trim()) {
      const previewResult = props.onPreviewContent?.(content);
      setPreview(previewResult || null);
    } else {
      setPreview(null);
    }
  };

  // Styles
  const sectionStyle: JSX.CSSProperties = {
    "margin-bottom": "20px",
  };

  const sectionTitleStyle: JSX.CSSProperties = {
    "font-size": "11px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: "var(--jb-text-header-color)",
    "margin-bottom": "10px",
  };

  const optionsRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "16px",
    "flex-wrap": "wrap",
    "margin-bottom": "12px",
  };

  const actionsRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "flex-wrap": "wrap",
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Import / Export Workflow"
      size="lg"
      style={{ width: "600px", "max-width": "95vw" }}
    >
      <Tabs activeTab={activeTab()} onChange={setActiveTab}>
        <TabList>
          <Tab id="export">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ "margin-right": "6px" }}>
              <path d="M7 1l4 4h-3v5H6V5H3l4-4zm-5 10h10v2H2v-2z" />
            </svg>
            Export
          </Tab>
          <Tab id="import">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ "margin-right": "6px" }}>
              <path d="M7 10L3 6h3V1h2v5h3L7 10zm-5 1h10v2H2v-2z" />
            </svg>
            Import
          </Tab>
          <Tab id="history">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ "margin-right": "6px" }}>
              <path d="M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1zm0 1a5 5 0 1 1 0 10A5 5 0 0 1 7 2z" />
              <path d="M7 3v4l3 1.5-.4.9L6 7.5V3h1z" />
            </svg>
            History
            <Show when={history().length > 0}>
              <Badge variant="default" size="sm" style={{ "margin-left": "6px" }}>
                {history().length}
              </Badge>
            </Show>
          </Tab>
        </TabList>

        {/* Export Tab */}
        <TabPanel id="export" style={{ padding: "20px 0" }}>
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Workflow</div>
            <div style={{ "font-size": "13px", color: "var(--jb-text-body-color)", background: "var(--jb-canvas)", padding: "10px 12px", "border-radius": "var(--jb-radius-sm)" }}>
              {props.workflowName || "Untitled Workflow"}
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Format</div>
            <div style={optionsRowStyle}>
              <Select
                options={[
                  { value: "yaml", label: "YAML" },
                  { value: "json", label: "JSON" },
                ]}
                value={exportFormat()}
                onChange={(val) => setExportFormat(val as ExportFormat)}
                style={{ width: "150px" }}
              />
              <Checkbox
                checked={includeDependencies()}
                onChange={setIncludeDependencies}
                label="Include dependencies"
                description="Export referenced agents and rules"
              />
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Export Options</div>
            <div style={actionsRowStyle}>
              <Button
                variant="primary"
                onClick={handleExport}
                icon={
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M7 1l4 4h-3v5H6V5H3l4-4zm-5 10h10v2H2v-2z" />
                  </svg>
                }
              >
                Export to File
              </Button>
              <Button
                variant="secondary"
                onClick={handleCopyToClipboard}
                icon={
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M4 2h6v2h2v8H4v-2H2V4h2V2zm1 1v1h4V3H5zm-2 2v6h6V5H3zm7 1v6h1V6h-1z" />
                  </svg>
                }
              >
                {copied() ? "Copied!" : "Copy to Clipboard"}
              </Button>
              <Button
                variant="secondary"
                onClick={handleGenerateLink}
                loading={generatingLink()}
                icon={
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M8 3a2 2 0 0 1 2 2v1h-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V8h1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3z" />
                    <path d="M10 6l2 2-2 2v-1.5H7v-1h3V6z" />
                  </svg>
                }
              >
                Generate Link
              </Button>
            </div>
          </div>

          <Show when={shareableLink()}>
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>Shareable Link</div>
              <Input
                value={shareableLink() || ""}
                readonly
                iconRight={
                  <button
                    type="button"
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--jb-icon-color-default)" }}
                    onClick={() => {
                      navigator.clipboard.writeText(shareableLink() || "");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                      <path d="M4 2h6v2h2v8H4v-2H2V4h2V2zm1 1v1h4V3H5zm-2 2v6h6V5H3zm7 1v6h1V6h-1z" />
                    </svg>
                  </button>
                }
              />
            </div>
          </Show>
        </TabPanel>

        {/* Import Tab */}
        <TabPanel id="import" style={{ padding: "20px 0" }}>
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Drop File</div>
            <FileDropZone onFileDrop={handleFileDrop} />
            <Show when={selectedFile()}>
              <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-top": "8px" }}>
                <Badge variant="success" size="sm">
                  {selectedFile()?.name}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedFile(null); setPreview(null); }}>
                  Clear
                </Button>
              </div>
            </Show>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Or Paste Content</div>
            <Textarea
              placeholder="Paste YAML or JSON content here..."
              value={importContent()}
              onInput={(e) => handleContentChange(e.currentTarget.value)}
              style={{ "min-height": "100px", "font-family": "var(--jb-font-mono)", "font-size": "11px" }}
            />
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Or Import from URL</div>
            <div style={{ display: "flex", gap: "8px" }}>
              <div style={{ flex: "1" }}>
                <Input
                  placeholder="https://example.com/workflow.yaml"
                  value={importUrl()}
                  onInput={(e) => setImportUrl(e.currentTarget.value)}
                />
              </div>
              <Button variant="secondary" onClick={handleImportUrl} disabled={!importUrl().trim()}>
                Fetch
              </Button>
            </div>
          </div>

          <Show when={preview()}>
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>Preview</div>
              <WorkflowPreviewCard preview={preview()!} />
            </div>
          </Show>

          <Show when={preview()?.hasConflicts}>
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>Conflict Resolution</div>
              <Select
                options={[
                  { value: "skip", label: "Skip conflicting items" },
                  { value: "replace", label: "Replace existing items" },
                  { value: "rename", label: "Rename imported items" },
                ]}
                value={conflictResolution()}
                onChange={(val) => setConflictResolution(val as ConflictResolution)}
              />
            </div>
          </Show>

          <div style={actionsRowStyle}>
            <Button
              variant="primary"
              onClick={() => {
                if (selectedFile()) handleImportFile();
                else if (importContent().trim()) handleImportContent();
              }}
              disabled={!selectedFile() && !importContent().trim()}
              loading={props.loading}
              icon={
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M7 10L3 6h3V1h2v5h3L7 10zm-5 1h10v2H2v-2z" />
                </svg>
              }
            >
              Import Workflow
            </Button>
          </div>
        </TabPanel>

        {/* History Tab */}
        <TabPanel id="history" style={{ padding: "20px 0" }}>
          <Show
            when={history().length > 0}
            fallback={
              <EmptyState
                icon={
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
                    <path d="M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm0 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z" />
                    <path d="M16 8v8l6 3-.9 1.8-7.1-3.5V8h2z" />
                  </svg>
                }
                title="No History"
                description="Your import and export history will appear here"
              />
            }
          >
            <div style={{ "max-height": "350px", overflow: "auto" }}>
              <For each={history()}>
                {(entry) => (
                  <HistoryEntryRow entry={entry} />
                )}
              </For>
            </div>
          </Show>
        </TabPanel>
      </Tabs>
    </Modal>
  );
}

export default ImportExportDialog;
