import { Show, createEffect } from "solid-js";
import { Markdown } from "@/components/Markdown";

export interface MarkdownCellProps {
  source: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  onToggleEdit: () => void;
}

export function MarkdownCell(props: MarkdownCellProps) {
  let textareaRef: HTMLTextAreaElement | undefined;

  createEffect(() => {
    if (props.isEditing && textareaRef) {
      textareaRef.focus();
      autoResizeTextarea();
    }
  });

  const autoResizeTextarea = () => {
    if (textareaRef) {
      textareaRef.style.height = "auto";
      textareaRef.style.height = `${Math.max(textareaRef.scrollHeight, 80)}px`;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      props.onToggleEdit();
    }
  };

  return (
    <div class="markdown-cell-editor">
      <Show
        when={props.isEditing}
        fallback={
          <div
            class="markdown-preview cursor-pointer p-3"
            style={{
              "min-height": "40px",
              "border-radius": "var(--cortex-radius-sm)",
              background: "transparent",
            }}
            onClick={() => props.onToggleEdit()}
            onDblClick={() => props.onToggleEdit()}
          >
            <Show
              when={props.source.trim()}
              fallback={
                <p
                  class="text-sm italic"
                  style={{ color: "var(--text-weaker)" }}
                >
                  Empty markdown cell. Double-click to edit.
                </p>
              }
            >
              <Markdown content={props.source} />
            </Show>
          </div>
        }
      >
        <textarea
          ref={textareaRef}
          value={props.source}
          onInput={(e) => {
            props.onChange(e.currentTarget.value);
            autoResizeTextarea();
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => props.onToggleEdit()}
          class="w-full resize-none outline-none font-mono text-sm p-3"
          style={{
            background: "var(--surface-base)",
            color: "var(--text-base)",
            border: "1px solid var(--accent)",
            "border-radius": "var(--cortex-radius-sm)",
            "min-height": "80px",
          }}
          placeholder="Enter markdown..."
          rows={3}
        />
      </Show>
    </div>
  );
}
