import { createSignal, createEffect, Show, For } from "solid-js";
import { Portal } from "solid-js/web";
import { Icon } from "../ui/Icon";
import { Button } from "@/components/ui";
import { tokens } from "@/design-system/tokens";
import { gitForcePushCheck } from "@/utils/tauri-api";
import type { ForcePushInfo } from "@/utils/tauri-api";

export interface ForcePushConfirmationProps {
  open: boolean;
  repoPath: string;
  remote?: string;
  branch?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ForcePushConfirmation(props: ForcePushConfirmationProps) {
  const [info, setInfo] = createSignal<ForcePushInfo | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (props.open) {
      fetchForcePushInfo();
    } else {
      setInfo(null);
      setError(null);
    }
  });

  const fetchForcePushInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await gitForcePushCheck(props.repoPath, props.remote, props.branch);
      setInfo(result);
    } catch (err) {
      setError(`Failed to check force push status: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Show when={props.open}>
      <Portal>
        <div
          style={{
            position: "fixed",
            inset: "0",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            background: "rgba(0, 0, 0, 0.6)",
            "z-index": "9999",
          }}
          onClick={props.onCancel}
        >
          <div
            style={{
              width: "520px",
              "max-width": "90vw",
              "max-height": "80vh",
              background: tokens.colors.surface.elevated,
              "border-radius": tokens.radius.lg,
              "box-shadow": tokens.shadows.modal,
              display: "flex",
              "flex-direction": "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              class="flex items-center gap-3 px-5 py-4 border-b"
              style={{ "border-color": tokens.colors.border.divider }}
            >
              <Icon
                name="triangle-exclamation"
                class="w-5 h-5"
                style={{ color: tokens.colors.semantic.warning }}
              />
              <span class="text-base font-semibold" style={{ color: tokens.colors.text.primary }}>
                Force Push Warning
              </span>
            </div>

            {/* Content */}
            <div class="flex-1 overflow-y-auto px-5 py-4">
              <Show when={loading()}>
                <div class="flex items-center justify-center py-8">
                  <Icon name="spinner" class="w-5 h-5 animate-spin" style={{ color: tokens.colors.text.muted }} />
                  <span class="ml-2 text-sm" style={{ color: tokens.colors.text.muted }}>
                    Checking remote status...
                  </span>
                </div>
              </Show>

              <Show when={error()}>
                <div
                  class="flex items-center gap-2 p-3 rounded"
                  style={{
                    background: `color-mix(in srgb, ${tokens.colors.semantic.error} 10%, transparent)`,
                  }}
                >
                  <Icon name="circle-exclamation" class="w-4 h-4" style={{ color: tokens.colors.semantic.error }} />
                  <span class="text-xs" style={{ color: tokens.colors.semantic.error }}>
                    {error()}
                  </span>
                </div>
              </Show>

              <Show when={!loading() && info()}>
                {(data) => (
                  <div class="space-y-4">
                    <div
                      class="p-3 rounded text-sm"
                      style={{
                        background: `color-mix(in srgb, ${tokens.colors.semantic.warning} 10%, transparent)`,
                        color: tokens.colors.semantic.warning,
                      }}
                    >
                      Force pushing to <strong>{data().remoteBranch}</strong> will overwrite{" "}
                      <strong>{data().commitsToOverwrite.length}</strong> commit(s) on the remote.
                    </div>

                    <div class="text-xs space-y-1" style={{ color: tokens.colors.text.muted }}>
                      <div>Local branch: <strong>{data().localBranch}</strong> ({data().localAhead} ahead)</div>
                      <div>Remote branch: <strong>{data().remoteBranch}</strong> ({data().remoteAhead} ahead)</div>
                    </div>

                    <Show when={data().commitsToOverwrite.length > 0}>
                      <div>
                        <div class="text-xs font-medium mb-2" style={{ color: tokens.colors.text.muted }}>
                          Commits that will be overwritten:
                        </div>
                        <div
                          class="rounded overflow-hidden border"
                          style={{ "border-color": tokens.colors.border.divider }}
                        >
                          <For each={data().commitsToOverwrite}>
                            {(commit) => (
                              <div
                                class="flex items-center gap-2 px-3 py-2 border-b last:border-b-0"
                                style={{ "border-color": tokens.colors.border.divider }}
                              >
                                <span
                                  class="text-xs font-mono shrink-0"
                                  style={{ color: tokens.colors.semantic.error }}
                                >
                                  {commit.shortSha}
                                </span>
                                <span
                                  class="text-xs truncate flex-1"
                                  style={{ color: tokens.colors.text.primary }}
                                >
                                  {commit.message}
                                </span>
                                <span
                                  class="text-xs shrink-0"
                                  style={{ color: tokens.colors.text.muted }}
                                >
                                  {commit.author}
                                </span>
                                <span
                                  class="text-xs shrink-0"
                                  style={{ color: tokens.colors.text.muted }}
                                >
                                  {formatDate(commit.date)}
                                </span>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>

                    <div
                      class="p-3 rounded text-xs"
                      style={{
                        background: `color-mix(in srgb, ${tokens.colors.semantic.error} 10%, transparent)`,
                        color: tokens.colors.semantic.error,
                      }}
                    >
                      This action cannot be undone. The overwritten commits may be lost permanently
                      if no other references point to them.
                    </div>
                  </div>
                )}
              </Show>
            </div>

            {/* Footer */}
            <div
              class="flex items-center justify-end gap-3 px-5 py-3 border-t"
              style={{ "border-color": tokens.colors.border.divider }}
            >
              <Button variant="ghost" size="sm" onClick={props.onCancel}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={props.onConfirm}
                disabled={loading() || !!error()}
                style={{
                  background: tokens.colors.semantic.error,
                }}
              >
                <Icon name="cloud" class="w-3.5 h-3.5 mr-1.5" />
                Force Push
              </Button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
