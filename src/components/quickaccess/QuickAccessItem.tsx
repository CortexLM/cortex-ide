import { Show, type JSXElement } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import type { QuickPickItem } from "@/context/QuickAccessContext";

export interface QuickAccessItemProps {
  item: QuickPickItem;
  isSelected?: boolean;
  isPinned?: boolean;
  onSelect?: (item: QuickPickItem) => void;
  onPin?: (item: QuickPickItem) => void;
  onUnpin?: (item: QuickPickItem) => void;
}

function highlightMatches(text: string, matches?: number[]): JSXElement {
  if (!matches || matches.length === 0) {
    return <>{text}</>;
  }

  const result: JSXElement[] = [];
  let lastIndex = 0;

  const sortedMatches = [...matches].sort((a, b) => a - b);

  for (const matchIndex of sortedMatches) {
    if (matchIndex > lastIndex) {
      result.push(<span>{text.slice(lastIndex, matchIndex)}</span>);
    }
    result.push(
      <span
        style={{
          color: "var(--cortex-accent-primary)",
          "font-weight": "600",
        }}
      >
        {text[matchIndex]}
      </span>
    );
    lastIndex = matchIndex + 1;
  }

  if (lastIndex < text.length) {
    result.push(<span>{text.slice(lastIndex)}</span>);
  }

  return <>{result}</>;
}

export function QuickAccessItem(props: QuickAccessItemProps) {
  return (
    <div
      onClick={() => props.onSelect?.(props.item)}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "10px",
        padding: "8px 12px",
        background: props.isSelected ? "var(--cortex-bg-selected)" : "transparent",
        cursor: "pointer",
        "border-left": props.isSelected
          ? "2px solid var(--cortex-accent-primary)"
          : "2px solid transparent",
        transition: "background 0.1s ease",
      }}
      onMouseEnter={(e) => {
        if (!props.isSelected) {
          e.currentTarget.style.background = "var(--cortex-bg-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!props.isSelected) {
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      <Show when={props.item.icon}>
        {(IconComponent) => {
          const Comp = IconComponent();
          return (
            <div
              style={{
                width: "20px",
                height: "20px",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                color: props.item.iconColor || "var(--cortex-text-secondary)",
              }}
            >
              <Comp style={{ width: "16px", height: "16px" }} />
            </div>
          );
        }}
      </Show>

      <div style={{ flex: "1", "min-width": "0" }}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              "font-size": "13px",
              color: "var(--cortex-text-primary)",
              overflow: "hidden",
              "text-overflow": "ellipsis",
              "white-space": "nowrap",
            }}
          >
            {highlightMatches(props.item.label, props.item.matches)}
          </span>
          <Show when={props.item.description}>
            <span
              style={{
                "font-size": "12px",
                color: "var(--cortex-text-inactive)",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
              }}
            >
              {props.item.description}
            </span>
          </Show>
        </div>
        <Show when={props.item.detail}>
          <div
            style={{
              "font-size": "11px",
              color: "var(--cortex-text-inactive)",
              "margin-top": "2px",
              overflow: "hidden",
              "text-overflow": "ellipsis",
              "white-space": "nowrap",
            }}
          >
            {props.item.detail}
          </div>
        </Show>
      </div>

      <Show when={props.isPinned !== undefined}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (props.isPinned) {
              props.onUnpin?.(props.item);
            } else {
              props.onPin?.(props.item);
            }
          }}
          title={props.isPinned ? "Unpin" : "Pin"}
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            width: "24px",
            height: "24px",
            background: "transparent",
            border: "none",
            "border-radius": "var(--cortex-radius-sm)",
            color: props.isPinned
              ? "var(--cortex-accent-primary)"
              : "var(--cortex-text-inactive)",
            cursor: "pointer",
            opacity: props.isPinned ? "1" : "0",
            transition: "opacity 0.15s ease",
          }}
          class="pin-button"
        >
          <Icon name="thumbtack" style={{ width: "12px", height: "12px" }} />
        </button>
      </Show>

      <style>{`
        div:hover .pin-button {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}

export default QuickAccessItem;
