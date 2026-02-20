import { Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { TimelineView, type GitCommitInfo } from "@/components/TimelineView";

export interface TimelinePanelProps {
  filePath: string;
  onClose?: () => void;
  onOpenInGit?: (commit: GitCommitInfo) => void;
}

export function TimelinePanel(props: TimelinePanelProps) {
  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        background: "var(--cortex-bg-primary)",
        "border-radius": "var(--cortex-radius-lg)",
        border: "1px solid var(--cortex-border-default)",
        overflow: "hidden",
      }}
    >
      <Show
        when={props.filePath}
        fallback={
          <div
            style={{
              flex: "1",
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              "justify-content": "center",
              gap: "12px",
              color: "var(--cortex-text-inactive)",
              padding: "24px",
              "text-align": "center",
            }}
          >
            <Icon
              name="clock-rotate-left"
              style={{
                width: "32px",
                height: "32px",
                opacity: "0.5",
              }}
            />
            <span style={{ "font-size": "13px" }}>
              Select a file to view its timeline
            </span>
          </div>
        }
      >
        <TimelineView
          filePath={props.filePath}
          onClose={props.onClose}
          onOpenInGit={props.onOpenInGit}
        />
      </Show>
    </div>
  );
}

export default TimelinePanel;
