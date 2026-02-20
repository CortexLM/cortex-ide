/**
 * SubAgentManager - Minimal GUI for managing sub-agents
 */

import { createSignal, For, Show, onMount, onCleanup } from "solid-js";
import { Icon } from "../ui/Icon";
import { useSubAgents, SubAgent, SubAgentType } from "@/context/SubAgentContext";
import { useSDK } from "@/context/SDKContext";
import { Button, IconButton, Input, Textarea } from "@/components/ui";

const TYPE_LABELS: Record<SubAgentType, string> = {
  code: "Code",
  research: "Research",
  refactor: "Refactor",
  custom: "Custom",
};

// ============================================================================
// SubAgentEditor
// ============================================================================

interface SubAgentEditorProps {
  agent?: SubAgent | null;
  onSave: (agent: Omit<SubAgent, "id" | "createdAt" | "updatedAt" | "isBuiltIn">) => void;
  onCancel: () => void;
}

function SubAgentEditor(props: SubAgentEditorProps) {
  const [name, setName] = createSignal(props.agent?.name || "");
  const [type, setType] = createSignal<SubAgentType>(props.agent?.type || "custom");
  const [description, setDescription] = createSignal(props.agent?.description || "");
  const [systemPrompt, setSystemPrompt] = createSignal(props.agent?.systemPrompt || "");
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name().trim()) newErrors.name = "Required";
    if (!description().trim()) newErrors.description = "Required";
    if (!systemPrompt().trim()) newErrors.systemPrompt = "Required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSave = () => {
    if (!validate()) return;
    props.onSave({
      name: name().trim(),
      type: type(),
      description: description().trim(),
      systemPrompt: systemPrompt().trim(),
    });
  };
  
  return (
    <div class="flex flex-col h-full">
      <div 
        class="flex items-center justify-between px-3 py-2 text-xs font-medium uppercase"
        style={{ "border-bottom": "1px solid var(--border-base)", color: "var(--text-weak)" }}
      >
        <span>{props.agent ? "Edit Agent" : "New Agent"}</span>
        <IconButton size="sm" variant="ghost" onClick={props.onCancel}>
          <Icon name="xmark" class="w-3.5 h-3.5" />
        </IconButton>
      </div>
      
      <div class="flex-1 overflow-auto p-3 space-y-3">
        <div>
          <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>Name</label>
          <Input
            type="text"
            class="w-full"
            placeholder="Agent name"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            error={errors().name}
          />
        </div>
        
        <div>
          <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>Type</label>
          <select
            class="w-full px-2 py-1.5 rounded text-sm"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border-base)" }}
            value={type()}
            onChange={(e) => setType(e.currentTarget.value as SubAgentType)}
          >
            <For each={Object.entries(TYPE_LABELS)}>
              {([key, label]) => <option value={key}>{label}</option>}
            </For>
          </select>
        </div>
        
        <div>
          <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>Description</label>
          <Textarea
            class="w-full resize-none"
            rows={2}
            placeholder="What does this agent do?"
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            error={errors().description}
          />
        </div>
        
        <div>
          <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>System Prompt</label>
          <Textarea
            class="w-full text-xs font-mono resize-none"
            style={{ "line-height": "1.4" }}
            rows={12}
            placeholder="You are an expert agent..."
            value={systemPrompt()}
            onInput={(e) => setSystemPrompt(e.currentTarget.value)}
            error={errors().systemPrompt}
          />
        </div>
      </div>
      
      <div 
        class="flex items-center justify-end gap-2 px-3 py-2"
        style={{ "border-top": "1px solid var(--border-base)" }}
      >
        <Button
          size="sm"
          variant="secondary"
          onClick={props.onCancel}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={handleSave}
        >
          <Icon name="check" class="w-3 h-3" />
          Save
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// SubAgentManager
// ============================================================================

export function SubAgentManager() {
  const subAgents = useSubAgents();
  const sdk = useSDK();
  const [filter, setFilter] = createSignal<SubAgentType | "all">("all");
  const [showImport, setShowImport] = createSignal(false);
  const [importJson, setImportJson] = createSignal("");
  
  let fileInputRef: HTMLInputElement | undefined;
  
  const filteredAgents = () => {
    let agents = subAgents.state.agents;
    if (filter() !== "all") {
      agents = agents.filter(a => a.type === filter());
    }
    return agents;
  };
  
  const builtInAgents = () => filteredAgents().filter(a => a.isBuiltIn);
  const customAgents = () => filteredAgents().filter(a => !a.isBuiltIn);
  
  const handleCreateNew = () => {
    subAgents.setEditingAgent(null);
    subAgents.setShowEditor(true);
  };
  
  const handleEdit = (agent: SubAgent) => {
    subAgents.setEditingAgent(agent);
    subAgents.setShowEditor(true);
  };
  
  const handleDelete = (agent: SubAgent) => {
    if (agent.isBuiltIn) return;
    if (confirm(`Delete "${agent.name}"?`)) {
      subAgents.deleteAgent(agent.id);
    }
  };
  
  const handleDuplicate = (agent: SubAgent) => {
    const newAgent = subAgents.duplicateAgent(agent.id);
    if (newAgent) handleEdit(newAgent);
  };
  
  const handleSaveAgent = (agentData: Omit<SubAgent, "id" | "createdAt" | "updatedAt" | "isBuiltIn">) => {
    const editing = subAgents.editingAgent();
    if (editing) {
      subAgents.updateAgent(editing.id, agentData);
    } else {
      subAgents.createAgent(agentData);
    }
    subAgents.setShowEditor(false);
    subAgents.setEditingAgent(null);
  };
  
  const handleExport = () => {
    const json = subAgents.exportAgents();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subagents.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const handleImport = () => {
    const success = subAgents.importAgents(importJson());
    if (success) {
      setShowImport(false);
      setImportJson("");
    }
  };
  
  const handleFileImport = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImportJson(e.target?.result as string);
      setShowImport(true);
    };
    reader.readAsText(file);
    input.value = "";
  };
  
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (subAgents.showEditor()) {
          subAgents.setShowEditor(false);
        } else if (showImport()) {
          setShowImport(false);
        } else {
          subAgents.setShowManager(false);
        }
      }
    };
    
    const handleOpenManager = () => subAgents.setShowManager(true);
    const handleCreateNewEvent = () => {
      subAgents.setShowManager(true);
      subAgents.setEditingAgent(null);
      subAgents.setShowEditor(true);
    };
    const handleSelectAgent = (e: CustomEvent<{ type: string }>) => {
      const type = e.detail?.type;
      if (type) {
        const agent = subAgents.state.agents.find(a => a.type === type && a.isBuiltIn);
        if (agent) {
          subAgents.selectAgent(agent.id);
          subAgents.setShowManager(true);
        }
      }
    };
    const handleExportEvent = () => handleExport();
    const handleImportEvent = () => {
      subAgents.setShowManager(true);
      setShowImport(true);
    };
    
    // Listen for agent changes and queue context update for next message
    const handleAgentChanged = (e: CustomEvent<{ type: string; agent?: SubAgent; agents: SubAgent[] }>) => {
      const { type, agent, agents } = e.detail;
      const customAgents = agents.filter(a => !a.isBuiltIn);
      
      let updateMsg = "";
      if (type === "create" && agent) {
        updateMsg = `Sub-agent added: "${agent.name}" (${agent.type}) - ${agent.description}`;
      } else if (type === "update" && agent) {
        updateMsg = `Sub-agent updated: "${agent.name}" (${agent.type}) - ${agent.description}`;
      } else if (type === "delete" && agent) {
        updateMsg = `Sub-agent removed: "${agent.name}"`;
      } else if (type === "import") {
        updateMsg = `Sub-agents imported. Custom agents: ${customAgents.map(a => a.name).join(", ") || "none"}`;
      }
      
      if (updateMsg) {
        // Add available agents summary
        const agentsSummary = agents.map(a => `- ${a.name} (${a.type}): ${a.description}`).join("\n");
        sdk.addContextUpdate(`${updateMsg}\n\nAvailable sub-agents:\n${agentsSummary}`);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("subagent:open-manager", handleOpenManager);
    window.addEventListener("subagent:create-new", handleCreateNewEvent);
    window.addEventListener("subagent:select", handleSelectAgent as EventListener);
    window.addEventListener("subagent:export", handleExportEvent);
    window.addEventListener("subagent:import", handleImportEvent);
    window.addEventListener("subagent:changed", handleAgentChanged as EventListener);
    
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("subagent:open-manager", handleOpenManager);
      window.removeEventListener("subagent:create-new", handleCreateNewEvent);
      window.removeEventListener("subagent:select", handleSelectAgent as EventListener);
      window.removeEventListener("subagent:export", handleExportEvent);
      window.removeEventListener("subagent:import", handleImportEvent);
      window.removeEventListener("subagent:changed", handleAgentChanged as EventListener);
    });
  });
  
  return (
    <Show when={subAgents.showManager()}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0, 0, 0, 0.6)" }}
        onClick={(e) => { if (e.target === e.currentTarget) subAgents.setShowManager(false); }}
      >
        <div
          class="flex w-[700px] h-[500px] rounded overflow-hidden"
          style={{ 
            background: "var(--ui-panel-bg)", 
            border: "1px solid var(--border-base)",
            "box-shadow": "0 8px 32px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Left Panel */}
          <div class="w-[260px] flex flex-col" style={{ "border-right": "1px solid var(--border-base)" }}>
            {/* Header */}
            <div
              class="flex items-center justify-between px-3 py-2"
              style={{ "border-bottom": "1px solid var(--border-base)" }}
            >
              <span class="text-sm font-medium">Sub-Agents</span>
              <IconButton
                size="sm"
                variant="ghost"
                onClick={() => subAgents.setShowManager(false)}
              >
                <Icon name="xmark" class="w-4 h-4" />
              </IconButton>
            </div>
            
            {/* Filter */}
            <div class="flex gap-1 p-2" style={{ "border-bottom": "1px solid var(--border-base)" }}>
              <Button
                size="sm"
                variant={filter() === "all" ? "secondary" : "ghost"}
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <For each={Object.entries(TYPE_LABELS) as [SubAgentType, string][]}>
                {([key, label]) => (
                  <Button
                    size="sm"
                    variant={filter() === key ? "secondary" : "ghost"}
                    onClick={() => setFilter(key as SubAgentType)}
                  >
                    {label}
                  </Button>
                )}
              </For>
            </div>
            
            {/* Agent List */}
            <div class="flex-1 overflow-auto">
              <Show when={builtInAgents().length > 0}>
                <div class="px-3 py-1.5 text-[10px] font-medium uppercase" style={{ color: "var(--text-weaker)" }}>
                  Built-in
                </div>
                <For each={builtInAgents()}>
                  {(agent) => (
                    <AgentRow
                      agent={agent}
                      isSelected={subAgents.state.selectedAgentId === agent.id}
                      onSelect={() => subAgents.selectAgent(agent.id)}
                      onEdit={() => handleEdit(agent)}
                      onDelete={() => handleDelete(agent)}
                      onDuplicate={() => handleDuplicate(agent)}
                    />
                  )}
                </For>
              </Show>
              
              <div class="px-3 py-1.5 text-[10px] font-medium uppercase" style={{ color: "var(--text-weaker)" }}>
                Custom ({customAgents().length})
              </div>
              <Show when={customAgents().length > 0}>
                <For each={customAgents()}>
                  {(agent) => (
                    <AgentRow
                      agent={agent}
                      isSelected={subAgents.state.selectedAgentId === agent.id}
                      onSelect={() => subAgents.selectAgent(agent.id)}
                      onEdit={() => handleEdit(agent)}
                      onDelete={() => handleDelete(agent)}
                      onDuplicate={() => handleDuplicate(agent)}
                    />
                  )}
                </For>
              </Show>
            </div>
            
            {/* Footer */}
            <div class="flex items-center gap-1 p-2" style={{ "border-top": "1px solid var(--border-base)" }}>
              <Button
                class="flex-1"
                size="sm"
                variant="secondary"
                onClick={handleCreateNew}
              >
                <Icon name="plus" class="w-3 h-3" />
                New
              </Button>
              <IconButton
                size="sm"
                variant="ghost"
                onClick={handleExport}
                title="Export"
              >
                <Icon name="download" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
              </IconButton>
              <IconButton
                size="sm"
                variant="ghost"
                onClick={() => fileInputRef?.click()}
                title="Import"
              >
                <Icon name="upload" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
              </IconButton>
              <input ref={fileInputRef} type="file" accept=".json" class="hidden" onChange={handleFileImport} />
            </div>
          </div>
          
          {/* Right Panel */}
          <div class="flex-1 flex flex-col min-w-0">
            <Show
              when={subAgents.showEditor()}
              fallback={
                <Show
                  when={subAgents.state.selectedAgentId}
                  fallback={
                    <div class="flex-1 flex items-center justify-center">
                      <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                        Select an agent or create a new one
                      </span>
                    </div>
                  }
                >
                  <AgentDetails
                    agent={subAgents.getAgent(subAgents.state.selectedAgentId!)!}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                  />
                </Show>
              }
            >
              <SubAgentEditor
                agent={subAgents.editingAgent()}
                onSave={handleSaveAgent}
                onCancel={() => {
                  subAgents.setShowEditor(false);
                  subAgents.setEditingAgent(null);
                }}
              />
            </Show>
          </div>
        </div>
        
        {/* Import Dialog */}
        <Show when={showImport()}>
          <div
            class="fixed inset-0 z-60 flex items-center justify-center"
            style={{ background: "rgba(0, 0, 0, 0.6)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowImport(false); }}
          >
            <div
              class="w-[400px] rounded p-3"
              style={{ 
                background: "var(--ui-panel-bg)", 
                border: "1px solid var(--border-base)",
                "box-shadow": "0 4px 16px rgba(0, 0, 0, 0.5)",
              }}
            >
              <div class="text-sm font-medium mb-2">Import Agents</div>
              <Textarea
                class="w-full h-32 text-xs font-mono resize-none"
                placeholder="Paste JSON..."
                value={importJson()}
                onInput={(e) => setImportJson(e.currentTarget.value)}
              />
              <div class="flex justify-end gap-2 mt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowImport(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleImport}
                >
                  Import
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
// AgentRow
// ============================================================================

interface AgentRowProps {
  agent: SubAgent;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function AgentRow(props: AgentRowProps) {
  const [hover, setHover] = createSignal(false);
  
  return (
    <div
      class="flex items-center gap-2 px-3 py-1.5 cursor-pointer"
      style={{ background: props.isSelected ? "var(--surface-active)" : "transparent" }}
      onClick={props.onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div class="flex-1 min-w-0">
        <div class="text-sm truncate">{props.agent.name}</div>
        <div class="text-[10px] truncate" style={{ color: "var(--text-weak)" }}>
          {TYPE_LABELS[props.agent.type]}
        </div>
      </div>
      
      <Show when={hover()}>
        <div class="flex items-center gap-0.5">
          <IconButton
            size="sm"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); props.onDuplicate(); }}
            tooltip="Duplicate"
          >
            <Icon name="copy" style={{ width: "12px", height: "12px" }} />
          </IconButton>
          <Show when={!props.agent.isBuiltIn}>
            <IconButton
              size="sm"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); props.onDelete(); }}
              tooltip="Delete"
            >
              <Icon name="trash" style={{ width: "12px", height: "12px" }} />
            </IconButton>
          </Show>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// AgentDetails
// ============================================================================

interface AgentDetailsProps {
  agent: SubAgent;
  onEdit: (agent: SubAgent) => void;
  onDelete: (agent: SubAgent) => void;
  onDuplicate: (agent: SubAgent) => void;
}

function AgentDetails(props: AgentDetailsProps) {
  return (
    <div class="flex-1 flex flex-col">
      {/* Header */}
      <div
        class="flex items-center justify-between px-3 py-2"
        style={{ "border-bottom": "1px solid var(--border-base)" }}
      >
        <div>
          <div class="text-sm font-medium">{props.agent.name}</div>
          <div class="text-[10px]" style={{ color: "var(--text-weak)" }}>
            {TYPE_LABELS[props.agent.type]}
            {props.agent.isBuiltIn && " · Built-in"}
          </div>
        </div>
        <div class="flex items-center gap-1">
          <IconButton
            size="sm"
            variant="ghost"
            onClick={() => props.onEdit(props.agent)}
            title="Edit"
          >
            <Icon name="pen" class="w-3.5 h-3.5" />
          </IconButton>
          <IconButton
            size="sm"
            variant="ghost"
            onClick={() => props.onDuplicate(props.agent)}
            title="Duplicate"
          >
            <Icon name="copy" class="w-3.5 h-3.5" />
          </IconButton>
          <Show when={!props.agent.isBuiltIn}>
            <IconButton
              size="sm"
              variant="ghost"
              onClick={() => props.onDelete(props.agent)}
              title="Delete"
            >
              <Icon name="trash" class="w-3.5 h-3.5" />
            </IconButton>
          </Show>
        </div>
      </div>
      
      {/* Description */}
      <div class="px-3 py-2" style={{ "border-bottom": "1px solid var(--border-base)" }}>
        <div class="text-[10px] uppercase mb-1" style={{ color: "var(--text-weaker)" }}>Description</div>
        <div class="text-xs" style={{ color: "var(--text-weak)" }}>{props.agent.description}</div>
      </div>
      
      {/* System Prompt */}
      <div class="flex-1 flex flex-col min-h-0 p-3">
        <div class="text-[10px] uppercase mb-1" style={{ color: "var(--text-weaker)" }}>System Prompt</div>
        <pre
          class="flex-1 p-2 rounded text-xs overflow-auto"
          style={{
            background: "var(--surface-raised)",
            "font-family": "var(--font-mono)",
            "white-space": "pre-wrap",
            "word-break": "break-word",
            "line-height": "1.4",
          }}
        >
          {props.agent.systemPrompt}
        </pre>
      </div>
    </div>
  );
}

export default SubAgentManager;
