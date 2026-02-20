/**
 * Inline Completion Status Components
 *
 * Status bar indicator and inline toolbar for AI-powered code completions.
 * Shows completion provider status, loading state, and provides quick actions.
 */

import { createSignal, onMount, onCleanup, Show, For } from "solid-js";
import { tokens } from "@/design-system/tokens";
import {
  getInlineCompletionsProvider,
  type InlineProviderStatus,
} from "@/providers/InlineCompletionsProvider";
import { Text, Card, Button, Tooltip } from "@/components/ui";
import { Icon } from "../ui/Icon";

// ============================================================================
// Status Bar Indicator
// ============================================================================

interface InlineCompletionStatusIndicatorProps {
  onClick?: () => void;
}

/**
 * Status bar indicator showing inline completion provider status
 */
export function InlineCompletionStatusIndicator(props: InlineCompletionStatusIndicatorProps) {
  const [status, setStatus] = createSignal<InlineProviderStatus>({
    provider: "auto",
    isActive: false,
    isLoading: false,
    completionCount: 0,
    currentIndex: 0,
  });

  onMount(() => {
    const provider = getInlineCompletionsProvider();
    setStatus(provider.getStatus());

    const unsubscribe = provider.on("status-changed", (event) => {
      if (event.data) {
        setStatus(event.data as InlineProviderStatus);
      }
    });

    onCleanup(() => unsubscribe());
  });

  const getProviderLabel = () => {
    switch (status().provider) {
      case "copilot":
        return "Copilot";
      case "supermaven":
        return "Supermaven";
      case "openai":
        return "GPT";
      case "anthropic":
        return "Claude";
      case "auto":
        return "AI";
      default:
        return "AI";
    }
  };

  const getStatusIcon = () => {
    const iconStyle = { width: "14px", height: "14px" };
    
    if (status().isLoading) {
      return <Icon name="spinner" style={iconStyle} class="animate-spin" />;
    }
    
    if (status().error) {
      return <Icon name="circle-exclamation" style={iconStyle} />;
    }
    
    if (status().isActive) {
      return <Icon name="bolt" style={iconStyle} />;
    }
    
    return <Icon name="bolt" style={{ ...iconStyle, opacity: 0.5 }} />;
  };

  const getStatusColor = () => {
    if (status().error) {
      return tokens.colors.semantic.error;
    }
    if (status().isLoading) {
      return tokens.colors.semantic.primary;
    }
    if (status().isActive) {
      return tokens.colors.semantic.success;
    }
    return tokens.colors.text.muted;
  };

  const getTooltip = () => {
    if (!status().isActive) {
      return "Inline completions disabled or provider not configured";
    }
    if (status().error) {
      return `Error: ${status().error}`;
    }
    if (status().isLoading) {
      return "Fetching completion...";
    }
    if (status().completionCount > 0) {
      return `${status().completionCount} completion(s) available (${status().currentIndex + 1}/${status().completionCount})`;
    }
    return `${getProviderLabel()} inline completions ready`;
  };

  return (
    <Tooltip content={getTooltip()}>
      <button
        class={`flex items-center gap-1 cursor-pointer hover:bg-[${tokens.colors.interactive.hover}]`}
        style={{
          color: getStatusColor(),
          padding: `0 ${tokens.spacing.md}`,
          "line-height": "22px",
          transition: "all 100ms ease",
        }}
        onClick={props.onClick}
        onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
        onMouseLeave={(e) => e.currentTarget.style.color = getStatusColor()}
      >
        {getStatusIcon()}
        <Show when={status().isActive}>
          <Text variant="muted" style={{ "font-size": "11px" }}>
            {getProviderLabel()}
          </Text>
        </Show>
        <Show when={status().completionCount > 1}>
          <Text variant="muted" style={{ "font-size": "10px", opacity: 0.7 }}>
            ({status().currentIndex + 1}/{status().completionCount})
          </Text>
        </Show>
      </button>
    </Tooltip>
  );
}

// ============================================================================
// Inline Toolbar (Hover Widget)
// ============================================================================

interface InlineCompletionToolbarProps {
  /** Position relative to the ghost text */
  position: { x: number; y: number };
  /** Whether toolbar is visible */
  visible: boolean;
  /** Callback to accept full completion */
  onAccept: () => void;
  /** Callback to accept word */
  onAcceptWord: () => void;
  /** Callback to go to next suggestion */
  onNext: () => void;
  /** Callback to go to previous suggestion */
  onPrevious: () => void;
  /** Callback to dismiss */
  onDismiss: () => void;
  /** Current completion index */
  currentIndex: number;
  /** Total completion count */
  totalCount: number;
}

/**
 * Floating toolbar shown above inline completion ghost text
 */
export function InlineCompletionToolbar(props: InlineCompletionToolbarProps) {
  return (
    <Show when={props.visible}>
      <Card
        variant="elevated"
        padding="sm"
        class="fixed z-[9999] flex items-center gap-1"
        style={{
          left: `${props.position.x}px`,
          top: `${props.position.y - 28}px`,
          border: `1px solid ${tokens.colors.border.divider}`,
          "box-shadow": tokens.shadows.popup,
          "backdrop-filter": "blur(8px)",
        }}
      >
        {/* Accept button */}
        <Tooltip content="Accept (Tab)">
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onAccept}
            style={{
              padding: "2px 6px",
              height: "20px",
              "font-size": "11px",
            }}
          >
            <Icon name="check" style={{ width: "12px", height: "12px" }} />
            <span style={{ "margin-left": "2px" }}>Accept</span>
          </Button>
        </Tooltip>

        {/* Accept word button */}
        <Tooltip content="Accept Word (Ctrl+Right)">
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onAcceptWord}
            style={{
              padding: "2px 6px",
              height: "20px",
              "font-size": "11px",
            }}
          >
            Word
          </Button>
        </Tooltip>

        {/* Separator */}
        <Show when={props.totalCount > 1}>
          <div
            style={{
              width: "1px",
              height: "12px",
              background: tokens.colors.border.divider,
              margin: "0 2px",
            }}
          />

          {/* Navigation */}
          <Tooltip content="Previous (Alt+[)">
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onPrevious}
              style={{
                padding: "2px 4px",
                height: "20px",
                "min-width": "20px",
              }}
            >
              <Icon name="chevron-left" style={{ width: "12px", height: "12px" }} />
            </Button>
          </Tooltip>

          <Text
            variant="muted"
            size="sm"
            style={{
              "font-family": "var(--jb-font-mono)",
              "min-width": "28px",
              "text-align": "center",
            }}
          >
            {props.currentIndex + 1}/{props.totalCount}
          </Text>

          <Tooltip content="Next (Alt+])">
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onNext}
              style={{
                padding: "2px 4px",
                height: "20px",
                "min-width": "20px",
              }}
            >
              <Icon name="chevron-right" style={{ width: "12px", height: "12px" }} />
            </Button>
          </Tooltip>
        </Show>

        {/* Dismiss button */}
        <Tooltip content="Dismiss (Escape)">
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onDismiss}
            style={{
              padding: "2px 4px",
              height: "20px",
              "min-width": "20px",
              color: tokens.colors.text.muted,
            }}
          >
            <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
          </Button>
        </Tooltip>
      </Card>
    </Show>
  );
}

// ============================================================================
// Settings Panel
// ============================================================================

interface InlineCompletionSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Settings panel for inline completions configuration
 */
export function InlineCompletionSettingsPanel(props: InlineCompletionSettingsPanelProps) {
  const [settings, setSettings] = createSignal(getInlineCompletionsProvider().getSettings());

  const providers = [
    { value: "auto", label: "Auto (Best Available)" },
    { value: "copilot", label: "GitHub Copilot" },
    { value: "supermaven", label: "Supermaven" },
    { value: "openai", label: "OpenAI GPT" },
    { value: "anthropic", label: "Anthropic Claude" },
  ];

  const handleProviderChange = (provider: string) => {
    const provider_ = getInlineCompletionsProvider();
    provider_.configure({ provider: provider as "auto" | "copilot" | "supermaven" | "openai" | "anthropic" });
    setSettings(provider_.getSettings());
  };

  const handleToggleEnabled = () => {
    const provider = getInlineCompletionsProvider();
    provider.configure({ enabled: !settings().enabled });
    setSettings(provider.getSettings());
  };

  const handleToggleToolbar = () => {
    const provider = getInlineCompletionsProvider();
    provider.configure({ showToolbar: !settings().showToolbar });
    setSettings(provider.getSettings());
  };

  return (
    <Show when={props.isOpen}>
      <Card
        variant="elevated"
        class="fixed z-50"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "400px",
          "max-height": "80vh",
          overflow: "auto",
          border: `1px solid ${tokens.colors.border.divider}`,
          "box-shadow": tokens.shadows.modal,
        }}
      >
        <div
          class="flex items-center justify-between"
          style={{
            padding: tokens.spacing.md,
            "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          }}
        >
          <Text weight="semibold">Inline Completions Settings</Text>
          <Button variant="ghost" size="sm" onClick={props.onClose}>
            <Icon name="xmark" />
          </Button>
        </div>

        <div style={{ padding: tokens.spacing.md }}>
          {/* Enable/Disable */}
          <div
            class="flex items-center justify-between"
            style={{ "margin-bottom": tokens.spacing.md }}
          >
            <div>
              <Text weight="medium">Enable Inline Suggestions</Text>
              <Text variant="muted" size="sm">
                Show AI-powered code completions as you type
              </Text>
            </div>
            <Button
              variant={settings().enabled ? "primary" : "secondary"}
              size="sm"
              onClick={handleToggleEnabled}
            >
              {settings().enabled ? "Enabled" : "Disabled"}
            </Button>
          </div>

          {/* Provider Selection */}
          <div style={{ "margin-bottom": tokens.spacing.md }}>
            <Text weight="medium" style={{ "margin-bottom": tokens.spacing.sm }}>
              Completion Provider
            </Text>
            <div class="flex flex-col gap-1">
              <For each={providers}>
                {(provider) => (
                  <Button
                    variant={settings().provider === provider.value ? "primary" : "ghost"}
                    size="sm"
                    onClick={() => handleProviderChange(provider.value)}
                    style={{
                      "justify-content": "flex-start",
                      width: "100%",
                    }}
                  >
                    {provider.label}
                  </Button>
                )}
              </For>
            </div>
          </div>

          {/* Show Toolbar */}
          <div class="flex items-center justify-between">
            <div>
              <Text weight="medium">Show Toolbar</Text>
              <Text variant="muted" size="sm">
                Display action toolbar on hover
              </Text>
            </div>
            <Button
              variant={settings().showToolbar ? "primary" : "secondary"}
              size="sm"
              onClick={handleToggleToolbar}
            >
              {settings().showToolbar ? "Shown" : "Hidden"}
            </Button>
          </div>

          {/* Keyboard Shortcuts Reference */}
          <div
            style={{
              "margin-top": tokens.spacing.lg,
              padding: tokens.spacing.md,
              background: tokens.colors.surface.panel,
              "border-radius": tokens.radius.md,
            }}
          >
            <Text weight="medium" style={{ "margin-bottom": tokens.spacing.sm }}>
              Keyboard Shortcuts
            </Text>
            <div class="flex flex-col gap-1">
              <ShortcutRow keys={["Tab"]} description="Accept full completion" />
              <ShortcutRow keys={["Ctrl", "Right"]} description="Accept word" />
              <ShortcutRow keys={["Ctrl", "End"]} description="Accept line" />
              <ShortcutRow keys={["Alt", "]"]} description="Next suggestion" />
              <ShortcutRow keys={["Alt", "["]} description="Previous suggestion" />
              <ShortcutRow keys={["Escape"]} description="Dismiss" />
              <ShortcutRow keys={["Alt", "\\"]} description="Trigger manually" />
            </div>
          </div>
        </div>
      </Card>
    </Show>
  );
}

interface ShortcutRowProps {
  keys: string[];
  description: string;
}

function ShortcutRow(props: ShortcutRowProps) {
  return (
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1">
        <For each={props.keys}>
          {(key, index) => (
            <>
              <kbd
                style={{
                  padding: "1px 4px",
                  background: tokens.colors.surface.popup,
                  border: `1px solid ${tokens.colors.border.divider}`,
                  "border-radius": "var(--cortex-radius-sm)",
                  "font-size": "10px",
                  "font-family": "var(--jb-font-mono)",
                }}
              >
                {key}
              </kbd>
              <Show when={index() < props.keys.length - 1}>
                <Text variant="muted" size="sm">+</Text>
              </Show>
            </>
          )}
        </For>
      </div>
      <Text variant="muted" size="sm">
        {props.description}
      </Text>
    </div>
  );
}

// ============================================================================
// Export
// ============================================================================

export default InlineCompletionStatusIndicator;

