/**
 * useWorkflow - Workflow editing hook with undo/redo support
 */

import { createSignal, createMemo, createEffect, onCleanup, Accessor } from "solid-js";

import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowSettings,
} from "../../types/factory";

// Type aliases
type WorkflowId = string;
type NodeId = string;
type EdgeId = string;

// Position interface for node coordinates
interface Position {
  x: number;
  y: number;
}

// Variable definition for workflow inputs/outputs
interface WorkflowVariable {
  name: string;
  type: string;
  defaultValue?: unknown;
  required?: boolean;
}

// Mutation tracking types
type WorkflowMutationType =
  | "add_node"
  | "update_node"
  | "remove_node"
  | "move_node"
  | "add_edge"
  | "update_edge"
  | "remove_edge"
  | "bulk_update"
  | "update_settings"
  | "update_inputs"
  | "update_outputs";

interface WorkflowMutation {
  type: WorkflowMutationType;
  description: string;
  before: unknown;
  after: unknown;
  timestamp: number;
}

// Extended Workflow type with inputs/outputs for the hook (may not be in backend yet)
interface ExtendedWorkflow extends Workflow {
  inputs?: WorkflowVariable[];
  outputs?: WorkflowVariable[];
}

import { useFactory } from "../../context/FactoryContext";

// ============================================================================
// Types
// ============================================================================

export interface UseWorkflowOptions {
  /** Maximum undo history size */
  maxHistorySize?: number;
  /** Auto-save delay in ms (0 to disable) */
  autoSaveDelay?: number;
  /** Called when workflow is modified */
  onModified?: (workflow: Workflow) => void;
}

export interface UseWorkflowReturn {
  // Workflow data
  workflow: Accessor<ExtendedWorkflow | null>;
  nodes: Accessor<WorkflowNode[]>;
  edges: Accessor<WorkflowEdge[]>;
  isLoading: Accessor<boolean>;
  isDirty: Accessor<boolean>;
  error: Accessor<string | null>;

  // Node operations
  addNode: (node: Omit<WorkflowNode, "id">) => WorkflowNode;
  updateNode: (nodeId: NodeId, updates: Partial<WorkflowNode>) => void;
  removeNode: (nodeId: NodeId) => void;
  moveNode: (nodeId: NodeId, position: Position) => void;
  duplicateNode: (nodeId: NodeId) => WorkflowNode | null;

  // Edge operations
  addEdge: (edge: Omit<WorkflowEdge, "id">) => WorkflowEdge;
  updateEdge: (edgeId: EdgeId, updates: Partial<WorkflowEdge>) => void;
  removeEdge: (edgeId: EdgeId) => void;

  // Bulk operations
  removeNodes: (nodeIds: NodeId[]) => void;
  removeEdges: (edgeIds: EdgeId[]) => void;

  // Selection helpers
  getNode: (nodeId: NodeId) => WorkflowNode | undefined;
  getEdge: (edgeId: EdgeId) => WorkflowEdge | undefined;
  getConnectedEdges: (nodeId: NodeId) => WorkflowEdge[];
  getIncomingEdges: (nodeId: NodeId) => WorkflowEdge[];
  getOutgoingEdges: (nodeId: NodeId) => WorkflowEdge[];

  // Workflow operations
  load: (workflowId: WorkflowId) => Promise<void>;
  save: () => Promise<Workflow>;
  updateSettings: (settings: Partial<WorkflowSettings>) => void;
  updateInputs: (inputs: WorkflowVariable[]) => void;
  updateOutputs: (outputs: WorkflowVariable[]) => void;
  setName: (name: string) => void;
  setDescription: (description: string) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: Accessor<boolean>;
  canRedo: Accessor<boolean>;
  clearHistory: () => void;

  // Utility
  reset: () => void;
  toJSON: () => string;
}

// ============================================================================
// ID Generation
// ============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useWorkflow(
  workflowId?: Accessor<WorkflowId | null>,
  options: UseWorkflowOptions = {}
): UseWorkflowReturn {
  const {
    maxHistorySize = 50,
    autoSaveDelay = 0,
    onModified,
  } = options;

  const factory = useFactory();

  // ============================================================================
  // State
  // ============================================================================

  const [workflow, setWorkflow] = createSignal<ExtendedWorkflow | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isDirty, setIsDirty] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Undo/Redo history
  const [undoStack, setUndoStack] = createSignal<WorkflowMutation[]>([]);
  const [redoStack, setRedoStack] = createSignal<WorkflowMutation[]>([]);

  // Auto-save timer
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  // ============================================================================
  // Computed
  // ============================================================================

  const nodes = createMemo(() => workflow()?.nodes ?? []);
  const edges = createMemo(() => workflow()?.edges ?? []);
  const canUndo = createMemo(() => undoStack().length > 0);
  const canRedo = createMemo(() => redoStack().length > 0);

  // ============================================================================
  // History Management
  // ============================================================================

  const pushToHistory = (mutation: Omit<WorkflowMutation, "timestamp">): void => {
    const fullMutation: WorkflowMutation = {
      ...mutation,
      timestamp: Date.now(),
    };

    setUndoStack((prev) => {
      const newStack = [...prev, fullMutation];
      // Limit history size
      if (newStack.length > maxHistorySize) {
        return newStack.slice(-maxHistorySize);
      }
      return newStack;
    });

    // Clear redo stack on new mutation
    setRedoStack([]);
  };

  const clearHistory = (): void => {
    setUndoStack([]);
    setRedoStack([]);
  };

  // ============================================================================
  // Workflow Modification
  // ============================================================================

  const modifyWorkflow = (
    mutationType: WorkflowMutationType,
    description: string,
    modifier: (w: Workflow) => void,
    getBefore: () => unknown,
    getAfter: () => unknown
  ): void => {
    const current = workflow();
    if (!current) return;

    const before = getBefore();

    // Apply modification
    const updated = { ...current };
    modifier(updated);
    updated.updatedAt = Date.now();

    setWorkflow(updated);
    setIsDirty(true);

    // Push to history
    pushToHistory({
      type: mutationType,
      description,
      before,
      after: getAfter(),
    });

    // Trigger callbacks
    onModified?.(updated);

    // Schedule auto-save
    if (autoSaveDelay > 0) {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
      autoSaveTimer = setTimeout(() => {
        save().catch(console.error);
      }, autoSaveDelay);
    }
  };

  // ============================================================================
  // Node Operations
  // ============================================================================

  const addNode = (nodeData: Omit<WorkflowNode, "id">): WorkflowNode => {
    const newNode: WorkflowNode = {
      ...nodeData,
      id: generateId("node"),
    };

    modifyWorkflow(
      "add_node",
      `Add ${nodeData.label} node`,
      (w) => {
        w.nodes = [...w.nodes, newNode];
      },
      () => null,
      () => newNode
    );

    return newNode;
  };

  const updateNode = (nodeId: NodeId, updates: Partial<WorkflowNode>): void => {
    const current = workflow();
    if (!current) return;

    const existingNode = current.nodes.find((n) => n.id === nodeId);
    if (!existingNode) return;

    modifyWorkflow(
      "update_node",
      `Update ${existingNode.label} node`,
      (w) => {
        w.nodes = w.nodes.map((n) =>
          n.id === nodeId ? { ...n, ...updates } : n
        );
      },
      () => ({ ...existingNode }),
      () => ({ ...existingNode, ...updates })
    );
  };

  const removeNode = (nodeId: NodeId): void => {
    const current = workflow();
    if (!current) return;

    const existingNode = current.nodes.find((n) => n.id === nodeId);
    if (!existingNode) return;

    // Also remove connected edges
    const connectedEdges = current.edges.filter(
      (e) => e.source === nodeId || e.target === nodeId
    );

    modifyWorkflow(
      "remove_node",
      `Remove ${existingNode.label} node`,
      (w) => {
        w.nodes = w.nodes.filter((n) => n.id !== nodeId);
        w.edges = w.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        );
      },
      () => ({ node: existingNode, edges: connectedEdges }),
      () => null
    );
  };

  const moveNode = (nodeId: NodeId, position: Position): void => {
    const current = workflow();
    if (!current) return;

    const existingNode = current.nodes.find((n) => n.id === nodeId);
    if (!existingNode) return;

    modifyWorkflow(
      "move_node",
      `Move ${existingNode.label} node`,
      (w) => {
        w.nodes = w.nodes.map((n) =>
          n.id === nodeId ? { ...n, x: position.x, y: position.y } : n
        );
      },
      () => ({ x: existingNode.x, y: existingNode.y }),
      () => position
    );
  };

  const duplicateNode = (nodeId: NodeId): WorkflowNode | null => {
    const current = workflow();
    if (!current) return null;

    const existingNode = current.nodes.find((n) => n.id === nodeId);
    if (!existingNode) return null;

    const newNode: WorkflowNode = {
      ...existingNode,
      id: generateId("node"),
      x: existingNode.x + 50,
      y: existingNode.y + 50,
      label: `${existingNode.label} (copy)`,
    };

    modifyWorkflow(
      "add_node",
      `Duplicate ${existingNode.label} node`,
      (w) => {
        w.nodes = [...w.nodes, newNode];
      },
      () => null,
      () => newNode
    );

    return newNode;
  };

  // ============================================================================
  // Edge Operations
  // ============================================================================

  const addEdge = (edgeData: Omit<WorkflowEdge, "id">): WorkflowEdge => {
    const newEdge: WorkflowEdge = {
      ...edgeData,
      id: generateId("edge"),
    };

    modifyWorkflow(
      "add_edge",
      `Connect nodes`,
      (w) => {
        w.edges = [...w.edges, newEdge];
      },
      () => null,
      () => newEdge
    );

    return newEdge;
  };

  const updateEdge = (edgeId: EdgeId, updates: Partial<WorkflowEdge>): void => {
    const current = workflow();
    if (!current) return;

    const existingEdge = current.edges.find((e) => e.id === edgeId);
    if (!existingEdge) return;

    modifyWorkflow(
      "update_edge",
      `Update connection`,
      (w) => {
        w.edges = w.edges.map((e) =>
          e.id === edgeId ? { ...e, ...updates } : e
        );
      },
      () => ({ ...existingEdge }),
      () => ({ ...existingEdge, ...updates })
    );
  };

  const removeEdge = (edgeId: EdgeId): void => {
    const current = workflow();
    if (!current) return;

    const existingEdge = current.edges.find((e) => e.id === edgeId);
    if (!existingEdge) return;

    modifyWorkflow(
      "remove_edge",
      `Remove connection`,
      (w) => {
        w.edges = w.edges.filter((e) => e.id !== edgeId);
      },
      () => existingEdge,
      () => null
    );
  };

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  const removeNodes = (nodeIds: NodeId[]): void => {
    const current = workflow();
    if (!current) return;

    const nodesToRemove = current.nodes.filter((n) => nodeIds.includes(n.id));
    const edgesToRemove = current.edges.filter(
      (e) => nodeIds.includes(e.source) || nodeIds.includes(e.target)
    );

    modifyWorkflow(
      "bulk_update",
      `Remove ${nodeIds.length} nodes`,
      (w) => {
        w.nodes = w.nodes.filter((n) => !nodeIds.includes(n.id));
        w.edges = w.edges.filter(
          (e) => !nodeIds.includes(e.source) && !nodeIds.includes(e.target)
        );
      },
      () => ({ nodes: nodesToRemove, edges: edgesToRemove }),
      () => null
    );
  };

  const removeEdges = (edgeIds: EdgeId[]): void => {
    const current = workflow();
    if (!current) return;

    const edgesToRemove = current.edges.filter((e) => edgeIds.includes(e.id));

    modifyWorkflow(
      "bulk_update",
      `Remove ${edgeIds.length} connections`,
      (w) => {
        w.edges = w.edges.filter((e) => !edgeIds.includes(e.id));
      },
      () => edgesToRemove,
      () => null
    );
  };

  // ============================================================================
  // Selection Helpers
  // ============================================================================

  const getNode = (nodeId: NodeId): WorkflowNode | undefined => {
    return nodes().find((n) => n.id === nodeId);
  };

  const getEdge = (edgeId: EdgeId): WorkflowEdge | undefined => {
    return edges().find((e) => e.id === edgeId);
  };

  const getConnectedEdges = (nodeId: NodeId): WorkflowEdge[] => {
    return edges().filter((e) => e.source === nodeId || e.target === nodeId);
  };

  const getIncomingEdges = (nodeId: NodeId): WorkflowEdge[] => {
    return edges().filter((e) => e.target === nodeId);
  };

  const getOutgoingEdges = (nodeId: NodeId): WorkflowEdge[] => {
    return edges().filter((e) => e.source === nodeId);
  };

  // ============================================================================
  // Workflow Operations
  // ============================================================================

  const load = async (id: WorkflowId): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const loaded = await factory.loadWorkflow(id);
      setWorkflow(loaded as ExtendedWorkflow | null);
      setIsDirty(false);
      clearHistory();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load workflow";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const save = async (): Promise<Workflow> => {
    const current = workflow();
    if (!current) {
      throw new Error("No workflow to save");
    }

    try {
      // Pass the full workflow object as expected by updateWorkflow(workflow: Workflow)
      // Cast to Workflow since inputs/outputs may not be in the backend type
      const saved = await factory.updateWorkflow(current as Workflow);

      setWorkflow(saved as ExtendedWorkflow);
      setIsDirty(false);

      return saved;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save workflow";
      setError(message);
      throw e;
    }
  };

  const updateSettings = (settings: Partial<WorkflowSettings>): void => {
    const current = workflow();
    if (!current) return;

    modifyWorkflow(
      "update_settings",
      "Update workflow settings",
      (w) => {
        w.settings = { ...w.settings, ...settings };
      },
      () => current.settings,
      () => ({ ...current.settings, ...settings })
    );
  };

  const updateInputs = (inputs: WorkflowVariable[]): void => {
    const current = workflow();
    if (!current) return;

    modifyWorkflow(
      "update_inputs",
      "Update workflow inputs",
      (w) => {
        (w as ExtendedWorkflow).inputs = inputs;
      },
      () => (current as ExtendedWorkflow).inputs,
      () => inputs
    );
  };

  const updateOutputs = (outputs: WorkflowVariable[]): void => {
    const current = workflow();
    if (!current) return;

    modifyWorkflow(
      "update_outputs",
      "Update workflow outputs",
      (w) => {
        (w as ExtendedWorkflow).outputs = outputs;
      },
      () => (current as ExtendedWorkflow).outputs,
      () => outputs
    );
  };

  const setName = (name: string): void => {
    const current = workflow();
    if (!current) return;

    modifyWorkflow(
      "bulk_update",
      "Update workflow name",
      (w) => {
        w.name = name;
      },
      () => current.name,
      () => name
    );
  };

  const setDescription = (description: string): void => {
    const current = workflow();
    if (!current) return;

    modifyWorkflow(
      "bulk_update",
      "Update workflow description",
      (w) => {
        w.description = description;
      },
      () => current.description,
      () => description
    );
  };

  // ============================================================================
  // Undo/Redo - Full Implementation
  // ============================================================================

  const applyMutation = (mutation: WorkflowMutation, isUndo: boolean): void => {
    const current = workflow();
    if (!current) return;

    const updated = { ...current };
    const data = isUndo ? mutation.before : mutation.after;

    switch (mutation.type) {
      case "add_node": {
        if (isUndo) {
          // Remove the added node
          const nodeToRemove = mutation.after as WorkflowNode;
          updated.nodes = updated.nodes.filter((n) => n.id !== nodeToRemove.id);
          // Also remove any edges connected to this node
          updated.edges = updated.edges.filter(
            (e) => e.source !== nodeToRemove.id && e.target !== nodeToRemove.id
          );
        } else {
          // Re-add the node
          const nodeToAdd = mutation.after as WorkflowNode;
          if (!updated.nodes.find((n) => n.id === nodeToAdd.id)) {
            updated.nodes = [...updated.nodes, nodeToAdd];
          }
        }
        break;
      }

      case "update_node": {
        const nodeData = data as WorkflowNode;
        updated.nodes = updated.nodes.map((n) =>
          n.id === nodeData.id ? nodeData : n
        );
        break;
      }

      case "remove_node": {
        const removedData = mutation.before as { node: WorkflowNode; edges: WorkflowEdge[] };
        if (isUndo) {
          // Restore the removed node and its edges
          if (!updated.nodes.find((n) => n.id === removedData.node.id)) {
            updated.nodes = [...updated.nodes, removedData.node];
          }
          // Restore connected edges
          for (const edge of removedData.edges) {
            if (!updated.edges.find((e) => e.id === edge.id)) {
              updated.edges = [...updated.edges, edge];
            }
          }
        } else {
          // Re-remove the node and edges
          updated.nodes = updated.nodes.filter((n) => n.id !== removedData.node.id);
          const edgeIds = new Set(removedData.edges.map((e) => e.id));
          updated.edges = updated.edges.filter((e) => !edgeIds.has(e.id));
        }
        break;
      }

      case "move_node": {
        const position = data as Position;
        // Find the node that was moved by checking positions
        const targetPos = isUndo ? mutation.after as Position : mutation.before as Position;
        const movedNode = updated.nodes.find((n) => 
          n.x === targetPos.x && n.y === targetPos.y
        );
        if (movedNode) {
          updated.nodes = updated.nodes.map((n) =>
            n.id === movedNode.id ? { ...n, x: position.x, y: position.y } : n
          );
        }
        break;
      }

      case "add_edge": {
        if (isUndo) {
          // Remove the added edge
          const edgeToRemove = mutation.after as WorkflowEdge;
          updated.edges = updated.edges.filter((e) => e.id !== edgeToRemove.id);
        } else {
          // Re-add the edge
          const edgeToAdd = mutation.after as WorkflowEdge;
          if (!updated.edges.find((e) => e.id === edgeToAdd.id)) {
            updated.edges = [...updated.edges, edgeToAdd];
          }
        }
        break;
      }

      case "update_edge": {
        const edgeData = data as WorkflowEdge;
        updated.edges = updated.edges.map((e) =>
          e.id === edgeData.id ? edgeData : e
        );
        break;
      }

      case "remove_edge": {
        const removedEdge = mutation.before as WorkflowEdge;
        if (isUndo) {
          // Restore the removed edge
          if (!updated.edges.find((e) => e.id === removedEdge.id)) {
            updated.edges = [...updated.edges, removedEdge];
          }
        } else {
          // Re-remove the edge
          updated.edges = updated.edges.filter((e) => e.id !== removedEdge.id);
        }
        break;
      }

      case "bulk_update": {
        // For bulk updates, we store complete before/after states for affected items
        const bulkData = data as { nodes?: WorkflowNode[]; edges?: WorkflowEdge[] } | null;
        if (bulkData) {
          if (isUndo && mutation.before) {
            // Restore previous state
            const beforeData = mutation.before as { nodes?: WorkflowNode[]; edges?: WorkflowEdge[] };
            if (beforeData.nodes) {
              // Re-add removed nodes
              for (const node of beforeData.nodes) {
                if (!updated.nodes.find((n) => n.id === node.id)) {
                  updated.nodes = [...updated.nodes, node];
                }
              }
            }
            if (beforeData.edges) {
              // Re-add removed edges
              for (const edge of beforeData.edges) {
                if (!updated.edges.find((e) => e.id === edge.id)) {
                  updated.edges = [...updated.edges, edge];
                }
              }
            }
          } else if (!isUndo && mutation.before) {
            // Re-apply the removal
            const beforeData = mutation.before as { nodes?: WorkflowNode[]; edges?: WorkflowEdge[] };
            if (beforeData.nodes) {
              const nodeIds = new Set(beforeData.nodes.map((n) => n.id));
              updated.nodes = updated.nodes.filter((n) => !nodeIds.has(n.id));
            }
            if (beforeData.edges) {
              const edgeIds = new Set(beforeData.edges.map((e) => e.id));
              updated.edges = updated.edges.filter((e) => !edgeIds.has(e.id));
            }
          }
        }
        // Handle name/description changes
        if (typeof mutation.before === "string" && typeof mutation.after === "string") {
          if (mutation.description.includes("name")) {
            updated.name = isUndo ? (mutation.before as string) : (mutation.after as string);
          } else if (mutation.description.includes("description")) {
            updated.description = isUndo ? (mutation.before as string) : (mutation.after as string);
          }
        }
        break;
      }

      case "update_settings": {
        updated.settings = data as WorkflowSettings;
        break;
      }

      case "update_inputs": {
        (updated as ExtendedWorkflow).inputs = data as WorkflowVariable[];
        break;
      }

      case "update_outputs": {
        (updated as ExtendedWorkflow).outputs = data as WorkflowVariable[];
        break;
      }

      default:
        console.warn("[useWorkflow] Unknown mutation type:", mutation.type);
    }

    updated.updatedAt = Date.now();
    setWorkflow(updated);
    setIsDirty(true);
  };

  const undo = (): void => {
    const stack = undoStack();
    if (stack.length === 0) return;

    const mutation = stack[stack.length - 1];
    const current = workflow();
    if (!current) return;

    // Apply reverse mutation
    applyMutation(mutation, true);

    // Update stacks
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, mutation]);

    if (import.meta.env.DEV) console.log("[useWorkflow] Undo:", mutation.description);
  };

  const redo = (): void => {
    const stack = redoStack();
    if (stack.length === 0) return;

    const mutation = stack[stack.length - 1];
    const current = workflow();
    if (!current) return;

    // Re-apply mutation
    applyMutation(mutation, false);

    // Update stacks
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, mutation]);

    if (import.meta.env.DEV) console.log("[useWorkflow] Redo:", mutation.description);
  };

  // ============================================================================
  // Utility
  // ============================================================================

  const reset = (): void => {
    setWorkflow(null);
    setIsDirty(false);
    setError(null);
    clearHistory();
  };

  const toJSON = (): string => {
    const current = workflow();
    if (!current) return "null";
    return JSON.stringify(current, null, 2);
  };

  // ============================================================================
  // Effects
  // ============================================================================

  // Load workflow when ID changes
  createEffect(() => {
    const id = workflowId?.();
    if (id) {
      load(id).catch(console.error);
    } else {
      reset();
    }
  });

  // Cleanup
  onCleanup(() => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
  });

  // ============================================================================
  // Return
  // ============================================================================

  return {
    workflow,
    nodes,
    edges,
    isLoading,
    isDirty,
    error,

    addNode,
    updateNode,
    removeNode,
    moveNode,
    duplicateNode,

    addEdge,
    updateEdge,
    removeEdge,

    removeNodes,
    removeEdges,

    getNode,
    getEdge,
    getConnectedEdges,
    getIncomingEdges,
    getOutgoingEdges,

    load,
    save,
    updateSettings,
    updateInputs,
    updateOutputs,
    setName,
    setDescription,

    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,

    reset,
    toJSON,
  };
}
