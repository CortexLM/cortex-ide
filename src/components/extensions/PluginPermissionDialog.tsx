import { Component, Show, For, onMount, onCleanup } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { Button, Text } from "@/components/ui";
import { tokens } from "@/design-system/tokens";

export interface PermissionRequest {
  id: string;
  extensionId: string;
  permission: string;
  resource?: string;
  reason?: string;
}

interface PluginPermissionDialogProps {
  requests: PermissionRequest[];
  onRespond: (requestId: string, approved: boolean) => void;
  class?: string;
}

function permissionMeta(permission: string): { icon: string; label: string } {
  switch (permission) {
    case "filesystem": return { icon: "folder", label: "File System" };
    case "shell": case "shell_execute": return { icon: "terminal", label: "Shell Access" };
    case "network": return { icon: "globe", label: "Network" };
    case "clipboard": return { icon: "clipboard", label: "Clipboard" };
    case "env": return { icon: "gear", label: "Environment Variables" };
    default: return { icon: "shield", label: permission };
  }
}

function isDangerous(permission: string): boolean {
  return permission === "shell" || permission === "shell_execute" || permission === "env";
}

export const PluginPermissionDialog: Component<PluginPermissionDialogProps> = (props) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && props.requests.length > 0) {
      props.onRespond(props.requests[0].id, false);
    }
  };

  onMount(() => document.addEventListener("keydown", handleKeyDown));
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown));

  return (
    <Show when={props.requests.length > 0}>
      <div
        class={`fixed inset-0 z-50 flex items-center justify-center ${props.class || ""}`}
        style={{ "background-color": "rgba(0, 0, 0, 0.6)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Plugin Permission Requests"
      >
        <div class="w-full max-w-lg rounded-lg shadow-2xl overflow-hidden" style={{ "background-color": tokens.colors.surface.overlay, border: `1px solid ${tokens.colors.border.default}` }}>
          <div class="flex items-center gap-2 px-4 py-3 border-b" style={{ "border-color": tokens.colors.border.default }}>
            <Icon name="shield" class="w-4 h-4" style={{ color: tokens.colors.semantic.warning }} />
            <Text weight="bold" size="sm">Permission Requests</Text>
            <span class="ml-auto"><Text variant="muted" size="xs">{props.requests.length} pending</Text></span>
          </div>
          <div class="max-h-96 overflow-y-auto">
            <For each={props.requests}>
              {(req) => {
                const meta = permissionMeta(req.permission);
                const dangerous = isDangerous(req.permission);
                return (
                  <div class="px-4 py-3 border-b last:border-b-0" style={{ "border-color": tokens.colors.border.divider, "background-color": dangerous ? "rgba(245, 158, 11, 0.05)" : "transparent" }}>
                    <div class="flex items-start gap-3">
                      <div class="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center mt-0.5" style={{ "background-color": dangerous ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.15)", color: dangerous ? tokens.colors.semantic.error : tokens.colors.semantic.info }}>
                        <Icon name={meta.icon} class="w-4 h-4" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <Text weight="bold" size="sm">{meta.label}</Text>
                          <Show when={dangerous}>
                            <span class="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ "background-color": "rgba(239, 68, 68, 0.2)", color: tokens.colors.semantic.error }}>Dangerous</span>
                          </Show>
                        </div>
                        <Text variant="muted" size="xs" style={{ "margin-top": "2px" }}>Extension: {req.extensionId}</Text>
                        <Show when={req.resource}>
                          <div class="mt-1.5 px-2 py-1 rounded text-xs font-mono truncate" style={{ "background-color": tokens.colors.surface.canvas, color: tokens.colors.text.primary, border: `1px solid ${tokens.colors.border.default}` }} title={req.resource}>{req.resource}</div>
                        </Show>
                        <Show when={req.reason}>
                          <Text variant="muted" size="xs" style={{ "margin-top": "6px", "line-height": "1.4" }}>{req.reason}</Text>
                        </Show>
                        <div class="flex items-center gap-3 mt-3">
                          <Button variant="primary" size="sm" onClick={() => props.onRespond(req.id, true)}>Allow</Button>
                          <Button variant="danger" size="sm" onClick={() => props.onRespond(req.id, false)}>Deny</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
          <div class="flex items-center justify-between px-4 py-2.5 border-t" style={{ "border-color": tokens.colors.border.default, "background-color": tokens.colors.surface.canvas }}>
            <Text variant="muted" size="xs">Review each permission carefully before allowing.</Text>
            <Text variant="muted" size="xs">Press Esc to deny</Text>
          </div>
        </div>
      </div>
    </Show>
  );
};
