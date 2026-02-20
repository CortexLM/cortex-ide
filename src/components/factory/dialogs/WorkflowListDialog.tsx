/**
 * =============================================================================
 * WORKFLOW LIST DIALOG - Select or Manage Workflows
 * =============================================================================
 * 
 * A dialog for selecting workflows to open, with search, filter, and
 * management capabilities.
 * 
 * Features:
 * - List of workflows with name, description, last modified
 * - Search/filter
 * - Sort by name/date/author
 * - Grid or list view toggle
 * - Recent workflows section
 * - Create new workflow button
 * - Delete workflow button (with confirmation)
 * - Duplicate workflow button
 * - Preview workflow on hover
 * 
 * =============================================================================
 */

import {
  createSignal,
  createMemo,
  For,
  Show,
  JSX,
} from "solid-js";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Badge } from "../../ui/Badge";
import { Select } from "../../ui/Select";
import { EmptyState } from "../../ui/EmptyState";

// =============================================================================
// TYPES
// =============================================================================

export type SortOption = "name" | "date" | "author";
export type ViewMode = "grid" | "list";

export interface WorkflowSummary {
  id: string;
  name: string;
  description?: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
  nodeCount: number;
  connectionCount: number;
  isRecent?: boolean;
  tags?: string[];
  thumbnail?: string;
}

export interface WorkflowPreviewData {
  id: string;
  nodes: Array<{ type: string; name: string }>;
  connectionCount: number;
}

export interface WorkflowListDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** List of workflows */
  workflows?: WorkflowSummary[];
  /** Callback when a workflow is selected to open */
  onSelectWorkflow?: (workflowId: string) => void;
  /** Callback to create a new workflow */
  onCreateWorkflow?: () => void;
  /** Callback to delete a workflow */
  onDeleteWorkflow?: (workflowId: string) => void;
  /** Callback to duplicate a workflow */
  onDuplicateWorkflow?: (workflowId: string) => void;
  /** Callback to get preview data */
  onPreviewWorkflow?: (workflowId: string) => WorkflowPreviewData | null;
  /** Currently selected workflow for preview */
  selectedWorkflowId?: string;
  /** Loading state */
  loading?: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

// =============================================================================
// VIEW TOGGLE COMPONENT
// =============================================================================

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

function ViewToggle(props: ViewToggleProps) {
  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    background: "var(--jb-surface-active)",
    "border-radius": "var(--jb-radius-sm)",
    padding: "2px",
  };

  const buttonStyle = (active: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "28px",
    height: "24px",
    background: active ? "var(--ui-panel-bg)" : "transparent",
    border: "none",
    "border-radius": "var(--jb-radius-sm)",
    color: active ? "var(--jb-text-body-color)" : "var(--jb-text-muted-color)",
    cursor: "pointer",
    transition: "all var(--cortex-transition-fast)",
  });

  return (
    <div style={containerStyle}>
      <button
        type="button"
        style={buttonStyle(props.view === "grid")}
        onClick={() => props.onChange("grid")}
        title="Grid view"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <rect x="2" y="2" width="4" height="4" rx="1" />
          <rect x="8" y="2" width="4" height="4" rx="1" />
          <rect x="2" y="8" width="4" height="4" rx="1" />
          <rect x="8" y="8" width="4" height="4" rx="1" />
        </svg>
      </button>
      <button
        type="button"
        style={buttonStyle(props.view === "list")}
        onClick={() => props.onChange("list")}
        title="List view"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <rect x="2" y="2" width="10" height="2" rx="0.5" />
          <rect x="2" y="6" width="10" height="2" rx="0.5" />
          <rect x="2" y="10" width="10" height="2" rx="0.5" />
        </svg>
      </button>
    </div>
  );
}

// =============================================================================
// WORKFLOW CARD COMPONENT (Grid View)
// =============================================================================

interface WorkflowCardProps {
  workflow: WorkflowSummary;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPreview: () => void;
}

function WorkflowCard(props: WorkflowCardProps) {
  const [isHovered, setIsHovered] = createSignal(false);

  const cardStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    background: props.isSelected
      ? "var(--jb-surface-active)"
      : isHovered()
        ? "var(--jb-surface-hover)"
        : "var(--ui-panel-bg)",
    border: props.isSelected
      ? "1px solid var(--jb-border-focus)"
      : "1px solid var(--jb-border-default)",
    "border-radius": "var(--jb-radius-lg)",
    overflow: "hidden",
    cursor: "pointer",
    transition: "all var(--cortex-transition-fast)",
  });

  const thumbnailStyle: JSX.CSSProperties = {
    height: "100px",
    background: "var(--jb-canvas)",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "border-bottom": "1px solid var(--jb-border-divider)",
    position: "relative",
  };

  const contentStyle: JSX.CSSProperties = {
    padding: "12px",
    flex: "1",
    display: "flex",
    "flex-direction": "column",
  };

  const nameStyle: JSX.CSSProperties = {
    "font-size": "13px",
    "font-weight": "600",
    color: "var(--jb-text-body-color)",
    "margin-bottom": "4px",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  };

  const descriptionStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
    "margin-bottom": "8px",
    "line-height": "1.4",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    display: "-webkit-box",
    "-webkit-line-clamp": "2",
    "-webkit-box-orient": "vertical",
    flex: "1",
  };

  const metaStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    "font-size": "10px",
    color: "var(--jb-text-muted-color)",
  };

  const actionsOverlayStyle: JSX.CSSProperties = {
    position: "absolute",
    top: "0",
    left: "0",
    right: "0",
    bottom: "0",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    gap: "8px",
    background: "rgba(0, 0, 0, 0.5)",
  };

  return (
    <div
      style={cardStyle()}
      onMouseEnter={() => {
        setIsHovered(true);
        props.onPreview();
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      onClick={props.onSelect}
    >
      <div style={thumbnailStyle}>
        <Show
          when={isHovered()}
          fallback={
            <svg width="40" height="40" viewBox="0 0 40 40" fill="currentColor" style={{ color: "var(--jb-icon-color-default)", opacity: "0.3" }}>
              <path d="M20 5L10 12v16l10 7 10-7V12L20 5zm0 2l8 5.6v12.8L20 31l-8-5.6V12.6L20 7z" />
              <circle cx="15" cy="15" r="2" />
              <circle cx="25" cy="15" r="2" />
              <circle cx="20" cy="25" r="2" />
              <path d="M15 15l5 10m5-10l-5 10" stroke="currentColor" stroke-width="1" fill="none" />
            </svg>
          }
        >
          <div style={actionsOverlayStyle}>
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                props.onSelect();
              }}
            >
              Open
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                props.onDuplicate();
              }}
            >
              Duplicate
            </Button>
          </div>
        </Show>
      </div>

      <div style={contentStyle}>
        <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
          <span style={nameStyle}>{props.workflow.name}</span>
          <Show when={props.workflow.isRecent}>
            <Badge variant="accent" size="sm">Recent</Badge>
          </Show>
        </div>
        <div style={descriptionStyle}>
          {props.workflow.description || "No description"}
        </div>
        <div style={metaStyle}>
          <span>{props.workflow.nodeCount} nodes</span>
          <span>{formatDate(props.workflow.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// WORKFLOW ROW COMPONENT (List View)
// =============================================================================

interface WorkflowRowProps {
  workflow: WorkflowSummary;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPreview: () => void;
}

function WorkflowRow(props: WorkflowRowProps) {
  const [isHovered, setIsHovered] = createSignal(false);

  const rowStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "12px",
    padding: "10px 12px",
    background: props.isSelected
      ? "var(--jb-surface-active)"
      : isHovered()
        ? "var(--jb-surface-hover)"
        : "transparent",
    border: props.isSelected
      ? "1px solid var(--jb-border-focus)"
      : "1px solid transparent",
    "border-radius": "var(--jb-radius-md)",
    cursor: "pointer",
    transition: "all var(--cortex-transition-fast)",
  });

  const iconStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "36px",
    height: "36px",
    "border-radius": "var(--jb-radius-md)",
    background: "var(--jb-canvas)",
    color: "var(--jb-icon-color-default)",
    "flex-shrink": "0",
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    "min-width": "0",
  };

  const nameRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
  };

  const nameStyle: JSX.CSSProperties = {
    "font-size": "13px",
    "font-weight": "500",
    color: "var(--jb-text-body-color)",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  };

  const descriptionStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  };

  const metaStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "16px",
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
    "flex-shrink": "0",
  };

  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    gap: "4px",
    "flex-shrink": "0",
  };

  return (
    <div
      style={rowStyle()}
      onMouseEnter={() => {
        setIsHovered(true);
        props.onPreview();
      }}
      onMouseLeave={() => setIsHovered(false)}
      onClick={props.onSelect}
    >
      <div style={iconStyle}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
          <path d="M9 2L4 5.5v7L9 16l5-3.5v-7L9 2zm0 1.5l4 2.8v5.4L9 14.5l-4-2.8V6.3L9 3.5z" />
        </svg>
      </div>

      <div style={contentStyle}>
        <div style={nameRowStyle}>
          <span style={nameStyle}>{props.workflow.name}</span>
          <Show when={props.workflow.isRecent}>
            <Badge variant="accent" size="sm">Recent</Badge>
          </Show>
        </div>
        <div style={descriptionStyle}>
          {props.workflow.description || "No description"}
        </div>
      </div>

      <div style={metaStyle}>
        <span>{props.workflow.nodeCount} nodes</span>
        <span>{props.workflow.author}</span>
        <span style={{ width: "80px" }}>{formatDate(props.workflow.updatedAt)}</span>
      </div>

      <Show when={isHovered()}>
        <div style={actionsStyle}>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              props.onDuplicate();
            }}
            title="Duplicate"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M4 2h4v2h2v6H4V8H2V2h2zm1 1H3v5h1V4h3V3H5zm1 2v5h4V5H6z" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              props.onDelete();
            }}
            title="Delete"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M4 1h4v1h3v1H1V2h3V1zM2 4h8v7H2V4zm2 1v5h1V5H4zm3 0v5h1V5H7z" />
            </svg>
          </Button>
        </div>
      </Show>
    </div>
  );
}

// =============================================================================
// WORKFLOW LIST DIALOG COMPONENT
// =============================================================================

export function WorkflowListDialog(props: WorkflowListDialogProps) {
  const workflows = () => props.workflows || [];

  const [searchQuery, setSearchQuery] = createSignal("");
  const [sortBy, setSortBy] = createSignal<SortOption>("date");
  const [viewMode, setViewMode] = createSignal<ViewMode>("grid");
  const [selectedId, setSelectedId] = createSignal<string | null>(props.selectedWorkflowId || null);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal<string | null>(null);

  // Recent workflows
  const recentWorkflows = createMemo(() =>
    workflows().filter((w) => w.isRecent).slice(0, 4)
  );

  // Filtered and sorted workflows
  const filteredWorkflows = createMemo(() => {
    let result = workflows();
    const query = searchQuery().toLowerCase().trim();

    // Filter by search
    if (query) {
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(query) ||
          w.description?.toLowerCase().includes(query) ||
          w.author.toLowerCase().includes(query) ||
          w.tags?.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Sort
    const sortOption = sortBy();
    result = [...result].sort((a, b) => {
      switch (sortOption) {
        case "name":
          return a.name.localeCompare(b.name);
        case "author":
          return a.author.localeCompare(b.author);
        case "date":
        default:
          return b.updatedAt.getTime() - a.updatedAt.getTime();
      }
    });

    return result;
  });

  const handleSelect = (workflowId: string) => {
    props.onSelectWorkflow?.(workflowId);
    props.onClose();
  };

  const handleDelete = (workflowId: string) => {
    props.onDeleteWorkflow?.(workflowId);
    setShowDeleteConfirm(null);
    if (selectedId() === workflowId) setSelectedId(null);
  };

  // Styles
  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
    "margin-bottom": "16px",
    "flex-wrap": "wrap",
  };

  const searchContainerStyle: JSX.CSSProperties = {
    flex: "1",
    "min-width": "200px",
  };

  const controlsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
  };

  const gridStyle: JSX.CSSProperties = {
    display: "grid",
    "grid-template-columns": "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "12px",
    "max-height": "400px",
    overflow: "auto",
    padding: "2px",
  };

  const listStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "4px",
    "max-height": "400px",
    overflow: "auto",
    padding: "2px",
  };

  const recentSectionStyle: JSX.CSSProperties = {
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

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Open Workflow"
      size="lg"
      style={{ width: "800px", "max-width": "95vw" }}
      footer={
        <div style={{ display: "flex", "justify-content": "space-between", width: "100%" }}>
          <Button
            variant="primary"
            onClick={() => {
              props.onCreateWorkflow?.();
              props.onClose();
            }}
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M7 2v10M2 7h10" />
              </svg>
            }
          >
            New Workflow
          </Button>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      {/* Header Controls */}
      <div style={headerStyle}>
        <div style={searchContainerStyle}>
          <Input
            placeholder="Search workflows..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M6 1a5 5 0 1 0 3.5 8.5l3 3 .7-.7-3-3A5 5 0 0 0 6 1zm0 1a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />
              </svg>
            }
          />
        </div>
        <div style={controlsStyle}>
          <Select
            options={[
              { value: "date", label: "Sort by date" },
              { value: "name", label: "Sort by name" },
              { value: "author", label: "Sort by author" },
            ]}
            value={sortBy()}
            onChange={(val) => setSortBy(val as SortOption)}
            style={{ width: "140px" }}
          />
          <ViewToggle view={viewMode()} onChange={setViewMode} />
        </div>
      </div>

      {/* Recent Workflows Section */}
      <Show when={!searchQuery() && recentWorkflows().length > 0}>
        <div style={recentSectionStyle}>
          <div style={sectionTitleStyle}>Recent</div>
          <div style={{ display: "flex", gap: "8px", "flex-wrap": "wrap" }}>
            <For each={recentWorkflows()}>
              {(workflow) => (
                <button
                  type="button"
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    padding: "8px 12px",
                    background: "var(--ui-panel-bg)",
                    border: "1px solid var(--jb-border-default)",
                    "border-radius": "var(--jb-radius-md)",
                    cursor: "pointer",
                    "font-size": "12px",
                    color: "var(--jb-text-body-color)",
                    transition: "all var(--cortex-transition-fast)",
                  }}
                  onClick={() => handleSelect(workflow.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--jb-surface-hover)";
                    e.currentTarget.style.borderColor = "var(--jb-border-focus)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--ui-panel-bg)";
                    e.currentTarget.style.borderColor = "var(--jb-border-default)";
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ color: "var(--jb-icon-color-default)" }}>
                    <path d="M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1zm0 1a5 5 0 1 1 0 10A5 5 0 0 1 7 2z" />
                    <path d="M7 3v4l3 1.5-.4.9L6 7.5V3h1z" />
                  </svg>
                  {workflow.name}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* All Workflows */}
      <div style={sectionTitleStyle}>
        All Workflows ({filteredWorkflows().length})
      </div>

      <Show
        when={!props.loading}
        fallback={
          <div style={{ display: "flex", "justify-content": "center", padding: "40px" }}>
            <div style={{ color: "var(--jb-text-muted-color)" }}>Loading workflows...</div>
          </div>
        }
      >
        <Show
          when={filteredWorkflows().length > 0}
          fallback={
            <EmptyState
              icon={
                <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
                  <path d="M16 4L6 10v12l10 6 10-6V10L16 4zm0 2l8 4.8v9.6L16 26l-8-5.6v-9.6L16 6z" />
                </svg>
              }
              title={searchQuery() ? "No Workflows Found" : "No Workflows Yet"}
              description={
                searchQuery()
                  ? "Try adjusting your search"
                  : "Create your first workflow to get started"
              }
              action={
                !searchQuery() ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      props.onCreateWorkflow?.();
                      props.onClose();
                    }}
                  >
                    Create Workflow
                  </Button>
                ) : undefined
              }
            />
          }
        >
          <Show when={viewMode() === "grid"}>
            <div style={gridStyle}>
              <For each={filteredWorkflows()}>
                {(workflow) => (
                  <WorkflowCard
                    workflow={workflow}
                    isSelected={selectedId() === workflow.id}
                    onSelect={() => handleSelect(workflow.id)}
                    onDelete={() => setShowDeleteConfirm(workflow.id)}
                    onDuplicate={() => props.onDuplicateWorkflow?.(workflow.id)}
                    onPreview={() => {
                      setSelectedId(workflow.id);
                      props.onPreviewWorkflow?.(workflow.id);
                    }}
                  />
                )}
              </For>
            </div>
          </Show>

          <Show when={viewMode() === "list"}>
            <div style={listStyle}>
              <For each={filteredWorkflows()}>
                {(workflow) => (
                  <WorkflowRow
                    workflow={workflow}
                    isSelected={selectedId() === workflow.id}
                    onSelect={() => handleSelect(workflow.id)}
                    onDelete={() => setShowDeleteConfirm(workflow.id)}
                    onDuplicate={() => props.onDuplicateWorkflow?.(workflow.id)}
                    onPreview={() => {
                      setSelectedId(workflow.id);
                      props.onPreviewWorkflow?.(workflow.id);
                    }}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>
      </Show>

      {/* Delete confirmation modal */}
      <Modal
        open={showDeleteConfirm() !== null}
        onClose={() => setShowDeleteConfirm(null)}
        title="Delete Workflow"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => handleDelete(showDeleteConfirm()!)}>
              Delete
            </Button>
          </>
        }
      >
        <p style={{ color: "var(--jb-text-body-color)", "font-size": "13px" }}>
          Are you sure you want to delete this workflow? This action cannot be undone.
        </p>
      </Modal>
    </Modal>
  );
}

export default WorkflowListDialog;
