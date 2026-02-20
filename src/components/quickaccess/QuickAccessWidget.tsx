import { Icon } from "@/components/ui/Icon";
import { useQuickAccess } from "@/context/QuickAccessContext";

export interface QuickAccessWidgetProps {
  initialPrefix?: string;
  showShortcut?: boolean;
}

export function QuickAccessWidget(props: QuickAccessWidgetProps) {
  const quickAccess = useQuickAccess();

  const handleClick = () => {
    quickAccess.show(props.initialPrefix);
  };

  return (
    <button
      onClick={handleClick}
      title={`Quick Access (${navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+P)`}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "8px",
        padding: "6px 12px",
        background: "var(--cortex-bg-tertiary)",
        border: "1px solid var(--cortex-border-default)",
        "border-radius": "var(--cortex-radius-md)",
        color: "var(--cortex-text-secondary)",
        cursor: "pointer",
        "font-size": "12px",
        "min-width": "200px",
        transition: "border-color 0.15s ease, background 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--cortex-border-hover)";
        e.currentTarget.style.background = "var(--cortex-bg-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--cortex-border-default)";
        e.currentTarget.style.background = "var(--cortex-bg-tertiary)";
      }}
    >
      <Icon
        name="magnifying-glass"
        style={{
          width: "14px",
          height: "14px",
          "flex-shrink": "0",
        }}
      />
      <span style={{ flex: "1", "text-align": "left" }}>Search files, commands...</span>
      {props.showShortcut !== false && (
        <span
          style={{
            "font-size": "11px",
            color: "var(--cortex-text-inactive)",
            background: "var(--cortex-bg-secondary)",
            padding: "2px 6px",
            "border-radius": "var(--cortex-radius-sm)",
          }}
        >
          {navigator.platform.includes("Mac") ? "⌘P" : "Ctrl+P"}
        </span>
      )}
    </button>
  );
}

export default QuickAccessWidget;
