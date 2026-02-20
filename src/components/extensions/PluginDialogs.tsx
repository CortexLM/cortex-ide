/**
 * PluginDialogs - Renders dialogs triggered by plugin API events
 *
 * Listens for plugin:show-quick-pick, plugin:show-input-box, and
 * plugin:show-message events from the Tauri backend.  Renders SolidJS
 * dialog components and sends the user's response back via invoke().
 */

import {
  Component,
  createSignal,
  onMount,
  onCleanup,
  Show,
  For,
} from "solid-js";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Button, Text, Input } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/design-system/tokens";
import { extensionLogger } from "@/utils/logger";

// ============================================================================
// Types
// ============================================================================

interface QuickPickItem {
  label: string;
  description?: string;
  detail?: string;
  picked: boolean;
}

interface QuickPickRequest {
  request_id: string;
  extension_id: string;
  items: QuickPickItem[];
  placeholder?: string;
  can_pick_many: boolean;
}

interface InputBoxRequest {
  request_id: string;
  extension_id: string;
  prompt?: string;
  placeholder?: string;
  value?: string;
  password: boolean;
}

interface MessageRequest {
  message_id: string;
  extension_id: string;
  level: string;
  message: string;
  actions: string[];
}

// ============================================================================
// Component
// ============================================================================

export const PluginDialogs: Component = () => {
  const [quickPick, setQuickPick] = createSignal<QuickPickRequest | null>(
    null,
  );
  const [inputBox, setInputBox] = createSignal<InputBoxRequest | null>(null);
  const [messages, setMessages] = createSignal<MessageRequest[]>([]);
  const [selectedIndices, setSelectedIndices] = createSignal<Set<number>>(
    new Set(),
  );
  const [inputValue, setInputValue] = createSignal("");

  const unlistenFns: UnlistenFn[] = [];

  const respondQuickPick = async (indices: number[] | null) => {
    const req = quickPick();
    if (!req) return;
    setQuickPick(null);
    setSelectedIndices(new Set<number>());
    try {
      await invoke("plugin_respond_quick_pick", {
        requestId: req.request_id,
        selectedIndices: indices,
      });
    } catch (err) {
      extensionLogger.error("Failed to respond to quick pick:", err);
    }
  };

  const respondInputBox = async (value: string | null) => {
    const req = inputBox();
    if (!req) return;
    setInputBox(null);
    setInputValue("");
    try {
      await invoke("plugin_respond_input_box", {
        requestId: req.request_id,
        value,
      });
    } catch (err) {
      extensionLogger.error("Failed to respond to input box:", err);
    }
  };

  const dismissMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.message_id !== messageId));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (quickPick()) {
        respondQuickPick(null);
      } else if (inputBox()) {
        respondInputBox(null);
      }
    }
  };

  onMount(async () => {
    document.addEventListener("keydown", handleKeyDown);

    try {
      const u1 = await listen<QuickPickRequest>(
        "plugin:show-quick-pick",
        (event) => {
          setQuickPick(event.payload);
          const preselected = new Set<number>();
          event.payload.items.forEach((item, i) => {
            if (item.picked) preselected.add(i);
          });
          setSelectedIndices(preselected);
        },
      );
      unlistenFns.push(u1);
    } catch (e) {
      extensionLogger.warn("Failed to listen for quick-pick events:", e);
    }

    try {
      const u2 = await listen<InputBoxRequest>(
        "plugin:show-input-box",
        (event) => {
          setInputBox(event.payload);
          setInputValue(event.payload.value ?? "");
        },
      );
      unlistenFns.push(u2);
    } catch (e) {
      extensionLogger.warn("Failed to listen for input-box events:", e);
    }

    try {
      const u3 = await listen<MessageRequest>(
        "plugin:show-message",
        (event) => {
          setMessages((prev) => [...prev, event.payload]);
        },
      );
      unlistenFns.push(u3);
    } catch (e) {
      extensionLogger.warn("Failed to listen for show-message events:", e);
    }
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
    for (const unlisten of unlistenFns) {
      unlisten();
    }
    unlistenFns.length = 0;
  });

  const toggleIndex = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const confirmQuickPick = () => {
    const req = quickPick();
    if (!req) return;
    if (req.can_pick_many) {
      respondQuickPick([...selectedIndices()]);
    } else {
      const selected = [...selectedIndices()];
      respondQuickPick(selected.length > 0 ? selected : null);
    }
  };

  const levelIcon = (level: string) => {
    switch (level) {
      case "error":
        return "circle-exclamation";
      case "warning":
        return "triangle-exclamation";
      default:
        return "circle-info";
    }
  };

  const levelColor = (level: string) => {
    switch (level) {
      case "error":
        return tokens.colors.semantic.error;
      case "warning":
        return tokens.colors.semantic.warning;
      default:
        return tokens.colors.semantic.info;
    }
  };

  return (
    <>
      {/* Quick Pick Dialog */}
      <Show when={quickPick()}>
        {(req) => (
          <div
            class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
            style={{ "background-color": "rgba(0, 0, 0, 0.5)" }}
            role="dialog"
            aria-modal="true"
            aria-label="Quick Pick"
          >
            <div
              class="w-full max-w-lg rounded-lg shadow-2xl overflow-hidden"
              style={{
                "background-color": tokens.colors.surface.overlay,
                border: `1px solid ${tokens.colors.border.default}`,
              }}
            >
              <Show when={req().placeholder}>
                <div
                  class="px-3 py-2 border-b"
                  style={{ "border-color": tokens.colors.border.default }}
                >
                  <Text variant="muted" size="xs">
                    {req().placeholder}
                  </Text>
                </div>
              </Show>

              <div class="max-h-64 overflow-y-auto">
                <For each={req().items}>
                  {(item, index) => {
                    const selected = () => selectedIndices().has(index());
                    return (
                      <button
                        type="button"
                        class="w-full text-left px-3 py-2 flex items-center gap-2 border-b last:border-b-0 cursor-pointer"
                        style={{
                          "border-color": tokens.colors.border.divider,
                          "background-color": selected()
                            ? tokens.colors.interactive.active
                            : "transparent",
                          color: tokens.colors.text.primary,
                        }}
                        onClick={() => {
                          if (req().can_pick_many) {
                            toggleIndex(index());
                          } else {
                            respondQuickPick([index()]);
                          }
                        }}
                      >
                        <Show when={req().can_pick_many}>
                          <span
                            class="flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center"
                            style={{
                              "border-color": selected()
                                ? tokens.colors.semantic.primary
                                : tokens.colors.border.default,
                              "background-color": selected()
                                ? tokens.colors.semantic.primary
                                : "transparent",
                            }}
                          >
                            <Show when={selected()}>
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="white"
                                stroke-width="3"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </Show>
                          </span>
                        </Show>
                        <div class="flex-1 min-w-0">
                          <Text size="sm">{item.label}</Text>
                          <Show when={item.description}>
                            <Text variant="muted" size="xs">
                              {item.description}
                            </Text>
                          </Show>
                          <Show when={item.detail}>
                            <Text variant="muted" size="xs">
                              {item.detail}
                            </Text>
                          </Show>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>

              <div
                class="flex items-center justify-end gap-2 px-3 py-2 border-t"
                style={{ "border-color": tokens.colors.border.default }}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => respondQuickPick(null)}
                >
                  Cancel
                </Button>
                <Show when={req().can_pick_many}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={confirmQuickPick}
                  >
                    OK
                  </Button>
                </Show>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Input Box Dialog */}
      <Show when={inputBox()}>
        {(req) => (
          <div
            class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
            style={{ "background-color": "rgba(0, 0, 0, 0.5)" }}
            role="dialog"
            aria-modal="true"
            aria-label="Input Box"
          >
            <div
              class="w-full max-w-lg rounded-lg shadow-2xl overflow-hidden"
              style={{
                "background-color": tokens.colors.surface.overlay,
                border: `1px solid ${tokens.colors.border.default}`,
              }}
            >
              <Show when={req().prompt}>
                <div
                  class="px-4 py-3 border-b"
                  style={{ "border-color": tokens.colors.border.default }}
                >
                  <Text weight="bold" size="sm">
                    {req().prompt}
                  </Text>
                </div>
              </Show>

              <div class="px-4 py-3">
                <Input
                  type={req().password ? "password" : "text"}
                  placeholder={req().placeholder ?? ""}
                  value={inputValue()}
                  onInput={(e) =>
                    setInputValue(
                      (e.target as HTMLInputElement).value,
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      respondInputBox(inputValue());
                    }
                  }}
                  autofocus
                />
              </div>

              <div
                class="flex items-center justify-end gap-2 px-4 py-2 border-t"
                style={{ "border-color": tokens.colors.border.default }}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => respondInputBox(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => respondInputBox(inputValue())}
                >
                  OK
                </Button>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Message Toasts */}
      <Show when={messages().length > 0}>
        <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
          <For each={messages()}>
            {(msg) => (
              <div
                class="rounded-lg shadow-lg overflow-hidden"
                style={{
                  "background-color": tokens.colors.surface.overlay,
                  border: `1px solid ${tokens.colors.border.default}`,
                }}
              >
                <div class="flex items-start gap-2 px-3 py-2.5">
                  <Icon
                    name={levelIcon(msg.level)}
                    class="w-4 h-4 flex-shrink-0 mt-0.5"
                    style={{ color: levelColor(msg.level) }}
                  />
                  <div class="flex-1 min-w-0">
                    <Text size="sm">{msg.message}</Text>
                    <Show when={msg.actions.length > 0}>
                      <div class="flex items-center gap-2 mt-2">
                        <For each={msg.actions}>
                          {(action) => (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => dismissMessage(msg.message_id)}
                            >
                              {action}
                            </Button>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                  <button
                    type="button"
                    class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 cursor-pointer"
                    style={{ color: tokens.colors.text.muted }}
                    onClick={() => dismissMessage(msg.message_id)}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </>
  );
};
