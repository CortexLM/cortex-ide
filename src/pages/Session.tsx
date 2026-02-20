/**
 * Session Page - Simplified version for Figma design
 * 
 * This page is rendered inside CortexDesktopLayout.
 * The layout handles mode switching (Vibe/IDE), so this page
 * should NOT have its own mode management.
 * 
 * This page handles:
 * - Loading/creating sessions
 * - Displaying session messages (delegated to parent layout)
 * - Dialogs (subagents, project selection, clone, etc.)
 */

import { Show, createSignal, onMount, onCleanup } from "solid-js";
import { useSDK, type Attachment } from "@/context/SDKContext";
import { usePlan } from "@/context/PlanContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { PlanAgentsPanel } from "@/components/PlanAgentsPanel";
import { SubagentsDialog } from "@/components/ai/SubagentsDialog";
import { ProjectSelectModal } from "@/components/ProjectSelectModal";
import { CortexButton } from "@/components/cortex/primitives/CortexButton";
import { CortexModal } from "@/components/cortex/primitives/CortexModal";

export default function Session() {
  const { state, connect, createSession } = useSDK();
  const { state: planState } = usePlan();
  const workspace = useWorkspace();
  
  const [showSubagentsDialog, setShowSubagentsDialog] = createSignal(false);
  const [showProjectModal, setShowProjectModal] = createSignal(false);
  const [showCloneDialog, setShowCloneDialog] = createSignal(false);
  const [cloneUrl, setCloneUrl] = createSignal("");
  const [pendingMessage, setPendingMessage] = createSignal<{ content: string; attachments?: Attachment[] } | null>(null);

  // Event handlers
  let handleSubagentsEvent: (() => void) | undefined;
  let handleNeedProject: ((e: CustomEvent<{ content: string; attachments?: Attachment[] }>) => void) | undefined;

  // Initialize connection
  onMount(async () => {
    // Connect to SDK if not already connected
    if (!state.connected && !state.isConnecting) {
      await connect();
    }
    
    // Create a session if none exists
    if (!state.currentSession && !state.isConnecting) {
      await createSession();
    }
    
    // Listen for subagents dialog event
    handleSubagentsEvent = () => setShowSubagentsDialog(true);
    window.addEventListener("ai:subagents", handleSubagentsEvent);
    
    // Listen for need-project event (when user tries to send message without project)
    handleNeedProject = (e: CustomEvent<{ content: string; attachments?: Attachment[] }>) => {
      setPendingMessage(e.detail);
      setShowProjectModal(true);
    };
    window.addEventListener("chat:need-project", handleNeedProject as EventListener);
  });
  
  onCleanup(() => {
    if (handleSubagentsEvent) {
      window.removeEventListener("ai:subagents", handleSubagentsEvent);
    }
    if (handleNeedProject) {
      window.removeEventListener("chat:need-project", handleNeedProject as EventListener);
    }
  });

  // Handle project selection from modal
  const { sendMessage } = useSDK();
  const handleProjectSelected = async (path: string) => {
    if (import.meta.env.DEV) console.log("[Session] Project selected:", path);
    
    // Add the folder to workspace
    workspace?.addFolder(path);
    
    // If there's a pending message, send it after a short delay
    const pending = pendingMessage();
    if (pending) {
      setPendingMessage(null);
      setTimeout(() => {
        sendMessage(pending.content, pending.attachments);
      }, 150);
    }
  };

  // This component only renders dialogs and modals
  // The main UI is handled by CortexDesktopLayout
  return (
    <>
      {/* Plan Agents Panel */}
      <Show when={planState.showAgentsPanel}>
        <PlanAgentsPanel 
          agents={planState.agents} 
          isCompiling={planState.isCompiling}
        />
      </Show>

      {/* Subagents Dialog */}
      <SubagentsDialog
        open={showSubagentsDialog()}
        onClose={() => setShowSubagentsDialog(false)}
        model="claude-3-5-sonnet-20241022"
      />

      {/* Clone Repository Dialog */}
      <CortexModal
        open={showCloneDialog()}
        onClose={() => setShowCloneDialog(false)}
        title="Clone Repository"
        size="sm"
      >
        <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
          <input
            type="text"
            placeholder="https://github.com/user/repo.git"
            value={cloneUrl()}
            onInput={(e) => setCloneUrl(e.currentTarget.value)}
            class="w-full px-3 py-2 rounded text-[12px]"
            style={{ 
              background: "var(--cortex-bg-tertiary)", 
              border: "1px solid var(--cortex-border-default)",
              color: "var(--cortex-text-primary)",
              outline: "none",
              "border-radius": "var(--cortex-radius-md)",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--cortex-accent-primary)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--cortex-border-default)"; }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && cloneUrl()) {
                window.dispatchEvent(new CustomEvent("git:clone", { detail: { url: cloneUrl() } }));
                setShowCloneDialog(false);
                setCloneUrl("");
              }
            }}
            autofocus
          />
          <div class="flex justify-end gap-2">
            <CortexButton
              variant="ghost"
              size="xs"
              onClick={() => setShowCloneDialog(false)}
            >
              Cancel
            </CortexButton>
            <CortexButton
              variant="primary"
              size="xs"
              onClick={() => {
                if (cloneUrl()) {
                  window.dispatchEvent(new CustomEvent("git:clone", { detail: { url: cloneUrl() } }));
                  setShowCloneDialog(false);
                  setCloneUrl("");
                }
              }}
            >
              Clone
            </CortexButton>
          </div>
        </div>
      </CortexModal>

      {/* Project Selection Modal */}
      <ProjectSelectModal
        open={showProjectModal()}
        onClose={() => {
          setShowProjectModal(false);
          setPendingMessage(null);
        }}
        onProjectSelected={handleProjectSelected}
      />
    </>
  );
}

