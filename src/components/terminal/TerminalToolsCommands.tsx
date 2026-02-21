import { onMount, onCleanup, createSignal, lazy, Suspense, Show } from "solid-js";
import { useCommands, Command } from "@/context/CommandContext";

/**
 * TerminalToolsCommands - Registers terminal tools commands with the command palette
 *
 * Commands:
 * - terminal.killProcessOnPort - Open dialog to kill process on a specific port
 * - terminal.listPorts - Show all listening ports
 * - terminal.autoReplies - Open auto-replies manager dialog
 */

// Lazy imports for dialog components
const KillPortDialog = lazy(() => import("./KillPortDialog"));
const TerminalAutoReplies = lazy(() => import("./TerminalAutoReplies"));

// ============================================================================
// Dialog State Signals
// ============================================================================

const [showKillPortDialog, setShowKillPortDialog] = createSignal(false);
const [showAutoRepliesDialog, setShowAutoRepliesDialog] = createSignal(false);

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Open the Kill Port dialog
 */
export function openKillPortDialog() {
  setShowKillPortDialog(true);
}

/**
 * Open the Kill Port dialog and immediately scan all ports
 * Note: The KillPortDialog has a "Scan All Listening Ports" button
 */
export function openKillPortDialogWithScan() {
  setShowKillPortDialog(true);
  // Dispatch event to trigger scan after dialog opens
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent("terminal:scan-ports"));
  }, 100);
}

/**
 * Close the Kill Port dialog
 */
export function closeKillPortDialog() {
  setShowKillPortDialog(false);
}

/**
 * Open the Auto Replies dialog
 */
export function openAutoRepliesDialog() {
  setShowAutoRepliesDialog(true);
}

/**
 * Close the Auto Replies dialog
 */
export function closeAutoRepliesDialog() {
  setShowAutoRepliesDialog(false);
}

// ============================================================================
// Loading Component
// ============================================================================

function DialogLoading() {
  return (
    <div
      class="flex items-center justify-center p-8"
      style={{
        background: "var(--jb-modal)",
        "border-radius": "var(--jb-radius-lg)",
        border: "1px solid var(--jb-border-default)",
      }}
    >
      <span style={{ color: "var(--jb-text-muted-color)" }}>Loading...</span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TerminalToolsCommands() {
  const { registerCommand, unregisterCommand } = useCommands();

  onMount(() => {
    const commands: Command[] = [
      {
        id: "terminal.killProcessOnPort",
        label: "Terminal: Kill Process on Port",
        category: "Terminal",
        action: () => {
          openKillPortDialog();
        },
      },
      {
        id: "terminal.listPorts",
        label: "Terminal: Show Listening Ports",
        category: "Terminal",
        action: () => {
          openKillPortDialogWithScan();
        },
      },
      {
        id: "terminal.autoReplies",
        label: "Terminal: Manage Auto Replies",
        category: "Terminal",
        action: () => {
          openAutoRepliesDialog();
        },
      },
    ];

    // Register all commands
    commands.forEach((cmd) => registerCommand(cmd));
    
    // Listen for command palette events
    const handleConfigureAutoReplies = () => {
      openAutoRepliesDialog();
    };
    
    const handleToggleAutoReply = () => {
      // Dispatch event to toggle auto-reply globally
      // This will be handled by TerminalsContext
      window.dispatchEvent(new CustomEvent("terminal:auto-reply-toggle"));
    };
    
    window.addEventListener("terminal:configure-auto-replies", handleConfigureAutoReplies);
    window.addEventListener("terminal:toggle-auto-reply", handleToggleAutoReply);

    onCleanup(() => {
      commands.forEach((cmd) => unregisterCommand(cmd.id));
      window.removeEventListener("terminal:configure-auto-replies", handleConfigureAutoReplies);
      window.removeEventListener("terminal:toggle-auto-reply", handleToggleAutoReply);
    });
  });

  return (
    <>
      {/* Kill Port Dialog - Lazy loaded */}
      <Show when={showKillPortDialog()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeKillPortDialog();
            }
          }}
        >
          <div
            style={{
              width: "600px",
              "max-width": "90vw",
              "max-height": "80vh",
            }}
          >
            <Suspense fallback={<DialogLoading />}>
              <KillPortDialog
                onClose={closeKillPortDialog}
                // Trigger scan after mount if requested
              />
            </Suspense>
          </div>
        </div>
      </Show>

      {/* Auto Replies Dialog - Lazy loaded */}
      <Show when={showAutoRepliesDialog()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeAutoRepliesDialog();
            }
          }}
        >
          <div
            style={{
              width: "700px",
              "max-width": "90vw",
              "max-height": "85vh",
            }}
          >
            <Suspense fallback={<DialogLoading />}>
              <TerminalAutoReplies onClose={closeAutoRepliesDialog} />
            </Suspense>
          </div>
        </div>
      </Show>
    </>
  );
}

export default TerminalToolsCommands;
