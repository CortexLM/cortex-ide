/**
 * GitHub Copilot Status Component
 * Shows Copilot status in the status bar and handles sign-in flow
 */

import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { Icon } from "../ui/Icon";
import {
  getCopilotProvider,
  type CopilotStatus as CopilotStatusType,
  type CopilotDeviceCodeResponse,
} from "@/utils/ai/CopilotProvider";

// ============================================================================
// Status Indicator Component (for StatusBar)
// ============================================================================

interface CopilotStatusIndicatorProps {
  onClick?: () => void;
}

export function CopilotStatusIndicator(props: CopilotStatusIndicatorProps) {
  const [status, setStatus] = createSignal<CopilotStatusType>("disabled");
  const [isLoading, setIsLoading] = createSignal(false);

  onMount(() => {
    const copilot = getCopilotProvider();
    setStatus(copilot.getStatus());

    const unsubStatus = copilot.on("status-changed", (event) => {
      const newStatus = event.data as CopilotStatusType;
      setStatus(newStatus);
      setIsLoading(newStatus === "starting");
    });

    onCleanup(() => {
      unsubStatus();
    });
  });

  const getStatusIcon = () => {
    const s = status();
    if (isLoading() || s === "starting") {
      return <Icon name="spinner" class="w-3.5 h-3.5 animate-spin" />;
    }
    switch (s) {
      case "signedin":
        return <CopilotIcon class="w-3.5 h-3.5" />;
      case "error":
      case "unauthorized":
        return <Icon name="triangle-exclamation" class="w-3.5 h-3.5" />;
      case "signedout":
      case "disabled":
      default:
        return <CopilotIcon class="w-3.5 h-3.5 opacity-50" />;
    }
  };

  const getStatusColor = () => {
    const s = status();
    switch (s) {
      case "signedin":
        return "var(--success)";
      case "starting":
        return "var(--accent)";
      case "error":
      case "unauthorized":
        return "var(--error)";
      default:
        return "var(--text-weak)";
    }
  };

  const getStatusText = () => {
    const s = status();
    switch (s) {
      case "signedin":
        return "Copilot";
      case "starting":
        return "Copilot...";
      case "unauthorized":
        return "Copilot (Unauthorized)";
      case "error":
        return "Copilot (Error)";
      case "signedout":
        return "Copilot (Signed Out)";
      default:
        return "Copilot (Off)";
    }
  };

  return (
    <button
      class="flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors hover:bg-white/10"
      onClick={props.onClick}
      title={getStatusText()}
      style={{ color: getStatusColor() }}
    >
      {getStatusIcon()}
      <span class="text-xs">{status() === "signedin" ? "Copilot" : ""}</span>
    </button>
  );
}

// ============================================================================
// Copilot Icon Component
// ============================================================================

function CopilotIcon(props: { class?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      class={props.class}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M6.25 1C4.73 1 3.42 2.03 3.09 3.5 1.92 3.98 1 5.14 1 6.5V9c0 2.76 2.24 5 5 5h4c2.76 0 5-2.24 5-5V6.5c0-1.36-.92-2.52-2.09-3C12.58 2.03 11.27 1 9.75 1h-3.5zM5 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm5-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM4 11.5c0-.28.22-.5.5-.5h7c.28 0 .5.22.5.5s-.22.5-.5.5h-7a.5.5 0 0 1-.5-.5z"
      />
    </svg>
  );
}

// ============================================================================
// Sign In Modal Component
// ============================================================================

interface CopilotSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CopilotSignInModal(props: CopilotSignInModalProps) {
  const [status, setStatus] = createSignal<CopilotStatusType>("disabled");
  const [deviceCode, setDeviceCode] = createSignal<CopilotDeviceCodeResponse | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);
  const [isSigningIn, setIsSigningIn] = createSignal(false);

  onMount(() => {
    const copilot = getCopilotProvider();
    setStatus(copilot.getStatus());

    const unsubStatus = copilot.on("status-changed", (event) => {
      setStatus(event.data as CopilotStatusType);
    });

    const unsubDeviceCode = copilot.on("device-code", (event) => {
      setDeviceCode(event.data as CopilotDeviceCodeResponse);
    });

    const unsubSignedIn = copilot.on("signed-in", () => {
      // Auto-close on successful sign-in
      setTimeout(() => props.onClose(), 1500);
    });

    const unsubError = copilot.on("error", (event) => {
      setError(event.data as string);
      setIsSigningIn(false);
    });

    onCleanup(() => {
      unsubStatus();
      unsubDeviceCode();
      unsubSignedIn();
      unsubError();
    });
  });

  const handleSignIn = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      const copilot = getCopilotProvider();
      if (!copilot.isEnabled()) {
        await copilot.enable();
      }
      await copilot.initiateSignIn();
    } catch (e) {
      setError((e as Error).message);
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    const copilot = getCopilotProvider();
    await copilot.signOut();
    setDeviceCode(null);
  };

  const handleDisable = () => {
    const copilot = getCopilotProvider();
    copilot.disable();
    setDeviceCode(null);
    props.onClose();
  };

  const copyCode = () => {
    const code = deviceCode();
    if (code) {
      navigator.clipboard.writeText(code.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openVerificationUrl = () => {
    const code = deviceCode();
    if (code) {
      window.open(code.verificationUri, "_blank");
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={() => props.onClose()}
      >
        <div
          class="mx-4 w-full max-w-md rounded-xl border shadow-2xl"
          style={{
            background: "var(--surface-elevated)",
            "border-color": "var(--border-base)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            class="flex items-center justify-between px-6 py-4 border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <div class="flex items-center gap-3">
              <CopilotIcon class="w-6 h-6" />
              <h2 class="text-lg font-semibold" style={{ color: "var(--text-base)" }}>
                GitHub Copilot
              </h2>
            </div>
            <button
              onClick={() => props.onClose()}
              class="p-2 rounded-lg transition-colors"
              style={{ color: "var(--text-weak)" }}
            >
              <Icon name="xmark" class="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div class="p-6 space-y-4">
            {/* Already Signed In */}
            <Show when={status() === "signedin"}>
              <div class="text-center space-y-4">
                <div
                  class="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
                  style={{ background: "var(--success)", color: "white" }}
                >
                  <Icon name="check" class="w-8 h-8" />
                </div>
                <div>
                  <h3 class="text-lg font-medium" style={{ color: "var(--text-base)" }}>
                    Connected to GitHub Copilot
                  </h3>
                  <p class="text-sm mt-1" style={{ color: "var(--text-weak)" }}>
                    You can now use inline completions and Copilot Chat
                  </p>
                </div>
                <div class="flex gap-2 justify-center">
                  <button
                    onClick={handleSignOut}
                    class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      background: "var(--surface-hover)",
                      color: "var(--text-base)",
                    }}
                  >
                    Sign Out
                  </button>
                  <button
                    onClick={() => props.onClose()}
                    class="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                    style={{ background: "var(--primary)" }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </Show>

            {/* Device Code Flow */}
            <Show when={deviceCode() && status() !== "signedin"}>
              <div class="text-center space-y-4">
                <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                  Copy this code and paste it on GitHub to authorize Copilot:
                </p>
                
                {/* Device Code Display */}
                <button
                  onClick={copyCode}
                  class="w-full px-4 py-3 rounded-lg font-mono text-2xl tracking-widest flex items-center justify-center gap-3 transition-colors"
                  style={{
                    background: "var(--surface-hover)",
                    color: "var(--accent)",
                  }}
                >
                  <span>{deviceCode()?.userCode}</span>
                  <Show when={copied()} fallback={<Icon name="copy" class="w-5 h-5" />}>
                    <Icon name="check" class="w-5 h-5" style={{ color: "var(--success)" }} />
                  </Show>
                </button>

                <button
                  onClick={openVerificationUrl}
                  class="w-full px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  style={{
                    background: "var(--primary)",
                    color: "white",
                  }}
                >
                  <span>Open GitHub</span>
                  <Icon name="arrow-up-right-from-square" class="w-4 h-4" />
                </button>

                <div class="flex items-center justify-center gap-2 text-sm" style={{ color: "var(--text-weak)" }}>
                  <Icon name="spinner" class="w-4 h-4 animate-spin" />
                  <span>Waiting for authorization...</span>
                </div>
              </div>
            </Show>

            {/* Sign In Prompt */}
            <Show when={!deviceCode() && status() !== "signedin"}>
              <div class="text-center space-y-4">
                <CopilotIcon class="w-16 h-16 mx-auto opacity-50" />
                <div>
                  <h3 class="text-lg font-medium" style={{ color: "var(--text-base)" }}>
                    Connect to GitHub Copilot
                  </h3>
                  <p class="text-sm mt-1" style={{ color: "var(--text-weak)" }}>
                    Sign in with your GitHub account to use AI-powered code completions
                  </p>
                </div>

                <Show when={error()}>
                  <div
                    class="p-3 rounded-lg text-sm"
                    style={{ background: "var(--error-bg)", color: "var(--error)" }}
                  >
                    {error()}
                  </div>
                </Show>

                <button
                  onClick={handleSignIn}
                  disabled={isSigningIn()}
                  class="w-full px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                  style={{ background: "var(--primary)" }}
                >
                  {isSigningIn() ? (
                    <span class="flex items-center justify-center gap-2">
                      <Icon name="spinner" class="w-4 h-4 animate-spin" />
                      Connecting...
                    </span>
                  ) : (
                    "Sign in with GitHub"
                  )}
                </button>

                <Show when={status() === "unauthorized"}>
                  <p class="text-sm" style={{ color: "var(--warning)" }}>
                    You need an active GitHub Copilot subscription.{" "}
                    <a
                      href="https://github.com/features/copilot"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="underline"
                    >
                      Learn more
                    </a>
                  </p>
                </Show>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div
            class="px-6 py-3 border-t text-xs text-center"
            style={{ "border-color": "var(--border-weak)", color: "var(--text-weaker)" }}
          >
            <Show when={status() !== "disabled"}>
              <button onClick={handleDisable} class="hover:underline">
                Disable Copilot
              </button>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Copilot Settings Panel Component
// ============================================================================

interface CopilotSettingsPanelProps {
  onOpenSignIn: () => void;
}

export function CopilotSettingsPanel(props: CopilotSettingsPanelProps) {
  const [status, setStatus] = createSignal<CopilotStatusType>("disabled");
  const [models, setModels] = createSignal<Array<{ id: string; name: string }>>([]);
  const [enabled, setEnabled] = createSignal(false);

  onMount(() => {
    const copilot = getCopilotProvider();
    setStatus(copilot.getStatus());
    setEnabled(copilot.isEnabled());
    setModels(copilot.getModels());

    const unsubStatus = copilot.on("status-changed", (event) => {
      setStatus(event.data as CopilotStatusType);
      setEnabled(copilot.isEnabled());
      setModels(copilot.getModels());
    });

    onCleanup(() => {
      unsubStatus();
    });
  });

  const handleToggleEnabled = async () => {
    const copilot = getCopilotProvider();
    if (copilot.isEnabled()) {
      copilot.disable();
    } else {
      await copilot.enable();
      if (!copilot.isSignedIn()) {
        props.onOpenSignIn();
      }
    }
  };

  const handleSignOut = async () => {
    const copilot = getCopilotProvider();
    await copilot.signOut();
  };

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center gap-3">
        <CopilotIcon class="w-5 h-5" />
        <h3 class="font-medium" style={{ color: "var(--text-base)" }}>
          GitHub Copilot
        </h3>
        <Show when={status() === "signedin"}>
          <span
            class="text-[10px] rounded-full px-2 py-0.5"
            style={{ background: "var(--success-bg)", color: "var(--success)" }}
          >
            Connected
          </span>
        </Show>
      </div>

      {/* Enable Toggle */}
      <div
        class="flex items-center justify-between p-3 rounded-lg"
        style={{ background: "var(--surface-hover)" }}
      >
        <div>
          <p class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
            Enable Copilot
          </p>
          <p class="text-xs" style={{ color: "var(--text-weak)" }}>
            Get AI-powered code suggestions as you type
          </p>
        </div>
        <button
          onClick={handleToggleEnabled}
          class="relative w-11 h-6 rounded-full transition-colors"
          style={{ background: enabled() ? "var(--primary)" : "var(--surface-base)" }}
        >
          <div
            class="absolute top-1 w-4 h-4 rounded-full transition-transform"
            style={{
              background: "white",
              left: enabled() ? "calc(100% - 1.25rem)" : "0.25rem",
            }}
          />
        </button>
      </div>

      {/* Status & Actions */}
      <Show when={enabled()}>
        <div class="space-y-3">
          <Show when={status() === "signedin"}>
            <div
              class="p-3 rounded-lg space-y-2"
              style={{ background: "var(--surface-hover)" }}
            >
              <div class="flex items-center justify-between">
                <span class="text-sm" style={{ color: "var(--text-base)" }}>
                  Status
                </span>
                <span class="text-sm flex items-center gap-1.5" style={{ color: "var(--success)" }}>
                  <Icon name="check" class="w-4 h-4" />
                  Connected
                </span>
              </div>
              <Show when={models().length > 0}>
                <div class="flex items-center justify-between">
                  <span class="text-sm" style={{ color: "var(--text-base)" }}>
                    Available Models
                  </span>
                  <span class="text-sm" style={{ color: "var(--text-weak)" }}>
                    {models().length}
                  </span>
                </div>
              </Show>
            </div>
            <button
              onClick={handleSignOut}
              class="w-full px-4 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: "var(--surface-hover)",
                color: "var(--text-base)",
              }}
            >
              Sign Out
            </button>
          </Show>

          <Show when={status() !== "signedin"}>
            <button
              onClick={props.onOpenSignIn}
              class="w-full px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ background: "var(--primary)" }}
            >
              Sign in with GitHub
            </button>
          </Show>
        </div>
      </Show>

      {/* Keybindings Info */}
      <Show when={enabled() && status() === "signedin"}>
        <div
          class="p-3 rounded-lg border"
          style={{ background: "var(--surface-base)", "border-color": "var(--border-weak)" }}
        >
          <h4 class="text-sm font-medium mb-2" style={{ color: "var(--text-base)" }}>
            Keyboard Shortcuts
          </h4>
          <div class="grid grid-cols-2 gap-2 text-xs" style={{ color: "var(--text-weak)" }}>
            <div>
              <kbd class="px-1.5 py-0.5 rounded" style={{ background: "var(--surface-hover)" }}>
                Tab
              </kbd>
              <span class="ml-2">Accept suggestion</span>
            </div>
            <div>
              <kbd class="px-1.5 py-0.5 rounded" style={{ background: "var(--surface-hover)" }}>
                Esc
              </kbd>
              <span class="ml-2">Dismiss</span>
            </div>
            <div>
              <kbd class="px-1.5 py-0.5 rounded" style={{ background: "var(--surface-hover)" }}>
                Alt+]
              </kbd>
              <span class="ml-2">Next suggestion</span>
            </div>
            <div>
              <kbd class="px-1.5 py-0.5 rounded" style={{ background: "var(--surface-hover)" }}>
                Alt+[
              </kbd>
              <span class="ml-2">Previous suggestion</span>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Ghost Text Overlay Hook
// ============================================================================

export function useCopilotCompletions() {
  const [completion, setCompletion] = createSignal<{
    text: string;
    range: { startLine: number; startColumn: number; endLine: number; endColumn: number };
  } | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);

  let debounceTimer: number | undefined;

  onMount(() => {
    const copilot = getCopilotProvider();

    const unsubCompletion = copilot.on("completion", (event) => {
      setCompletion(event.data as {
        text: string;
        range: { startLine: number; startColumn: number; endLine: number; endColumn: number };
      });
      setIsLoading(false);
    });

    // Listen for cursor changes to trigger completions
    const handleCursorChange = (e: CustomEvent) => {
      if (!copilot.isSignedIn()) return;

      const { line, column, content, language, filePath } = e.detail;
      
      clearTimeout(debounceTimer);
      setIsLoading(true);
      
      debounceTimer = window.setTimeout(async () => {
        await copilot.getCompletion({
          content,
          language,
          filePath,
          position: { line, column },
        });
      }, 300);
    };

    window.addEventListener("editor:cursor-change", handleCursorChange as EventListener);

    // Listen for keyboard events
    const handleKeyDown = (e: KeyboardEvent) => {
      const comp = completion();
      if (!comp) return;

      if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        acceptCompletion();
      } else if (e.key === "Escape") {
        e.preventDefault();
        dismissCompletion();
      } else if (e.key === "]" && e.altKey) {
        e.preventDefault();
        nextCompletion();
      } else if (e.key === "[" && e.altKey) {
        e.preventDefault();
        previousCompletion();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      unsubCompletion();
      window.removeEventListener("editor:cursor-change", handleCursorChange as EventListener);
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(debounceTimer);
    });
  });

  const acceptCompletion = () => {
    const comp = completion();
    if (!comp) return;

    const copilot = getCopilotProvider();
    copilot.acceptCompletion({
      id: "",
      text: comp.text,
      range: comp.range,
      confidence: 1,
    });

    // Emit event to insert text in editor
    window.dispatchEvent(
      new CustomEvent("copilot:insert-completion", {
        detail: comp,
      })
    );

    setCompletion(null);
  };

  const dismissCompletion = () => {
    const comp = completion();
    if (comp) {
      const copilot = getCopilotProvider();
      copilot.rejectCompletion({
        id: "",
        text: comp.text,
        range: comp.range,
        confidence: 1,
      });
    }
    setCompletion(null);
    getCopilotProvider().clearCompletions();
  };

  const nextCompletion = () => {
    const copilot = getCopilotProvider();
    const next = copilot.getNextCompletion();
    if (next) {
      setCompletion({
        text: next.text,
        range: next.range,
      });
    }
  };

  const previousCompletion = () => {
    const copilot = getCopilotProvider();
    const prev = copilot.getPreviousCompletion();
    if (prev) {
      setCompletion({
        text: prev.text,
        range: prev.range,
      });
    }
  };

  return {
    completion,
    isLoading,
    acceptCompletion,
    dismissCompletion,
    nextCompletion,
    previousCompletion,
  };
}
