import { createSignal, Show } from "solid-js";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";
import { Button, Input, Textarea } from "@/components/ui";
import { gitCreateAnnotatedTag, gitTagCreate } from "@/utils/tauri-api";

export interface TagCreatorProps {
  repoPath: string;
  targetCommit?: string;
  onClose: () => void;
  onCreated: (name: string) => void;
}

export function TagCreator(props: TagCreatorProps) {
  const [tagName, setTagName] = createSignal("");
  const [tagType, setTagType] = createSignal<"annotated" | "lightweight">("annotated");
  const [message, setMessage] = createSignal("");
  const [taggerName, setTaggerName] = createSignal("");
  const [taggerEmail, setTaggerEmail] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [success, setSuccess] = createSignal(false);

  const isValid = () => {
    const name = tagName().trim();
    if (!name) return false;
    if (name.startsWith("-") || name.endsWith(".") || name.includes("..")) return false;
    if (/[\s~^:?*\[\]\\]/.test(name)) return false;
    if (name.endsWith(".lock")) return false;
    if (tagType() === "annotated" && !message().trim()) return false;
    return true;
  };

  const handleCreate = async () => {
    if (!isValid() || loading()) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const name = tagName().trim();
      const target = props.targetCommit || "HEAD";

      if (tagType() === "annotated") {
        await gitCreateAnnotatedTag(
          props.repoPath,
          name,
          message().trim(),
          taggerName().trim() || undefined,
          taggerEmail().trim() || undefined,
          target
        );
      } else {
        await gitTagCreate(props.repoPath, name, target, false);
      }

      setSuccess(true);
      props.onCreated(name);
    } catch (err) {
      setError(`Failed to create tag: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      class="flex flex-col overflow-hidden rounded-lg border"
      style={{
        background: tokens.colors.surface.card,
        "border-color": tokens.colors.border.divider,
        "max-width": "480px",
        width: "100%",
      }}
    >
      {/* Header */}
      <div
        class="flex items-center justify-between px-4 py-3 border-b"
        style={{ "border-color": tokens.colors.border.divider }}
      >
        <div class="flex items-center gap-2">
          <Icon name="tag" class="w-4 h-4" style={{ color: tokens.colors.icon.default }} />
          <span class="text-sm font-semibold" style={{ color: tokens.colors.text.primary }}>
            Create Tag
          </span>
          <Show when={props.targetCommit}>
            <span
              class="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{
                background: tokens.colors.interactive.hover,
                color: tokens.colors.text.muted,
              }}
            >
              {props.targetCommit?.substring(0, 7)}
            </span>
          </Show>
        </div>
        <button
          class="p-1 rounded hover:bg-white/10 transition-colors"
          onClick={props.onClose}
        >
          <Icon name="xmark" class="w-4 h-4" style={{ color: tokens.colors.icon.default }} />
        </button>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Error */}
        <Show when={error()}>
          <div
            class="flex items-center gap-2 p-2.5 rounded text-xs"
            style={{
              background: `color-mix(in srgb, ${tokens.colors.semantic.error} 10%, transparent)`,
              color: tokens.colors.semantic.error,
            }}
          >
            <Icon name="circle-exclamation" class="w-3.5 h-3.5 shrink-0" />
            {error()}
          </div>
        </Show>

        {/* Success */}
        <Show when={success()}>
          <div
            class="flex items-center gap-2 p-2.5 rounded text-xs"
            style={{
              background: `color-mix(in srgb, ${tokens.colors.semantic.success} 10%, transparent)`,
              color: tokens.colors.semantic.success,
            }}
          >
            <Icon name="check" class="w-3.5 h-3.5 shrink-0" />
            Tag "{tagName()}" created successfully
          </div>
        </Show>

        {/* Tag name */}
        <Input
          label="Tag Name"
          placeholder="v1.0.0"
          value={tagName()}
          onInput={(e) => {
            setTagName(e.currentTarget.value);
            setError(null);
            setSuccess(false);
          }}
          autofocus
        />

        {/* Tag type toggle */}
        <div>
          <div class="text-xs font-medium mb-2" style={{ color: tokens.colors.text.muted }}>
            Tag Type
          </div>
          <div class="flex gap-2">
            <button
              class="flex-1 px-3 py-2 rounded text-xs transition-colors"
              style={{
                background: tagType() === "annotated" ? tokens.colors.interactive.selected : "transparent",
                border: `1px solid ${tagType() === "annotated" ? tokens.colors.semantic.primary : tokens.colors.border.default}`,
                color: tagType() === "annotated" ? tokens.colors.semantic.primary : tokens.colors.text.primary,
                cursor: "pointer",
              }}
              onClick={() => setTagType("annotated")}
            >
              <div class="font-medium">Annotated</div>
              <div class="mt-0.5" style={{ color: tokens.colors.text.muted }}>
                With message & metadata
              </div>
            </button>
            <button
              class="flex-1 px-3 py-2 rounded text-xs transition-colors"
              style={{
                background: tagType() === "lightweight" ? tokens.colors.interactive.selected : "transparent",
                border: `1px solid ${tagType() === "lightweight" ? tokens.colors.semantic.primary : tokens.colors.border.default}`,
                color: tagType() === "lightweight" ? tokens.colors.semantic.primary : tokens.colors.text.primary,
                cursor: "pointer",
              }}
              onClick={() => setTagType("lightweight")}
            >
              <div class="font-medium">Lightweight</div>
              <div class="mt-0.5" style={{ color: tokens.colors.text.muted }}>
                Just a reference
              </div>
            </button>
          </div>
        </div>

        {/* Annotated tag fields */}
        <Show when={tagType() === "annotated"}>
          <Textarea
            label="Message"
            placeholder="Tag message..."
            value={message()}
            onInput={(e) => setMessage(e.currentTarget.value)}
            style={{ "min-height": "80px" }}
          />

          <div class="grid grid-cols-2 gap-3">
            <Input
              label="Tagger Name (optional)"
              placeholder="Uses git config"
              value={taggerName()}
              onInput={(e) => setTaggerName(e.currentTarget.value)}
            />
            <Input
              label="Tagger Email (optional)"
              placeholder="Uses git config"
              value={taggerEmail()}
              onInput={(e) => setTaggerEmail(e.currentTarget.value)}
            />
          </div>
        </Show>
      </div>

      {/* Footer */}
      <div
        class="flex items-center justify-end gap-2 px-4 py-3 border-t"
        style={{ "border-color": tokens.colors.border.divider }}
      >
        <Button variant="ghost" size="sm" onClick={props.onClose} disabled={loading()}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleCreate}
          disabled={!isValid() || loading()}
          loading={loading()}
          icon={<Icon name="tag" class="w-3.5 h-3.5" />}
        >
          Create Tag
        </Button>
      </div>
    </div>
  );
}
