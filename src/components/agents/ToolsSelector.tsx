import { JSX, For, createSignal } from "solid-js";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

interface ToolsSelectorProps {
  value: string[];
  onChange: (tools: string[]) => void;
  disabled?: boolean;
}

interface Tool {
  id: string;
  name: string;
  description: string;
  category: "file" | "search" | "execution" | "network" | "utility";
}

const TOOLS: Tool[] = [
  { id: "Read", name: "Read", description: "Read file contents", category: "file" },
  { id: "Create", name: "Create", description: "Create/write files", category: "file" },
  { id: "Edit", name: "Edit", description: "Edit existing files", category: "file" },
  { id: "MultiEdit", name: "MultiEdit", description: "Edit multiple files", category: "file" },
  { id: "LS", name: "LS", description: "List directory contents", category: "file" },
  { id: "Glob", name: "Glob", description: "Find files by pattern", category: "search" },
  { id: "Grep", name: "Grep", description: "Search file contents", category: "search" },
  { id: "Execute", name: "Execute", description: "Execute shell commands", category: "execution" },
  { id: "WebSearch", name: "WebSearch", description: "Search the web", category: "network" },
  { id: "FetchUrl", name: "FetchUrl", description: "Fetch URL content", category: "network" },
  { id: "TodoWrite", name: "TodoWrite", description: "Manage todo lists", category: "utility" },
];

const CATEGORIES = [
  { id: "file", label: "File Operations", icon: "file" },
  { id: "search", label: "Search", icon: "magnifying-glass" },
  { id: "execution", label: "Execution", icon: "terminal" },
  { id: "network", label: "Network", icon: "globe" },
  { id: "utility", label: "Utility", icon: "wrench" },
];

export function ToolsSelector(props: ToolsSelectorProps) {
  const [expandedCategories, setExpandedCategories] = createSignal<string[]>(
    CATEGORIES.map((c) => c.id)
  );

  const toggleTool = (toolId: string) => {
    if (props.disabled) return;
    const current = props.value;
    if (current.includes(toolId)) {
      props.onChange(current.filter((t) => t !== toolId));
    } else {
      props.onChange([...current, toolId]);
    }
  };

  const toggleCategory = (categoryId: string) => {
    const current = expandedCategories();
    if (current.includes(categoryId)) {
      setExpandedCategories(current.filter((c) => c !== categoryId));
    } else {
      setExpandedCategories([...current, categoryId]);
    }
  };

  const selectAllInCategory = (categoryId: string) => {
    if (props.disabled) return;
    const categoryTools = TOOLS.filter((t) => t.category === categoryId).map((t) => t.id);
    const current = new Set(props.value);
    categoryTools.forEach((t) => current.add(t));
    props.onChange(Array.from(current));
  };

  const clearCategory = (categoryId: string) => {
    if (props.disabled) return;
    const categoryTools = new Set(TOOLS.filter((t) => t.category === categoryId).map((t) => t.id));
    props.onChange(props.value.filter((t) => !categoryTools.has(t)));
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "8px",
  };

  const categoryHeaderStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "8px 12px",
    background: "var(--surface-hover)",
    "border-radius": "var(--jb-radius-sm)",
    cursor: "pointer",
  };

  const categoryTitleStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    "font-weight": "500",
    color: "var(--text-primary)",
  };

  const categoryActionsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
    "font-size": "11px",
  };

  const actionButtonStyle: JSX.CSSProperties = {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    "font-family": "var(--jb-font-ui)",
    "font-size": "11px",
    padding: "0",
  };

  const toolsListStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "2px",
    "padding-left": "32px",
    "margin-top": "4px",
  };

  const toolItemStyle = (selected: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "6px 12px",
    background: selected ? "var(--surface-hover)" : "transparent",
    "border-radius": "var(--jb-radius-sm)",
    cursor: props.disabled ? "not-allowed" : "pointer",
    opacity: props.disabled ? "0.5" : "1",
    transition: "background 150ms ease",
  });

  const toolNameStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    color: "var(--text-primary)",
  };

  const toolDescStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "11px",
    color: "var(--text-muted)",
  };

  return (
    <div style={containerStyle}>
      <For each={CATEGORIES}>
        {(category) => {
          const categoryTools = () => TOOLS.filter((t) => t.category === category.id);
          const selectedCount = () =>
            categoryTools().filter((t) => props.value.includes(t.id)).length;
          const isExpanded = () => expandedCategories().includes(category.id);

          return (
            <div>
              <div
                style={categoryHeaderStyle}
                onClick={() => toggleCategory(category.id)}
              >
                <div style={categoryTitleStyle}>
                  <Icon
                    name={isExpanded() ? "chevron-down" : "chevron-right"}
                    size={12}
                  />
                  <Icon name={category.icon as any} size={14} />
                  <span>{category.label}</span>
                  <Badge variant="default" size="sm">
                    {selectedCount()}/{categoryTools().length}
                  </Badge>
                </div>
                <div style={categoryActionsStyle} onClick={(e) => e.stopPropagation()}>
                  <button
                    style={actionButtonStyle}
                    onClick={() => selectAllInCategory(category.id)}
                    disabled={props.disabled}
                  >
                    All
                  </button>
                  <button
                    style={actionButtonStyle}
                    onClick={() => clearCategory(category.id)}
                    disabled={props.disabled}
                  >
                    None
                  </button>
                </div>
              </div>

              {isExpanded() && (
                <div style={toolsListStyle}>
                  <For each={categoryTools()}>
                    {(tool) => {
                      const isSelected = () => props.value.includes(tool.id);
                      return (
                        <div
                          style={toolItemStyle(isSelected())}
                          onClick={() => toggleTool(tool.id)}
                          onMouseEnter={(e) => {
                            if (!props.disabled && !isSelected()) {
                              e.currentTarget.style.background = "var(--surface-hover)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected()) {
                              e.currentTarget.style.background = "transparent";
                            }
                          }}
                        >
                          <div style={toolNameStyle}>
                            <Icon
                              name={isSelected() ? "square-check" : "square"}
                              size={14}
                              style={{
                                color: isSelected()
                                  ? "var(--accent-primary)"
                                  : "var(--text-muted)",
                              }}
                            />
                            <span>{tool.name}</span>
                          </div>
                          <span style={toolDescStyle}>{tool.description}</span>
                        </div>
                      );
                    }}
                  </For>
                </div>
              )}
            </div>
          );
        }}
      </For>
    </div>
  );
}
