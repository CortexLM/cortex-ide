/**
 * Supermaven Status Component
 * Displays Supermaven connection status and provides quick access to settings
 */

import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { Icon } from "../ui/Icon";
import { 
  getSupermaven, 
  type SupermavenState, 
  type SupermavenStatus as StatusType 
} from "@/utils/ai/SupermavenProvider";

interface SupermavenStatusProps {
  onOpenSettings?: () => void;
  compact?: boolean;
}

export function SupermavenStatus(props: SupermavenStatusProps) {
  const supermaven = getSupermaven();
  const [state, setState] = createSignal<SupermavenState>(supermaven.getState());
  const [showTooltip, setShowTooltip] = createSignal(false);

  onMount(() => {
    const unsubscribe = supermaven.onStateChange((newState) => {
      setState(newState);
    });
    onCleanup(unsubscribe);
  });

const statusConfig: Record<StatusType, { color: string; icon: string; label: string }> = {
    disconnected: {
      color: "var(--text-weak)",
      icon: "xmark",
      label: "Disconnected",
    },
    connecting: {
      color: "var(--warning)",
      icon: "spinner",
      label: "Connecting...",
    },
    ready: {
      color: "var(--success)",
      icon: "bolt",
      label: "Ready",
    },
    needs_activation: {
      color: "var(--warning)",
      icon: "circle-exclamation",
      label: "Activation Required",
    },
    error: {
      color: "var(--error)",
      icon: "circle-exclamation",
      label: "Error",
    },
  };

  const config = () => statusConfig[state().status];
  const isLoading = () => state().isLoading;

  const handleClick = () => {
    if (state().status === "needs_activation") {
      const url = supermaven.getActivationUrl();
      if (url) {
        window.open(url, "_blank");
      }
    } else if (props.onOpenSettings) {
      props.onOpenSettings();
    }
  };

const StatusIcon = () => {
    const cfg = config();
    if (isLoading()) {
      return <Icon name="spinner" class="w-3.5 h-3.5 animate-spin" />;
    }
    return <Icon name={cfg.icon} class="w-3.5 h-3.5" />;
  };

  if (props.compact) {
    return (
      <button
        class="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        title={`Supermaven: ${config().label}`}
      >
<span style={{ color: config().color }}>
          <StatusIcon />
        </span>
        <Show when={showTooltip()}>
          <div 
            class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded text-xs whitespace-nowrap z-50"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-base)",
              color: "var(--text-base)",
            }}
          >
            Supermaven: {config().label}
            <Show when={state().errorMessage}>
              <div class="text-red-400 mt-1">{state().errorMessage}</div>
            </Show>
          </div>
        </Show>
      </button>
    );
  }

  return (
    <div
      class="relative flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer transition-colors hover:bg-white/5"
      onClick={handleClick}
    >
<span style={{ color: config().color }}>
        <StatusIcon />
      </span>
      
      <div class="flex flex-col">
        <span class="text-xs font-medium" style={{ color: "var(--text-base)" }}>
          Supermaven
        </span>
        <span class="text-[10px]" style={{ color: config().color }}>
          {config().label}
          <Show when={isLoading()}> • Thinking...</Show>
        </span>
      </div>

      <Show when={state().status === "needs_activation"}>
        <Icon name="arrow-up-right-from-square" class="w-3 h-3 ml-auto" style={{ color: "var(--text-weak)" }} />
      </Show>

      <Show when={state().serviceTier}>
        <span 
          class="text-[9px] px-1.5 py-0.5 rounded-full ml-auto"
          style={{
            background: state().serviceTier === "pro" 
              ? "var(--primary)" 
              : "var(--surface-overlay)",
            color: state().serviceTier === "pro" 
              ? "white" 
              : "var(--text-weak)",
          }}
        >
          {state().serviceTier === "pro" ? "Pro" : "Free"}
        </span>
      </Show>
    </div>
  );
}

/**
 * Supermaven indicator for the status bar
 */
export function SupermavenStatusIndicator(props: {
  onClick?: () => void;
}) {
  const supermaven = getSupermaven();
  const [state, setState] = createSignal<SupermavenState>(supermaven.getState());
  const [hasCompletion, setHasCompletion] = createSignal(false);

  onMount(() => {
    const unsubState = supermaven.onStateChange(setState);
    const unsubCompletion = supermaven.onCompletion((completion) => {
      setHasCompletion(completion !== null);
    });
    
    onCleanup(() => {
      unsubState();
      unsubCompletion();
    });
  });

  const getStatusColor = () => {
    if (state().isLoading) return "var(--warning)";
    if (hasCompletion()) return "var(--accent)";
    
    switch (state().status) {
      case "ready": return "var(--success)";
      case "connecting": return "var(--warning)";
      case "needs_activation": return "var(--warning)";
      case "error": return "var(--error)";
      default: return "var(--text-weaker)";
    }
  };

  const getStatusText = () => {
    if (state().isLoading) return "...";
    if (hasCompletion()) return "*";
    if (state().status === "ready") return "SM";
    if (state().status === "needs_activation") return "!";
    if (state().status === "error") return "×";
    return "○";
  };

  return (
    <button
      class="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors hover:bg-white/10"
      onClick={props.onClick}
      title={`Supermaven: ${state().status}${state().errorMessage ? ` - ${state().errorMessage}` : ""}`}
    >
      <span 
        class="w-2 h-2 rounded-full transition-colors"
        style={{ background: getStatusColor() }}
      />
      <span 
        class="font-mono text-[10px]"
        style={{ color: getStatusColor() }}
      >
        {getStatusText()}
      </span>
    </button>
  );
}

/**
 * Completion preview tooltip
 */
export function CompletionPreview(props: {
  text: string;
  onAccept: () => void;
  onAcceptWord: () => void;
  onDismiss: () => void;
}) {
  return (
    <div 
      class="absolute bottom-full left-0 mb-1 p-2 rounded-lg shadow-lg max-w-md z-50"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border-base)",
      }}
    >
      <pre 
        class="text-xs font-mono overflow-hidden whitespace-pre-wrap max-h-32"
        style={{ color: "var(--text-weak)" }}
      >
        {props.text.slice(0, 200)}
        {props.text.length > 200 && "..."}
      </pre>
      
      <div class="flex items-center gap-2 mt-2 pt-2 border-t border-border-weak">
        <button
          class="flex items-center gap-1 px-2 py-1 rounded text-xs bg-primary text-white hover:bg-primary/90"
          onClick={props.onAccept}
        >
          <Icon name="check" class="w-3 h-3" />
          <span>Tab</span>
        </button>
        <button
          class="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-white/10"
          style={{ color: "var(--text-weak)" }}
          onClick={props.onAcceptWord}
        >
          <span>Ctrl+→ Word</span>
        </button>
        <button
          class="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-white/10"
          style={{ color: "var(--text-weak)" }}
          onClick={props.onDismiss}
        >
          <Icon name="xmark" class="w-3 h-3" />
          <span>Esc</span>
        </button>
      </div>
    </div>
  );
}
