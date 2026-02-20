/**
 * SubAgentContext - Manage custom sub-agents for AI tasks
 * 
 * Provides CRUD operations for sub-agents that can be:
 * - code: Writing, implementing, and modifying code
 * - research: Investigating codebases, finding patterns, understanding architecture
 * - refactor: Restructuring and improving existing code across multiple files
 */

import { createContext, useContext, createSignal, onCleanup, JSX } from "solid-js";
import { createStore } from "solid-js/store";

// ============================================================================
// Types
// ============================================================================

export type SubAgentType = "code" | "research" | "refactor" | "custom";

export interface SubAgent {
  id: string;
  name: string;
  type: SubAgentType;
  description: string;
  systemPrompt: string;
  createdAt: number;
  updatedAt: number;
  isBuiltIn: boolean;
}

export interface SubAgentState {
  agents: SubAgent[];
  selectedAgentId: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface SubAgentContextValue {
  state: SubAgentState;
  
  // CRUD operations
  createAgent: (agent: Omit<SubAgent, "id" | "createdAt" | "updatedAt" | "isBuiltIn">) => SubAgent;
  updateAgent: (id: string, updates: Partial<SubAgent>) => void;
  deleteAgent: (id: string) => boolean;
  duplicateAgent: (id: string) => SubAgent | null;
  
  // Selection
  selectAgent: (id: string | null) => void;
  getAgent: (id: string) => SubAgent | undefined;
  getAgentsByType: (type: SubAgentType) => SubAgent[];
  
  // UI state
  showManager: () => boolean;
  setShowManager: (show: boolean) => void;
  showEditor: () => boolean;
  setShowEditor: (show: boolean) => void;
  editingAgent: () => SubAgent | null;
  setEditingAgent: (agent: SubAgent | null) => void;
  
  // Import/Export
  exportAgents: () => string;
  importAgents: (json: string) => boolean;
}

// ============================================================================
// Storage
// ============================================================================

const STORAGE_KEY = "orion_subagents";

function loadAgentsFromStorage(): SubAgent[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("[SubAgent] Failed to load from storage:", e);
  }
  return [];
}

function saveAgentsToStorage(agents: SubAgent[]): void {
  try {
    // Only save non-built-in agents
    const customAgents = agents.filter(a => !a.isBuiltIn);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customAgents));
  } catch (e) {
    console.error("[SubAgent] Failed to save to storage:", e);
  }
}

// ============================================================================
// Built-in Agents
// ============================================================================

const BUILT_IN_AGENTS: SubAgent[] = [
  {
    id: "builtin-code",
    name: "Code",
    type: "code",
    description: "Writing, implementing, and modifying code",
    systemPrompt: `You are an expert code agent. Generate clean, efficient, production-ready code following best practices. Include proper error handling and documentation.`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBuiltIn: true,
  },
  {
    id: "builtin-research",
    name: "Research",
    type: "research",
    description: "Investigating codebases, finding patterns, understanding architecture",
    systemPrompt: `You are a research agent. Analyze code structure, identify patterns, map dependencies, and document architectural decisions. Be thorough and systematic.`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBuiltIn: true,
  },
  {
    id: "builtin-refactor",
    name: "Refactor",
    type: "refactor",
    description: "Restructuring and improving existing code across multiple files",
    systemPrompt: `You are a refactoring agent. Restructure code for better organization, apply design patterns, modernize legacy code. Preserve functionality and make incremental changes.`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBuiltIn: true,
  },
];

// ============================================================================
// Context
// ============================================================================

const SubAgentContext = createContext<SubAgentContextValue>();

export function SubAgentProvider(props: { children: JSX.Element }) {
  // Load custom agents and merge with built-in
  const customAgents = loadAgentsFromStorage();
  const initialAgents = [...BUILT_IN_AGENTS, ...customAgents];
  
  const [state, setState] = createStore<SubAgentState>({
    agents: initialAgents,
    selectedAgentId: null,
    isLoading: false,
    error: null,
  });
  
  // UI state
  const [showManager, setShowManager] = createSignal(false);
  const [showEditor, setShowEditor] = createSignal(false);
  const [editingAgent, setEditingAgent] = createSignal<SubAgent | null>(null);
  
  // Generate unique ID
  const generateId = () => `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Emit agent change events for real-time sync
  const emitAgentChange = (type: "create" | "update" | "delete", agent: SubAgent) => {
    window.dispatchEvent(new CustomEvent("subagent:changed", {
      detail: { type, agent, agents: state.agents, timestamp: Date.now() }
    }));
  };
  
  // Save to storage whenever agents change (debounced)
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Cleanup saveTimeout to prevent memory leaks
  onCleanup(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
  });
  
  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveAgentsToStorage(state.agents);
    }, 500);
  };
  
  // CRUD Operations
  const createAgent = (agentData: Omit<SubAgent, "id" | "createdAt" | "updatedAt" | "isBuiltIn">): SubAgent => {
    const now = Date.now();
    const newAgent: SubAgent = {
      ...agentData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      isBuiltIn: false,
    };
    
    setState("agents", (agents) => [...agents, newAgent]);
    debouncedSave();
    emitAgentChange("create", newAgent);
    
    return newAgent;
  };
  
  const updateAgent = (id: string, updates: Partial<SubAgent>) => {
    const agent = state.agents.find(a => a.id === id);
    if (!agent) return;
    
    // Prevent updating built-in agents' core properties
    if (agent.isBuiltIn) {
      const allowedUpdates = { ...updates };
      delete allowedUpdates.type;
      delete allowedUpdates.isBuiltIn;
      updates = allowedUpdates;
    }
    
    const updatedAgent = { ...agent, ...updates, updatedAt: Date.now() };
    
    setState("agents", (agents) => 
      agents.map(a => a.id === id ? updatedAgent : a)
    );
    debouncedSave();
    emitAgentChange("update", updatedAgent);
  };
  
  const deleteAgent = (id: string): boolean => {
    const agent = state.agents.find(a => a.id === id);
    if (!agent || agent.isBuiltIn) return false;
    
    setState("agents", (agents) => agents.filter(a => a.id !== id));
    
    if (state.selectedAgentId === id) {
      setState("selectedAgentId", null);
    }
    
    debouncedSave();
    emitAgentChange("delete", agent);
    return true;
  };
  
  const duplicateAgent = (id: string): SubAgent | null => {
    const agent = state.agents.find(a => a.id === id);
    if (!agent) return null;
    
    return createAgent({
      name: `${agent.name} (Copy)`,
      type: agent.type,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
    });
  };
  
  // Selection
  const selectAgent = (id: string | null) => {
    setState("selectedAgentId", id);
  };
  
  const getAgent = (id: string): SubAgent | undefined => {
    return state.agents.find(a => a.id === id);
  };
  
  const getAgentsByType = (type: SubAgentType): SubAgent[] => {
    return state.agents.filter(a => a.type === type);
  };
  
  // Import/Export
  const exportAgents = (): string => {
    const customAgents = state.agents.filter(a => !a.isBuiltIn);
    return JSON.stringify(customAgents, null, 2);
  };
  
  const importAgents = (json: string): boolean => {
    try {
      const imported = JSON.parse(json) as SubAgent[];
      if (!Array.isArray(imported)) return false;
      
      const now = Date.now();
      const newAgents = imported.map(a => ({
        ...a,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        isBuiltIn: false,
      }));
      
      setState("agents", (agents) => [...agents, ...newAgents]);
      debouncedSave();
      
      // Emit batch import event
      window.dispatchEvent(new CustomEvent("subagent:changed", {
        detail: { type: "import", agents: state.agents, imported: newAgents, timestamp: Date.now() }
      }));
      
      return true;
    } catch (e) {
      console.error("[SubAgent] Failed to import:", e);
      return false;
    }
  };
  
  const value: SubAgentContextValue = {
    state,
    createAgent,
    updateAgent,
    deleteAgent,
    duplicateAgent,
    selectAgent,
    getAgent,
    getAgentsByType,
    showManager,
    setShowManager,
    showEditor,
    setShowEditor,
    editingAgent,
    setEditingAgent,
    exportAgents,
    importAgents,
  };
  
  return (
    <SubAgentContext.Provider value={value}>
      {props.children}
    </SubAgentContext.Provider>
  );
}

export function useSubAgents(): SubAgentContextValue {
  const context = useContext(SubAgentContext);
  if (!context) {
    throw new Error("useSubAgents must be used within a SubAgentProvider");
  }
  return context;
}

export default SubAgentContext;
