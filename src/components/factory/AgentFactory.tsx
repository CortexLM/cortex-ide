/**
 * =============================================================================
 * AGENT FACTORY - Main Container Component
 * =============================================================================
 * 
 * The main entry point for the Agent Factory mode - a visual workflow editor
 * for creating, configuring, and executing multi-agent systems.
 * 
 * Features:
 * - Visual node-based workflow editor
 * - Drag-and-drop node creation
 * - Real-time execution monitoring
 * - Approval management
 * - Audit logging
 * - Resizable panel layout
 * 
 * =============================================================================
 */

import {
  createSignal,
  createMemo,
  createEffect,
  onMount,
  onCleanup,
  For,
  Show,
  batch,
  JSX,
} from "solid-js";

// Context and Hooks
import { useFactory, FactoryProvider } from "../../context/FactoryContext";
import { useWorkflow } from "../../hooks/factory/useWorkflow";
import { useExecution } from "../../hooks/factory/useExecution";
import { useLocalStorage } from "../../hooks/useLocalStorage";

// Canvas and Panels
import { FactoryCanvas, CanvasNode, CanvasEdge, CanvasViewport } from "./canvas/FactoryCanvas";
import { NodePalette, NodeDefinition } from "./panels/NodePalette";
import { Inspector, FactoryNode, FactoryNodeType } from "./panels/Inspector";
import { ConsolePanel, LogEntry } from "./panels/ConsolePanel";
import { LiveMonitor, ActiveAgent } from "./panels/LiveMonitor";
import { AuditLog } from "./panels/AuditLog";
import { ApprovalsPanel } from "./panels/ApprovalsPanel";

// UI Components
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { EmptyState } from "../ui/EmptyState";

// Types
import type {
  Workflow,
  WorkflowId,
  WorkflowNode,
  WorkflowEdge,
  NodeId,
  Position,
} from "../../types/factory";

// Styles
import "./AgentFactory.css";

// =============================================================================
// TYPES
// =============================================================================

export interface AgentFactoryProps {
  /** Initial workflow ID to load */
  workflowId?: WorkflowId;
  /** Callback when workflow changes */
  onWorkflowChange?: (workflowId: WorkflowId | null) => void;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

interface PanelSizes {
  leftSidebar: number;
  rightSidebar: number;
  bottomPanel: number;
}

type BottomPanelTab = "console" | "monitor" | "audit" | "approvals";

interface Dialog {
  type: "open" | "save" | "settings" | "new" | "unsaved" | "template";
  data?: unknown;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_PANEL_SIZES: PanelSizes = {
  leftSidebar: 280,
  rightSidebar: 320,
  bottomPanel: 240,
};

const MIN_PANEL_SIZES: PanelSizes = {
  leftSidebar: 200,
  rightSidebar: 260,
  bottomPanel: 150,
};

const MAX_PANEL_SIZES: PanelSizes = {
  leftSidebar: 400,
  rightSidebar: 450,
  bottomPanel: 500,
};

const STORAGE_KEY_PANEL_SIZES = "factory_panel_sizes";
const STORAGE_KEY_LEFT_COLLAPSED = "factory_left_collapsed";
const STORAGE_KEY_RIGHT_COLLAPSED = "factory_right_collapsed";
const STORAGE_KEY_BOTTOM_COLLAPSED = "factory_bottom_collapsed";
const STORAGE_KEY_ACTIVE_TAB = "factory_active_tab";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function nodeDefinitionToWorkflowNode(
  def: NodeDefinition,
  position: Position
): Omit<WorkflowNode, "id"> {
  return {
    nodeType: def.type as any, // NodeType from factoryService
    label: def.label,
    x: position.x,
    y: position.y,
    config: def.defaultConfig || {},
    inputs: [{ id: "input", label: "In", dataType: "any", required: false }],
    outputs: [{ id: "output", label: "Out", dataType: "any", required: false }],
    disabled: false,
  };
}

function workflowNodeToCanvasNode(node: WorkflowNode, selected: boolean): CanvasNode {
  // Extract type string from NodeType union
  const getTypeString = (nodeType: WorkflowNode["nodeType"]): string => {
    if (typeof nodeType === "string") return nodeType;
    if (typeof nodeType === "object") {
      if ("trigger" in nodeType) return "trigger";
      if ("action" in nodeType) return "action";
    }
    return "unknown";
  };

  return {
    id: node.id,
    type: getTypeString(node.nodeType),
    x: node.x,
    y: node.y,
    width: 200,
    height: 100,
    data: { label: node.label, config: node.config },
    selected,
    inputs: node.inputs.map(p => ({ id: p.id, label: p.label })),
    outputs: node.outputs.map(p => ({ id: p.id, label: p.label })),
  };
}

function workflowEdgeToCanvasEdge(edge: WorkflowEdge, selected: boolean): CanvasEdge {
  return {
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourcePort || "output",
    target: edge.target,
    targetHandle: edge.targetPort || "input",
    type: "default" as any,
    animated: false,
    selected,
  };
}

// =============================================================================
// RESIZABLE HANDLE COMPONENT
// =============================================================================

interface ResizeHandleProps {
  direction: "horizontal" | "vertical";
  onResize: (delta: number) => void;
  inverted?: boolean;
}

function ResizeHandle(props: ResizeHandleProps) {
  const [isDragging, setIsDragging] = createSignal(false);
  let startPos = 0;

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startPos = props.direction === "horizontal" ? e.clientX : e.clientY;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = props.direction === "horizontal" ? e.clientX : e.clientY;
      const delta = (currentPos - startPos) * (props.inverted ? -1 : 1);
      props.onResize(delta);
      startPos = currentPos;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      class={`resize-handle resize-handle--${props.direction}`}
      classList={{ "resize-handle--active": isDragging() }}
      onMouseDown={handleMouseDown}
    />
  );
}

// =============================================================================
// TOOLBAR COMPONENT
// =============================================================================

interface ToolbarProps {
  workflowName: string;
  isDirty: boolean;
  isRunning: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onRun: () => void;
  onStop: () => void;
  onSettings: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onImport: () => void;
}

function Toolbar(props: ToolbarProps) {
  return (
    <div class="factory-toolbar">
      <div class="factory-toolbar__left">
        {/* File Operations */}
        <div class="factory-toolbar__group">
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onNew}
            title="New Workflow (Ctrl+N)"
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M12 2H5L4 3v9l1 1h7l1-1V3l-1-1zM5 12V3h6v9H5z" />
                <path d="M2 4v9l1 1h7v-1H3V4H2z" />
              </svg>
            }
          >
            New
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onOpen}
            title="Open Workflow (Ctrl+O)"
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M1 2v10l1 1h10l1-1V5l-1-1H7L6 3H2L1 2zm1 1h3l1 1h6v7H2V3z" />
              </svg>
            }
          >
            Open
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onSave}
            disabled={!props.isDirty}
            title="Save Workflow (Ctrl+S)"
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M11 1H3L1 3v8l2 2h8l2-2V3l-2-2zm0 2v3H3V3h8zM3 11V7h8v4H3z" />
                <path d="M8 4h1v1H8V4zM5 8h4v2H5V8z" />
              </svg>
            }
          >
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onSaveAs}
            title="Save As (Ctrl+Shift+S)"
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M11 1H3L1 3v8l2 2h8l2-2V3l-2-2zm0 2v3H3V3h8z" />
              </svg>
            }
          />
        </div>

        <div class="factory-toolbar__divider" />

        {/* Edit Operations */}
        <div class="factory-toolbar__group">
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onUndo}
            disabled={!props.canUndo}
            title="Undo (Ctrl+Z)"
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M4 5l3-3v2h3a4 4 0 0 1 0 8H6v-1h4a3 3 0 0 0 0-6H7v2L4 5z" />
              </svg>
            }
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onRedo}
            disabled={!props.canRedo}
            title="Redo (Ctrl+Y)"
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M10 5L7 2v2H4a4 4 0 0 0 0 8h4v-1H4a3 3 0 0 1 0-6h3v2l3-3z" />
              </svg>
            }
          />
        </div>
      </div>

      <div class="factory-toolbar__center">
        <div class="factory-toolbar__title">
          <span class="factory-toolbar__workflow-name">{props.workflowName || "Untitled Workflow"}</span>
          <Show when={props.isDirty}>
            <span class="factory-toolbar__dirty-indicator" title="Unsaved changes">*</span>
          </Show>
        </div>
      </div>

      <div class="factory-toolbar__right">
        {/* Import/Export */}
        <div class="factory-toolbar__group">
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onImport}
            title="Import Workflow"
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M7 1L3 5h3v4h2V5h3L7 1zM1 11v2h12v-2H1z" />
              </svg>
            }
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onExport}
            title="Export Workflow"
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M7 13l4-4h-3V5H6v4H3l4 4zM1 1v2h12V1H1z" />
              </svg>
            }
          />
        </div>

        <div class="factory-toolbar__divider" />

        {/* Run Controls */}
        <div class="factory-toolbar__group">
          <Show
            when={!props.isRunning}
            fallback={
              <Button
                variant="danger"
                size="sm"
                onClick={props.onStop}
                title="Stop Workflow (Shift+F5)"
                icon={
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M3 3h8v8H3V3z" />
                  </svg>
                }
              >
                Stop
              </Button>
            }
          >
            <Button
              variant="primary"
              size="sm"
              onClick={props.onRun}
              title="Run Workflow (F5)"
              icon={
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M3 2v10l9-5-9-5z" />
                </svg>
              }
            >
              Run
            </Button>
          </Show>
        </div>

        <div class="factory-toolbar__divider" />

        {/* Settings */}
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onSettings}
          title="Workflow Settings"
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm0 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
              <path d="M11.9 7.4l-1-.1c-.1-.3-.2-.6-.4-.8l.6-.9-.8-.8-.9.6c-.2-.1-.5-.3-.8-.4l-.1-1h-1l-.1 1c-.3.1-.6.2-.8.4l-.9-.6-.8.8.6.9c-.1.2-.3.5-.4.8l-1 .1v1l1 .1c.1.3.2.6.4.8l-.6.9.8.8.9-.6c.2.1.5.3.8.4l.1 1h1l.1-1c.3-.1.6-.2.8-.4l.9.6.8-.8-.6-.9c.1-.2.3-.5.4-.8l1-.1v-1z" />
            </svg>
          }
        />
      </div>
    </div>
  );
}

// =============================================================================
// BOTTOM PANEL TABS COMPONENT
// =============================================================================

interface BottomPanelTabsProps {
  activeTab: BottomPanelTab;
  onTabChange: (tab: BottomPanelTab) => void;
  approvalCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

function BottomPanelTabs(props: BottomPanelTabsProps) {
  const tabs: { id: BottomPanelTab; label: string; icon: JSX.Element }[] = [
    {
      id: "console",
      label: "Console",
      icon: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M1 2l1-1h8l1 1v8l-1 1H2l-1-1V2zm1 1v7h8V3H2z" />
          <path d="M3 6l2-1.5v3L3 6zM6 7h3v1H6V7z" />
        </svg>
      ),
    },
    {
      id: "monitor",
      label: "Live Monitor",
      icon: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 1a5 5 0 1 0 0 10A5 5 0 0 0 6 1zm0 9A4 4 0 1 1 6 2a4 4 0 0 1 0 8z" />
          <path d="M6 3v3l2 1-.4.8-2.6-1.3V3h1z" />
        </svg>
      ),
    },
    {
      id: "audit",
      label: "Audit Log",
      icon: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M1 2h10v1H1V2zM1 5h8v1H1V5zM1 8h10v1H1V8z" />
        </svg>
      ),
    },
    {
      id: "approvals",
      label: "Approvals",
      icon: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 1L2 3v4c0 3 2 5 4 6 2-1 4-3 4-6V3L6 1zm0 2l3 1.5v3c0 2-1.5 3.5-3 4.2-1.5-.7-3-2.2-3-4.2v-3L6 3z" />
        </svg>
      ),
    },
  ];

  return (
    <div class="factory-bottom-tabs">
      <div class="factory-bottom-tabs__list">
        <For each={tabs}>
          {(tab) => (
            <button
              class="factory-bottom-tabs__tab"
              classList={{ "factory-bottom-tabs__tab--active": props.activeTab === tab.id }}
              onClick={() => props.onTabChange(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <Show when={tab.id === "approvals" && props.approvalCount > 0}>
                <Badge variant="error" size="sm">{props.approvalCount}</Badge>
              </Show>
            </button>
          )}
        </For>
      </div>
      <button
        class="factory-bottom-tabs__toggle"
        onClick={props.onToggleCollapse}
        title={props.isCollapsed ? "Expand panel" : "Collapse panel"}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
          style={{
            transform: props.isCollapsed ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <path d="M2 4l4 4 4-4H2z" />
        </svg>
      </button>
    </div>
  );
}

// =============================================================================
// OPEN WORKFLOW DIALOG COMPONENT
// =============================================================================

interface OpenWorkflowDialogProps {
  open: boolean;
  workflows: Workflow[];
  onSelect: (workflowId: WorkflowId) => void;
  onClose: () => void;
}

function OpenWorkflowDialog(props: OpenWorkflowDialogProps) {
  const [searchQuery, setSearchQuery] = createSignal("");

  const filteredWorkflows = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return props.workflows;
    return props.workflows.filter(
      (w) =>
        w.name.toLowerCase().includes(query) ||
        (w.description?.toLowerCase().includes(query) ?? false)
    );
  });

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Open Workflow"
      size="lg"
    >
      <div class="factory-dialog__content">
        <Input
          placeholder="Search workflows..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M10 9l3 3-.7.7-3-3a5 5 0 1 1 .7-.7zM6 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
            </svg>
          }
        />
        <div class="factory-dialog__list">
          <Show
            when={filteredWorkflows().length > 0}
            fallback={
              <div class="factory-dialog__empty">
                No workflows found
              </div>
            }
          >
            <For each={filteredWorkflows()}>
              {(workflow) => (
                <button
                  class="factory-dialog__item"
                  onClick={() => props.onSelect(workflow.id)}
                >
                  <div class="factory-dialog__item-icon">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M3 4h14v2H3V4zM3 9h10v2H3V9zM3 14h14v2H3v-2z" />
                    </svg>
                  </div>
                  <div class="factory-dialog__item-content">
                    <div class="factory-dialog__item-name">{workflow.name}</div>
                    <div class="factory-dialog__item-description">
                      {workflow.description || "No description"}
                    </div>
                  </div>
                  <div class="factory-dialog__item-meta">
                    <Badge variant="default" size="sm">
                      {workflow.nodes.length} nodes
                    </Badge>
                  </div>
                </button>
              )}
            </For>
          </Show>
        </div>
      </div>
    </Modal>
  );
}

// =============================================================================
// SETTINGS DIALOG COMPONENT
// =============================================================================

interface SettingsDialogProps {
  open: boolean;
  workflow: Workflow | null;
  onSave: (settings: { name: string; description: string }) => void;
  onClose: () => void;
}

function SettingsDialog(props: SettingsDialogProps) {
  const [name, setName] = createSignal(props.workflow?.name || "");
  const [description, setDescription] = createSignal(props.workflow?.description || "");

  createEffect(() => {
    if (props.workflow) {
      setName(props.workflow.name);
      setDescription(props.workflow.description || "");
    }
  });

  const handleSave = () => {
    props.onSave({ name: name(), description: description() });
    props.onClose();
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Workflow Settings"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={props.onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save</Button>
        </>
      }
    >
      <div class="factory-dialog__form">
        <Input
          label="Workflow Name"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          placeholder="Enter workflow name..."
        />
        <Input
          label="Description"
          value={description()}
          onInput={(e) => setDescription(e.currentTarget.value)}
          placeholder="Enter description..."
        />
      </div>
    </Modal>
  );
}

// =============================================================================
// UNSAVED CHANGES DIALOG COMPONENT
// =============================================================================

interface UnsavedChangesDialogProps {
  open: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

function UnsavedChangesDialog(props: UnsavedChangesDialogProps) {
  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      title="Unsaved Changes"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={props.onCancel}>Cancel</Button>
          <Button variant="danger" onClick={props.onDiscard}>Discard</Button>
          <Button variant="primary" onClick={props.onSave}>Save</Button>
        </>
      }
    >
      <p style={{ color: "var(--jb-text-body-color)" }}>
        You have unsaved changes. Do you want to save them before continuing?
      </p>
    </Modal>
  );
}

// =============================================================================
// AGENT FACTORY INNER COMPONENT
// =============================================================================

function AgentFactoryInner(props: AgentFactoryProps) {
  const factory = useFactory();

  // ============================================================================
  // State
  // ============================================================================

  // Panel sizes from localStorage
  const [panelSizes, setPanelSizes] = useLocalStorage<PanelSizes>(
    STORAGE_KEY_PANEL_SIZES,
    DEFAULT_PANEL_SIZES
  );
  const [leftCollapsed, setLeftCollapsed] = useLocalStorage(STORAGE_KEY_LEFT_COLLAPSED, false);
  const [rightCollapsed, setRightCollapsed] = useLocalStorage(STORAGE_KEY_RIGHT_COLLAPSED, true);
  const [bottomCollapsed, setBottomCollapsed] = useLocalStorage(STORAGE_KEY_BOTTOM_COLLAPSED, false);
  const [activeBottomTab, setActiveBottomTab] = useLocalStorage<BottomPanelTab>(
    STORAGE_KEY_ACTIVE_TAB,
    "console"
  );

  // Workflow state
  const [workflowId, setWorkflowId] = createSignal<WorkflowId | null>(props.workflowId || null);
  const workflowHook = useWorkflow(() => workflowId(), {
    autoSaveDelay: 5000,
    onModified: (w) => { if (import.meta.env.DEV) console.log("[AgentFactory] Workflow modified:", w.name); },
  });

  // Execution state
  const [executionId, setExecutionId] = createSignal<string | null>(null);
  const executionHook = useExecution(() => executionId(), {
    onStart: (e) => { if (import.meta.env.DEV) console.log("[AgentFactory] Execution started:", e.id); },
    onComplete: (e) => { if (import.meta.env.DEV) console.log("[AgentFactory] Execution completed:", e.id); },
    onFail: (e) => { if (import.meta.env.DEV) console.log("[AgentFactory] Execution failed:", e.id); },
  });

  // Selection state
  const [selectedNodeIds, setSelectedNodeIds] = createSignal<Set<NodeId>>(new Set());
  const [selectedEdgeId, setSelectedEdgeId] = createSignal<string | null>(null);

  // Canvas state
  const [viewport, setViewport] = createSignal<CanvasViewport>({ x: 0, y: 0, zoom: 1 });
  const [isDraggingOver, setIsDraggingOver] = createSignal(false);

  // Dialog state
  const [activeDialog, setActiveDialog] = createSignal<Dialog | null>(null);
  const [pendingAction, setPendingAction] = createSignal<(() => void) | null>(null);

  // Console logs
  const [consoleLogs, setConsoleLogs] = createSignal<LogEntry[]>([]);

  // ============================================================================
  // Derived State
  // ============================================================================

  const workflow = workflowHook.workflow;
  const nodes = workflowHook.nodes;
  const edges = workflowHook.edges;
  const isDirty = workflowHook.isDirty;
  const canUndo = workflowHook.canUndo;
  const canRedo = workflowHook.canRedo;
  const isRunning = executionHook.isRunning;

  const selectedNode = createMemo((): FactoryNode | null => {
    const ids = selectedNodeIds();
    if (ids.size !== 1) return null;
    const nodeId = Array.from(ids)[0];
    const node = workflowHook.getNode(nodeId);
    if (!node) return null;
    
    // Extract type string from NodeType union
    const getTypeString = (nodeType: WorkflowNode["nodeType"]): string => {
      if (typeof nodeType === "string") return nodeType;
      if (typeof nodeType === "object") {
        if ("trigger" in nodeType) return "trigger";
        if ("action" in nodeType) return "action";
      }
      return "unknown";
    };
    
    const typeStr = getTypeString(node.nodeType);
    return {
      id: node.id,
      type: typeStr as FactoryNodeType,
      subtype: typeStr,
      label: node.label || typeStr,
      config: (node.config as Record<string, unknown>) || {},
      position: { x: node.x, y: node.y },
    };
  });

  const canvasNodes = createMemo((): CanvasNode[] => {
    return nodes().map((node) => workflowNodeToCanvasNode(node, selectedNodeIds().has(node.id)));
  });

  const canvasEdges = createMemo((): CanvasEdge[] => {
    return edges().map((edge) => workflowEdgeToCanvasEdge(edge, selectedEdgeId() === edge.id));
  });

  const approvalCount = factory.pendingApprovalCount;

  // ============================================================================
  // Handlers
  // ============================================================================

  // Node operations
  const handleNodeSelect = (nodeIds: string[], additive: boolean) => {
    batch(() => {
      setSelectedEdgeId(null);
      if (additive) {
        setSelectedNodeIds((prev) => {
          const next = new Set(prev);
          for (const id of nodeIds) {
            if (next.has(id)) {
              next.delete(id);
            } else {
              next.add(id);
            }
          }
          return next;
        });
      } else {
        setSelectedNodeIds(new Set(nodeIds));
      }
    });

    // Show inspector when node is selected
    if (nodeIds.length > 0 && rightCollapsed()) {
      setRightCollapsed(false);
    }
  };

  const handleNodeDrag = (nodeId: string, x: number, y: number) => {
    workflowHook.moveNode(nodeId, { x, y });
  };

  const handleNodeDragEnd = (_nodeIds: string[], _positions: { id: string; x: number; y: number }[]) => {
    // Position updates are already applied via moveNode
  };

  const handleDeleteSelected = () => {
    const nodeIds = Array.from(selectedNodeIds());
    const edgeId = selectedEdgeId();

    if (nodeIds.length > 0) {
      workflowHook.removeNodes(nodeIds);
      setSelectedNodeIds(new Set<string>());
    }
    if (edgeId) {
      workflowHook.removeEdge(edgeId);
      setSelectedEdgeId(null);
    }
  };

  const handleDeselectAll = () => {
    batch(() => {
      setSelectedNodeIds(new Set<string>());
      setSelectedEdgeId(null);
    });
  };

  // Edge operations
  const handleEdgeSelect = (edgeId: string | null) => {
    batch(() => {
      setSelectedNodeIds(new Set<string>());
      setSelectedEdgeId(edgeId);
    });
  };

  const handleEdgeCreate = (source: string, sourceHandle: string, target: string, targetHandle: string) => {
    workflowHook.addEdge({
      source,
      sourcePort: sourceHandle,
      target,
      targetPort: targetHandle,
    });
  };

  // Drag and drop from palette
  const handleDragOver = (e: DragEvent) => {
    if (e.dataTransfer?.types.includes("application/json")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const data = e.dataTransfer?.getData("application/json");
    if (!data) return;

    try {
      const nodeDef: NodeDefinition = JSON.parse(data);
      const canvasEl = e.currentTarget as HTMLElement;
      const rect = canvasEl.getBoundingClientRect();

      // Convert screen position to canvas position
      const vp = viewport();
      const x = (e.clientX - rect.left - vp.x) / vp.zoom;
      const y = (e.clientY - rect.top - vp.y) / vp.zoom;

      const nodeData = nodeDefinitionToWorkflowNode(nodeDef, { x, y });
      const newNode = workflowHook.addNode(nodeData);

      // Select the new node
      setSelectedNodeIds(new Set([newNode.id]));
    } catch (err) {
      console.error("[AgentFactory] Failed to parse dropped node:", err);
    }
  };

  const handleQuickAdd = (nodeDef: NodeDefinition) => {
    // Add node at center of visible canvas
    const vp = viewport();
    const centerX = (800 / 2 - vp.x) / vp.zoom;
    const centerY = (600 / 2 - vp.y) / vp.zoom;

    const nodeData = nodeDefinitionToWorkflowNode(nodeDef, { x: centerX, y: centerY });
    const newNode = workflowHook.addNode(nodeData);
    setSelectedNodeIds(new Set([newNode.id]));
  };

  // Inspector operations
  const handleNodeConfigApply = (nodeId: string, config: Record<string, unknown>) => {
    workflowHook.updateNode(nodeId, { config });
  };

  const handleNodeLabelChange = (nodeId: string, label: string) => {
    workflowHook.updateNode(nodeId, { label });
  };

  const handleNodeDelete = (nodeId: string) => {
    workflowHook.removeNode(nodeId);
    setSelectedNodeIds(new Set<string>());
  };

  // Toolbar operations
  const handleNew = () => {
    const createNew = async () => {
      try {
        const newWorkflow = await factory.createWorkflow({
          name: "Untitled Workflow",
          description: "",
        });
        setWorkflowId(newWorkflow.id);
        props.onWorkflowChange?.(newWorkflow.id);
      } catch (err) {
        console.error("[AgentFactory] Failed to create workflow:", err);
      }
    };

    if (isDirty()) {
      setPendingAction(() => createNew);
      setActiveDialog({ type: "unsaved" });
    } else {
      createNew();
    }
  };

  const handleOpen = () => {
    if (isDirty()) {
      setPendingAction(() => () => setActiveDialog({ type: "open" }));
      setActiveDialog({ type: "unsaved" });
    } else {
      setActiveDialog({ type: "open" });
    }
  };

  const handleOpenWorkflow = async (id: WorkflowId) => {
    try {
      await workflowHook.load(id);
      setWorkflowId(id);
      props.onWorkflowChange?.(id);
      setActiveDialog(null);
    } catch (err) {
      console.error("[AgentFactory] Failed to open workflow:", err);
    }
  };

  const handleSave = async () => {
    try {
      await workflowHook.save();
    } catch (err) {
      console.error("[AgentFactory] Failed to save workflow:", err);
    }
  };

  const handleSaveAs = async () => {
    setActiveDialog({ type: "save" });
  };

  const handleRun = async () => {
    const w = workflow();
    if (!w) return;

    try {
      // Validate first
      const validation = await factory.validateWorkflow(w.id);
      if (!validation.valid) {
        addLog("ERROR", `Validation failed: ${validation.errors.map((e) => e.message).join(", ")}`);
        return;
      }

      const execution = await executionHook.start(w.id);
      setExecutionId(execution.id);
      addLog("INFO", `Workflow execution started: ${execution.id}`);
    } catch (err) {
      console.error("[AgentFactory] Failed to start execution:", err);
      addLog("ERROR", `Failed to start execution: ${err}`);
    }
  };

  const handleStop = async () => {
    try {
      await executionHook.stop();
      addLog("INFO", "Workflow execution stopped");
    } catch (err) {
      console.error("[AgentFactory] Failed to stop execution:", err);
    }
  };

  const handleSettings = () => {
    setActiveDialog({ type: "settings" });
  };

  const handleSettingsSave = (settings: { name: string; description: string }) => {
    workflowHook.setName(settings.name);
    workflowHook.setDescription(settings.description);
  };

  const handleExport = () => {
    const json = workflowHook.toJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflow()?.name || "workflow"}.json`;
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
        const data = JSON.parse(text);
        const newWorkflow = await factory.createWorkflow({
          name: data.name || "Imported Workflow",
          description: data.description,
          nodes: data.nodes,
          edges: data.edges,
        });
        setWorkflowId(newWorkflow.id);
        props.onWorkflowChange?.(newWorkflow.id);
      } catch (err) {
        console.error("[AgentFactory] Failed to import workflow:", err);
      }
    };
    input.click();
  };

  // Unsaved changes dialog handlers
  const handleUnsavedSave = async () => {
    await handleSave();
    setActiveDialog(null);
    const action = pendingAction();
    if (action) {
      action();
      setPendingAction(null);
    }
  };

  const handleUnsavedDiscard = () => {
    workflowHook.reset();
    setActiveDialog(null);
    const action = pendingAction();
    if (action) {
      action();
      setPendingAction(null);
    }
  };

  const handleUnsavedCancel = () => {
    setActiveDialog(null);
    setPendingAction(null);
  };

  // Panel resize handlers
  const handleLeftResize = (delta: number) => {
    setPanelSizes((prev) => ({
      ...prev,
      leftSidebar: Math.max(MIN_PANEL_SIZES.leftSidebar, Math.min(MAX_PANEL_SIZES.leftSidebar, prev.leftSidebar + delta)),
    }));
  };

  const handleRightResize = (delta: number) => {
    setPanelSizes((prev) => ({
      ...prev,
      rightSidebar: Math.max(MIN_PANEL_SIZES.rightSidebar, Math.min(MAX_PANEL_SIZES.rightSidebar, prev.rightSidebar - delta)),
    }));
  };

  const handleBottomResize = (delta: number) => {
    setPanelSizes((prev) => ({
      ...prev,
      bottomPanel: Math.max(MIN_PANEL_SIZES.bottomPanel, Math.min(MAX_PANEL_SIZES.bottomPanel, prev.bottomPanel - delta)),
    }));
  };

  // Console log helper
  const addLog = (level: LogEntry["level"], message: string, details?: Record<string, unknown>) => {
    setConsoleLogs((prev) => [
      ...prev,
      {
        id: `log_${Date.now()}`,
        timestamp: new Date(),
        level,
        message,
        details,
      },
    ].slice(-500)); // Keep last 500 logs
  };

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  const handleKeyDown = (e: KeyboardEvent) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    // Prevent shortcuts when typing in input
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    switch (e.key) {
      case "s":
        if (isCtrl) {
          e.preventDefault();
          if (isShift) {
            handleSaveAs();
          } else {
            handleSave();
          }
        }
        break;

      case "o":
        if (isCtrl) {
          e.preventDefault();
          handleOpen();
        }
        break;

      case "n":
        if (isCtrl) {
          e.preventDefault();
          handleNew();
        }
        break;

      case "z":
        if (isCtrl) {
          e.preventDefault();
          if (isShift) {
            workflowHook.redo();
          } else {
            workflowHook.undo();
          }
        }
        break;

      case "y":
        if (isCtrl) {
          e.preventDefault();
          workflowHook.redo();
        }
        break;

      case "F5":
        e.preventDefault();
        if (isShift) {
          handleStop();
        } else {
          handleRun();
        }
        break;

      case "Delete":
      case "Backspace":
        if (selectedNodeIds().size > 0 || selectedEdgeId()) {
          e.preventDefault();
          handleDeleteSelected();
        }
        break;

      case "Escape":
        handleDeselectAll();
        break;
    }
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);

    // Load initial workflow if provided
    if (props.workflowId) {
      workflowHook.load(props.workflowId).catch(console.error);
    }
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div class="agent-factory" style={props.style}>
      {/* Toolbar */}
      <Toolbar
        workflowName={workflow()?.name || ""}
        isDirty={isDirty()}
        isRunning={isRunning()}
        canUndo={canUndo()}
        canRedo={canRedo()}
        onNew={handleNew}
        onOpen={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onRun={handleRun}
        onStop={handleStop}
        onSettings={handleSettings}
        onUndo={workflowHook.undo}
        onRedo={workflowHook.redo}
        onExport={handleExport}
        onImport={handleImport}
      />

      {/* Main Content Area */}
      <div class="agent-factory__content">
        {/* Left Sidebar - Node Palette */}
        <Show when={!leftCollapsed()}>
          <div
            class="agent-factory__sidebar agent-factory__sidebar--left"
            style={{ width: `${panelSizes().leftSidebar}px` }}
          >
            <div class="agent-factory__sidebar-header">
              <span>Nodes</span>
              <button
                class="agent-factory__sidebar-toggle"
                onClick={() => setLeftCollapsed(true)}
                title="Collapse sidebar"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M8 2L4 6l4 4V2z" />
                </svg>
              </button>
            </div>
            <NodePalette
              onDragStart={(_node, _e) => {}}
              onDragEnd={(_node, _e) => {}}
              onQuickAdd={handleQuickAdd}
            />
            <ResizeHandle
              direction="horizontal"
              onResize={handleLeftResize}
            />
          </div>
        </Show>

        {/* Collapsed Left Sidebar Toggle */}
        <Show when={leftCollapsed()}>
          <button
            class="agent-factory__collapsed-toggle agent-factory__collapsed-toggle--left"
            onClick={() => setLeftCollapsed(false)}
            title="Show nodes panel"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M4 2l4 4-4 4V2z" />
            </svg>
          </button>
        </Show>

        {/* Center - Canvas */}
        <div
          class="agent-factory__canvas-container"
          classList={{ "agent-factory__canvas-container--dropping": isDraggingOver() }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Show
            when={workflow()}
            fallback={
              <EmptyState
                icon={
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor">
                    <path d="M24 4L8 12v24l16 8 16-8V12L24 4zm0 4l12 6-12 6-12-6 12-6zM12 18l10 5v14l-10-5V18zm24 0v14l-10 5V23l10-5z" />
                  </svg>
                }
                title="No Workflow Open"
                description="Create a new workflow or open an existing one to get started"
              >
                <div style={{ display: "flex", gap: "8px", "margin-top": "16px" }}>
                  <Button variant="primary" onClick={handleNew}>New Workflow</Button>
                  <Button variant="secondary" onClick={handleOpen}>Open Workflow</Button>
                </div>
              </EmptyState>
            }
          >
            <FactoryCanvas
              nodes={canvasNodes()}
              edges={canvasEdges()}
              viewport={viewport()}
              onNodeSelect={handleNodeSelect}
              onNodeDrag={handleNodeDrag}
              onNodeDragEnd={handleNodeDragEnd}
              onEdgeSelect={handleEdgeSelect}
              onEdgeCreate={handleEdgeCreate}
              onCanvasClick={handleDeselectAll}
              onDeleteSelected={handleDeleteSelected}
              onViewportChange={setViewport}
              onUndo={workflowHook.undo}
              onRedo={workflowHook.redo}
              canUndo={canUndo()}
              canRedo={canRedo()}
            />
          </Show>
        </div>

        {/* Collapsed Right Sidebar Toggle */}
        <Show when={rightCollapsed()}>
          <button
            class="agent-factory__collapsed-toggle agent-factory__collapsed-toggle--right"
            onClick={() => setRightCollapsed(false)}
            title="Show inspector panel"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M8 2L4 6l4 4V2z" />
            </svg>
          </button>
        </Show>

        {/* Right Sidebar - Inspector */}
        <Show when={!rightCollapsed()}>
          <div
            class="agent-factory__sidebar agent-factory__sidebar--right"
            style={{ width: `${panelSizes().rightSidebar}px` }}
          >
            <ResizeHandle
              direction="horizontal"
              onResize={handleRightResize}
              inverted
            />
            <div class="agent-factory__sidebar-header">
              <span>Inspector</span>
              <button
                class="agent-factory__sidebar-toggle"
                onClick={() => setRightCollapsed(true)}
                title="Collapse sidebar"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M4 2l4 4-4 4V2z" />
                </svg>
              </button>
            </div>
            <Inspector
              selectedNode={selectedNode()}
              onApply={handleNodeConfigApply}
              onLabelChange={handleNodeLabelChange}
              onDelete={handleNodeDelete}
            />
          </div>
        </Show>
      </div>

      {/* Bottom Panel */}
      <div
        class="agent-factory__bottom"
        classList={{ "agent-factory__bottom--collapsed": bottomCollapsed() }}
        style={{ height: bottomCollapsed() ? "36px" : `${panelSizes().bottomPanel}px` }}
      >
        <ResizeHandle
          direction="vertical"
          onResize={handleBottomResize}
        />
        <BottomPanelTabs
          activeTab={activeBottomTab()}
          onTabChange={setActiveBottomTab}
          approvalCount={approvalCount()}
          isCollapsed={bottomCollapsed()}
          onToggleCollapse={() => setBottomCollapsed(!bottomCollapsed())}
        />
        <Show when={!bottomCollapsed()}>
          <div class="agent-factory__bottom-content">
            <Show when={activeBottomTab() === "console"}>
              <ConsolePanel
                logs={consoleLogs()}
                onClear={() => setConsoleLogs([])}
              />
            </Show>
            <Show when={activeBottomTab() === "monitor"}>
              <LiveMonitor
                agents={factory.agents().map((agent): ActiveAgent => ({
                  id: agent.id,
                  name: agent.name,
                  status: agent.status === "waiting_approval" ? "waiting" : agent.status,
                  currentStep: agent.currentStep?.stepNumber ?? 0,
                  maxSteps: agent.config.maxSteps,
                  currentActivity: agent.currentStep?.description,
                  currentTool: agent.currentStep?.stepType === "tool_call" ? String(agent.currentStep.input ?? "") : undefined,
                  tokenUsage: { input: 0, output: 0, total: 0 }, // Token usage not tracked in AgentRuntimeState
                  startTime: new Date(agent.createdAt),
                  steps: agent.stepHistory.map((step) => ({
                    id: `${agent.id}_step_${step.stepNumber}`,
                    type: step.stepType === "tool_call" ? "tool" : step.stepType === "thinking" ? "thinking" : step.stepType === "assistant_message" ? "output" : "decision",
                    name: step.description,
                    status: step.status === "cancelled" || step.status === "skipped" ? "failed" : step.status,
                    startTime: new Date(step.startedAt),
                    endTime: step.completedAt ? new Date(step.completedAt) : undefined,
                    result: step.output ? String(step.output) : undefined,
                    error: step.error,
                  })),
                  isSupervisor: false, // Could be determined from agent config if available
                }))}
                onPauseAgent={(id) => {
                  window.dispatchEvent(new CustomEvent("factory:pause-agent", { detail: { id } }));
                }}
                onResumeAgent={(id) => {
                  window.dispatchEvent(new CustomEvent("factory:resume-agent", { detail: { id } }));
                }}
                onStopAgent={(id) => {
                  window.dispatchEvent(new CustomEvent("factory:stop-agent", { detail: { id } }));
                }}
              />
            </Show>
            <Show when={activeBottomTab() === "audit"}>
              <AuditLog
                entries={factory.auditEntries() as any[]}
                onExport={(format) => {
                  const filename = `audit_log_${Date.now()}.${format}`;
                  factory.exportAuditLog(filename);
                }}
              />
            </Show>
            <Show when={activeBottomTab() === "approvals"}>
              <ApprovalsPanel
                requests={factory.pendingApprovals() as any[]}
                onApprove={(id) => factory.approveAction(id)}
                onDeny={(id, reason) => factory.denyAction(id, reason)}
              />
            </Show>
          </div>
        </Show>
      </div>

      {/* Dialogs */}
      <OpenWorkflowDialog
        open={activeDialog()?.type === "open"}
        workflows={factory.workflows()}
        onSelect={handleOpenWorkflow}
        onClose={() => setActiveDialog(null)}
      />

      <SettingsDialog
        open={activeDialog()?.type === "settings"}
        workflow={workflow()}
        onSave={handleSettingsSave}
        onClose={() => setActiveDialog(null)}
      />

      <UnsavedChangesDialog
        open={activeDialog()?.type === "unsaved"}
        onSave={handleUnsavedSave}
        onDiscard={handleUnsavedDiscard}
        onCancel={handleUnsavedCancel}
      />
    </div>
  );
}

// =============================================================================
// AGENT FACTORY COMPONENT (WITH PROVIDER)
// =============================================================================

export function AgentFactory(props: AgentFactoryProps) {
  return (
    <FactoryProvider>
      <AgentFactoryInner {...props} />
    </FactoryProvider>
  );
}

export default AgentFactory;
