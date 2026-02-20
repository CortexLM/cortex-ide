import { JSX, For, Show, createSignal, createEffect } from "solid-js";
import { Icon } from "@/components/ui/Icon";

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed";

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt?: string;
  error?: string;
}

interface TaskProgressProps {
  tasks: Task[];
  loading?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function TaskProgress(props: TaskProgressProps) {
  const [isCollapsed, setIsCollapsed] = createSignal(props.collapsed ?? false);

  createEffect(() => {
    if (props.collapsed !== undefined) {
      setIsCollapsed(props.collapsed);
    }
  });

  const toggleCollapse = () => {
    const newState = !isCollapsed();
    setIsCollapsed(newState);
    props.onToggleCollapse?.();
  };

  const completedCount = () => props.tasks.filter((t) => t.status === "completed").length;
  const totalCount = () => props.tasks.length;
  const progress = () => (totalCount() > 0 ? (completedCount() / totalCount()) * 100 : 0);

  const containerStyle: JSX.CSSProperties = {
    "border-top": "1px solid var(--border-default)",
    background: "var(--surface-base)",
  };

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "10px 14px",
    cursor: "pointer",
  };

  const titleContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "10px",
  };

  const titleStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    "font-weight": "500",
    color: "var(--text-primary)",
  };

  const countStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "12px",
    color: "var(--text-muted)",
  };

  const progressBarContainerStyle: JSX.CSSProperties = {
    flex: "1",
    "max-width": "120px",
    height: "4px",
    background: "var(--surface-hover)",
    "border-radius": "var(--cortex-radius-sm)",
    overflow: "hidden",
    "margin-left": "12px",
  };

  const progressBarStyle = (): JSX.CSSProperties => ({
    height: "100%",
    width: `${progress()}%`,
    background: progress() === 100 ? "var(--state-success)" : "var(--accent-primary)",
    "border-radius": "var(--cortex-radius-sm)",
    transition: "width 300ms ease",
  });

  const listStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "2px",
    padding: "0 14px 12px",
    "max-height": "200px",
    "overflow-y": "auto",
  };

  return (
    <Show when={props.tasks.length > 0 || props.loading}>
      <div style={containerStyle}>
        <div
          style={headerStyle}
          onClick={toggleCollapse}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <div style={titleContainerStyle}>
            <Icon
              name={isCollapsed() ? "chevron-right" : "chevron-down"}
              size={12}
              style={{ color: "var(--text-muted)" }}
            />
            <span style={titleStyle}>Tasks</span>
            <span style={countStyle}>
              {completedCount()}/{totalCount()}
            </span>
          </div>
          <div style={progressBarContainerStyle}>
            <div style={progressBarStyle()} />
          </div>
        </div>

        <Show when={!isCollapsed()}>
          <div style={listStyle}>
            <Show when={props.loading}>
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "8px",
                  padding: "8px 0",
                  color: "var(--text-muted)",
                  "font-size": "12px",
                }}
              >
                <Icon name="spinner" size={14} class="animate-spin" />
                <span>Loading tasks...</span>
              </div>
            </Show>

            <For each={props.tasks}>
              {(task) => <TaskItem task={task} />}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  );
}

interface TaskItemProps {
  task: Task;
}

function TaskItem(props: TaskItemProps) {
  const statusConfig = () => {
    switch (props.task.status) {
      case "pending":
        return {
          icon: "circle",
          color: "var(--text-weaker)",
          lineThrough: false,
        };
      case "in_progress":
        return {
          icon: "spinner",
          color: "var(--accent-primary)",
          lineThrough: false,
          animate: true,
        };
      case "completed":
        return {
          icon: "circle-check",
          color: "var(--state-success)",
          lineThrough: true,
        };
      case "failed":
        return {
          icon: "circle-xmark",
          color: "var(--state-error)",
          lineThrough: false,
        };
    }
  };

  const config = () => statusConfig();

  const itemStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "flex-start",
    gap: "10px",
    padding: "6px 8px",
    "border-radius": "var(--jb-radius-sm)",
    transition: "background 150ms ease",
  };

  const textStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    color:
      props.task.status === "completed"
        ? "var(--text-weaker)"
        : props.task.status === "failed"
        ? "var(--state-error)"
        : "var(--text-primary)",
    "text-decoration": config().lineThrough ? "line-through" : "none",
    "line-height": "1.4",
    flex: "1",
  });

  const errorStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "11px",
    color: "var(--state-error)",
    "margin-top": "4px",
    "padding-left": "24px",
  };

  return (
    <div>
      <div
        style={itemStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <Icon
          name={config().icon as any}
          size={14}
          style={{ color: config().color, "flex-shrink": "0", "margin-top": "2px" }}
          class={config().animate ? "animate-spin" : ""}
        />
        <span style={textStyle()}>{props.task.description}</span>
      </div>
      <Show when={props.task.error}>
        <div style={errorStyle}>{props.task.error}</div>
      </Show>
    </div>
  );
}

