import { Show, For, createSignal } from "solid-js";
import { useDebug, Breakpoint, DataBreakpoint, DataBreakpointAccessType, ExceptionBreakpoint, createBreakpointId } from "@/context/DebugContext";
import { useEditor } from "@/context/EditorContext";
import { Icon } from "../ui/Icon";
import { Button, IconButton, Input, Text, Badge } from "@/components/ui";

/**
 * Breakpoints View - VS Code Specification Compliant
 * 
 * Specs:
 * - List row line-height: 22px
 * - Breakpoint: display flex, padding-right 0.8em, margin-left -19px
 * - Breakpoint icon: 19px × 19px, flex centered
 * - Condition/file-path: opacity 0.7, margin-left 0.9em
 * 
 * 5 Breakpoint Types with 4 States each:
 * 1. Standard - Red circle
 * 2. Conditional - Orange circle with "?"
 * 3. Function - Red triangle
 * 4. Data - Purple eye
 * 5. Log (Logpoint) - Blue speech bubble
 * 
 * 4 States:
 * - Enabled (verified)
 * - Disabled (gray)
 * - Unverified (gray)
 * - Pending (gray, 0.7 opacity)
 */

// VS Code-style breakpoint icons as inline SVG
function BreakpointIcon(props: { 
  type: "standard" | "conditional" | "function" | "data" | "log";
  state: "enabled" | "disabled" | "unverified" | "pending";
}) {
  const getColor = () => {
    if (props.state === "disabled" || props.state === "unverified") {
      return "var(--debug-icon-breakpoint-disabled-foreground)";
    }
    if (props.state === "pending") {
      return "var(--debug-icon-breakpoint-unverified-foreground)";
    }
    // Enabled colors by type
    switch (props.type) {
      case "standard": return "var(--debug-icon-breakpoint-foreground)";
      case "conditional": return "var(--cortex-warning)"; // Orange
      case "function": return "var(--debug-icon-breakpoint-foreground)";
      case "data": return "var(--cortex-info)"; // Purple
      case "log": return "var(--cortex-info)"; // Blue
    }
  };

  const opacity = props.state === "pending" ? "0.7" : "1";

  return (
    <div 
      class={`breakpoint-icon-${props.type} ${props.state}`}
      style={{ 
        width: "19px", 
        height: "19px", 
        "min-width": "19px",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        color: getColor(),
        opacity,
      }}
    >
      <Show when={props.type === "standard"}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="6" />
        </svg>
      </Show>
      <Show when={props.type === "conditional"}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="6" />
          <text x="8" y="11" text-anchor="middle" font-size="8" fill="white">?</text>
        </svg>
      </Show>
      <Show when={props.type === "function"}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2L14 13H2L8 2Z" />
        </svg>
      </Show>
      <Show when={props.type === "data"}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="6" />
          <circle cx="8" cy="8" r="2" fill="white" />
        </svg>
      </Show>
      <Show when={props.type === "log"}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 4C2 2.89543 2.89543 2 4 2H12C13.1046 2 14 2.89543 14 4V10C14 11.1046 13.1046 12 12 12H6L2 15V4Z" />
        </svg>
      </Show>
    </div>
  );
}

export function BreakpointsView() {
  const debug = useDebug();
  const editor = useEditor();
  const [editingCondition, setEditingCondition] = createSignal<{
    path: string;
    line: number;
  } | null>(null);
  const [conditionInput, setConditionInput] = createSignal("");
  const [editingLogMessage, setEditingLogMessage] = createSignal<{
    path: string;
    line: number;
  } | null>(null);
  const [logMessageInput, setLogMessageInput] = createSignal("");
  const [showAddFunctionBreakpoint, setShowAddFunctionBreakpoint] = createSignal(false);
  const [newFunctionBreakpointName, setNewFunctionBreakpointName] = createSignal("");
  const [editingFunctionCondition, setEditingFunctionCondition] = createSignal<string | null>(null);
  const [functionConditionInput, setFunctionConditionInput] = createSignal("");
  const [showAddDataBreakpoint, setShowAddDataBreakpoint] = createSignal(false);
  const [newDataBreakpointName, setNewDataBreakpointName] = createSignal("");
  const [newDataBreakpointAccessType, setNewDataBreakpointAccessType] = createSignal<DataBreakpointAccessType>("write");
  const [editingExceptionCondition, setEditingExceptionCondition] = createSignal<string | null>(null);
  const [exceptionConditionInput, setExceptionConditionInput] = createSignal("");
  const [editingHitCount, setEditingHitCount] = createSignal<{ path: string; line: number } | null>(null);
  const [hitCountValue, setHitCountValue] = createSignal("");
  const [hitCountOperator, setHitCountOperator] = createSignal<"=" | ">=" | ">" | "%">(">=");
  
  // Breakpoint groups state
  const [showAddGroup, setShowAddGroup] = createSignal(false);
  const [newGroupName, setNewGroupName] = createSignal("");
  const [editingGroupName, setEditingGroupName] = createSignal<string | null>(null);
  const [editGroupNameInput, setEditGroupNameInput] = createSignal("");
  const [expandedGroups, setExpandedGroups] = createSignal<Set<string>>(new Set());
  const [draggedBreakpointId, setDraggedBreakpointId] = createSignal<string | null>(null);
  const [dropTargetGroupId, setDropTargetGroupId] = createSignal<string | null>(null);
  const [contextMenuBreakpoint, setContextMenuBreakpoint] = createSignal<{ path: string; line: number; column?: number; x: number; y: number } | null>(null);
  
  // Triggered breakpoints state
  const [showTriggeredByPicker, setShowTriggeredByPicker] = createSignal<{ path: string; line: number; column?: number } | null>(null);

  const allBreakpoints = () => {
    const bps: { path: string; breakpoints: Breakpoint[] }[] = [];
    for (const [path, breakpoints] of Object.entries(debug.state.breakpoints)) {
      if (breakpoints.length > 0) {
        bps.push({ path, breakpoints });
      }
    }
    return bps;
  };

  const handleGoToBreakpoint = async (path: string, line: number) => {
    await editor.openFile(path);
    // Small delay to ensure editor is ready after opening the file
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("editor:goto-line", {
          detail: { line, column: 1 },
        })
      );
    }, 100);
  };

  const handleRemoveBreakpoint = async (path: string, line: number, column?: number) => {
    await debug.removeBreakpoint(path, line, column);
  };

  const handleToggleEnabled = async (bp: Breakpoint) => {
    await debug.enableBreakpoint(bp.path, bp.line, !bp.enabled, bp.column);
  };

  const handleEditCondition = (bp: Breakpoint) => {
    setEditingCondition({ path: bp.path, line: bp.line });
    setConditionInput(bp.condition || "");
  };

  const handleSaveCondition = async () => {
    const editing = editingCondition();
    if (!editing) return;
    await debug.setBreakpointCondition(editing.path, editing.line, conditionInput());
    setEditingCondition(null);
    setConditionInput("");
  };

  const handleCancelEdit = () => {
    setEditingCondition(null);
    setConditionInput("");
  };

  const handleEditLogMessage = (bp: Breakpoint) => {
    setEditingLogMessage({ path: bp.path, line: bp.line });
    setLogMessageInput(bp.logMessage || "");
  };

  const handleSaveLogMessage = async () => {
    const editing = editingLogMessage();
    if (!editing) return;
    await debug.setLogpointMessage(editing.path, editing.line, logMessageInput());
    setEditingLogMessage(null);
    setLogMessageInput("");
  };

  const handleCancelLogMessageEdit = () => {
    setEditingLogMessage(null);
    setLogMessageInput("");
  };

  const handleEditHitCount = (bp: Breakpoint) => {
    setEditingHitCount({ path: bp.path, line: bp.line });
    // Parse existing hit condition to extract operator and value
    const existing = bp.hitCondition || "";
    if (existing.startsWith("% ")) {
      setHitCountOperator("%");
      setHitCountValue(existing.replace(/^% (\d+).*/, "$1"));
    } else if (existing.startsWith(">= ")) {
      setHitCountOperator(">=");
      setHitCountValue(existing.replace(">= ", ""));
    } else if (existing.startsWith("> ")) {
      setHitCountOperator(">");
      setHitCountValue(existing.replace("> ", ""));
    } else if (existing.startsWith("= ")) {
      setHitCountOperator("=");
      setHitCountValue(existing.replace("= ", ""));
    } else {
      setHitCountOperator(">=");
      setHitCountValue(existing);
    }
  };

  const handleSaveHitCount = async () => {
    const editing = editingHitCount();
    if (!editing) return;
    
    const operator = hitCountOperator();
    const value = hitCountValue().trim();
    
    let hitCondition = "";
    if (value) {
      if (operator === "%") {
        hitCondition = `% ${value} == 0`;
      } else {
        hitCondition = `${operator} ${value}`;
      }
    }
    
    await debug.setBreakpointHitCondition(editing.path, editing.line, hitCondition);
    setEditingHitCount(null);
    setHitCountValue("");
  };

  const handleCancelHitCountEdit = () => {
    setEditingHitCount(null);
    setHitCountValue("");
  };

  const handleConvertToLogpoint = async (bp: Breakpoint) => {
    const defaultMessage = `Log: line ${bp.line}`;
    await debug.convertToLogpoint(bp.path, bp.line, defaultMessage);
    // Start editing the log message immediately
    setEditingLogMessage({ path: bp.path, line: bp.line });
    setLogMessageInput(defaultMessage);
  };

  const handleConvertToBreakpoint = async (bp: Breakpoint) => {
    await debug.convertToBreakpoint(bp.path, bp.line);
  };

  const handleRemoveAll = async () => {
    await debug.removeAllBreakpoints();
  };

  // Triggered breakpoint handlers
  const handleShowTriggeredByPicker = (bp: Breakpoint) => {
    setShowTriggeredByPicker({ path: bp.path, line: bp.line, column: bp.column });
  };

  const handleSetTriggeredBy = async (triggerId: string | null) => {
    const picker = showTriggeredByPicker();
    if (!picker) return;
    
    await debug.setBreakpointTriggeredBy(picker.path, picker.line, triggerId, picker.column);
    setShowTriggeredByPicker(null);
  };

  const handleClearTriggeredBy = async (bp: Breakpoint) => {
    await debug.setBreakpointTriggeredBy(bp.path, bp.line, null, bp.column);
  };

  /**
   * Gets the trigger breakpoint info for display
   */
  const getTriggerBreakpointInfo = (triggeredBy: string | undefined | null): { fileName: string; line: number } | null => {
    if (!triggeredBy) return null;
    const parts = triggeredBy.split(":");
    if (parts.length < 2) return null;
    // Format: path:line or path:line:column
    const path = parts.slice(0, -1).join(":"); // Handle Windows paths with drive letters
    const line = parseInt(parts[parts.length - 1], 10);
    if (isNaN(line)) {
      // Could be path:line:column format
      const lineNum = parseInt(parts[parts.length - 2], 10);
      if (isNaN(lineNum)) return null;
      return { 
        fileName: parts.slice(0, -2).join(":").split(/[/\\]/).pop() || parts.slice(0, -2).join(":"), 
        line: lineNum 
      };
    }
    return { 
      fileName: path.split(/[/\\]/).pop() || path, 
      line 
    };
  };

  // Function breakpoint handlers
  const handleToggleFunctionEnabled = async (bp: any) => {
    await debug.enableFunctionBreakpoint(bp.name, !bp.enabled);
  };

  const handleRemoveFunctionBreakpoint = async (name: string) => {
    await debug.removeFunctionBreakpoint(name);
  };

  const handleAddFunctionBreakpoint = async () => {
    const name = newFunctionBreakpointName().trim();
    if (!name) return;
    
    await debug.addFunctionBreakpoint(name);
    setNewFunctionBreakpointName("");
    setShowAddFunctionBreakpoint(false);
  };

  const handleCancelAddFunction = () => {
    setNewFunctionBreakpointName("");
    setShowAddFunctionBreakpoint(false);
  };

  const handleEditFunctionCondition = (bp: any) => {
    setEditingFunctionCondition(bp.name);
    setFunctionConditionInput(bp.condition || "");
  };

  const handleSaveFunctionCondition = async () => {
    const name = editingFunctionCondition();
    if (!name) return;
    await debug.setFunctionBreakpointCondition(name, functionConditionInput());
    setEditingFunctionCondition(null);
    setFunctionConditionInput("");
  };

  const handleCancelFunctionConditionEdit = () => {
    setEditingFunctionCondition(null);
    setFunctionConditionInput("");
  };

  // Data breakpoint handlers
  const handleToggleDataBreakpoint = async (bp: DataBreakpoint) => {
    await debug.enableDataBreakpoint(bp.id, !bp.enabled);
  };

  const handleRemoveDataBreakpoint = async (id: string) => {
    await debug.removeDataBreakpoint(id);
  };

  const handleClearDataBreakpoints = async () => {
    await debug.clearDataBreakpoints();
  };

  const handleAddDataBreakpoint = async () => {
    const name = newDataBreakpointName().trim();
    if (!name) return;
    
    await debug.addDataBreakpoint(name, newDataBreakpointAccessType());
    setNewDataBreakpointName("");
    setShowAddDataBreakpoint(false);
  };

  const handleCancelAddDataBreakpoint = () => {
    setNewDataBreakpointName("");
    setShowAddDataBreakpoint(false);
  };

  // Exception breakpoint handlers
  const handleToggleExceptionBreakpoint = async (eb: ExceptionBreakpoint) => {
    await debug.setExceptionBreakpoint(eb.filter, !eb.enabled);
  };

  const handleEditExceptionCondition = (eb: ExceptionBreakpoint) => {
    setEditingExceptionCondition(eb.filter);
    setExceptionConditionInput(eb.condition || "");
  };

  const handleSaveExceptionCondition = async () => {
    const filter = editingExceptionCondition();
    if (!filter) return;
    await debug.setExceptionBreakpointCondition(filter, exceptionConditionInput());
    setEditingExceptionCondition(null);
    setExceptionConditionInput("");
  };

  const handleCancelExceptionConditionEdit = () => {
    setEditingExceptionCondition(null);
    setExceptionConditionInput("");
  };

  const getAccessTypeLabel = (accessType: DataBreakpointAccessType): string => {
    switch (accessType) {
      case "read":
        return "Read";
      case "write":
        return "Write";
      case "readWrite":
        return "Read/Write";
    }
  };

  const getAccessTypeColor = (accessType: DataBreakpointAccessType): string => {
    switch (accessType) {
      case "read":
        return "var(--cortex-success)"; // green
      case "write":
        return "var(--cortex-error)"; // red
      case "readWrite":
        return "var(--cortex-info)"; // purple
    }
  };

  // ============== Breakpoint Groups Handlers ==============

  const handleCreateGroup = () => {
    const name = newGroupName().trim();
    if (!name) return;
    
    const group = debug.createBreakpointGroup(name);
    setNewGroupName("");
    setShowAddGroup(false);
    // Auto-expand the new group
    setExpandedGroups((prev) => new Set([...prev, group.id]));
  };

  const handleCancelAddGroup = () => {
    setNewGroupName("");
    setShowAddGroup(false);
  };

  const handleDeleteGroup = (groupId: string) => {
    debug.deleteBreakpointGroup(groupId);
  };

  const handleRenameGroup = (groupId: string) => {
    const group = debug.state.breakpointGroups.find((g) => g.id === groupId);
    if (group) {
      setEditingGroupName(groupId);
      setEditGroupNameInput(group.name);
    }
  };

  const handleSaveGroupName = () => {
    const groupId = editingGroupName();
    if (!groupId) return;
    
    const newName = editGroupNameInput().trim();
    if (newName) {
      debug.renameBreakpointGroup(groupId, newName);
    }
    setEditingGroupName(null);
    setEditGroupNameInput("");
  };

  const handleCancelRenameGroup = () => {
    setEditingGroupName(null);
    setEditGroupNameInput("");
  };

  const handleToggleGroup = async (groupId: string) => {
    await debug.toggleBreakpointGroup(groupId);
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Drag and drop handlers
  const handleDragStart = (breakpointId: string, e: DragEvent) => {
    setDraggedBreakpointId(breakpointId);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", breakpointId);
    }
  };

  const handleDragEnd = () => {
    setDraggedBreakpointId(null);
    setDropTargetGroupId(null);
  };

  const handleDragOver = (groupId: string, e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    setDropTargetGroupId(groupId);
  };

  const handleDragLeave = () => {
    setDropTargetGroupId(null);
  };

  const handleDrop = (groupId: string, e: DragEvent) => {
    e.preventDefault();
    const breakpointId = draggedBreakpointId();
    if (breakpointId) {
      debug.addBreakpointToGroup(groupId, breakpointId);
    }
    setDraggedBreakpointId(null);
    setDropTargetGroupId(null);
  };

  const handleRemoveFromGroup = (groupId: string, breakpointId: string) => {
    debug.removeBreakpointFromGroup(groupId, breakpointId);
  };

  // Context menu for breakpoint
  const handleBreakpointContextMenu = (bp: Breakpoint, e: MouseEvent) => {
    e.preventDefault();
    setContextMenuBreakpoint({
      path: bp.path,
      line: bp.line,
      column: bp.column,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleAddToGroupFromMenu = (groupId: string) => {
    const bp = contextMenuBreakpoint();
    if (bp) {
      const breakpointId = createBreakpointId(bp.path, bp.line, bp.column);
      debug.addBreakpointToGroup(groupId, breakpointId);
    }
    setContextMenuBreakpoint(null);
  };

  const handleCreateGroupFromMenu = () => {
    const bp = contextMenuBreakpoint();
    if (bp) {
      const breakpointId = createBreakpointId(bp.path, bp.line, bp.column);
      const group = debug.createBreakpointGroup(`Group ${debug.state.breakpointGroups.length + 1}`);
      debug.addBreakpointToGroup(group.id, breakpointId);
      setExpandedGroups((prev) => new Set([...prev, group.id]));
    }
    setContextMenuBreakpoint(null);
  };

  const closeContextMenu = () => {
    setContextMenuBreakpoint(null);
  };

  // Get breakpoint by ID
  const getBreakpointById = (breakpointId: string): Breakpoint | undefined => {
    for (const [_path, breakpoints] of Object.entries(debug.state.breakpoints)) {
      for (const bp of breakpoints) {
        const bpId = createBreakpointId(bp.path, bp.line, bp.column);
        if (bpId === breakpointId) {
          return bp;
        }
      }
    }
    return undefined;
  };

  const getFileName = (path: string) => {
    return path.split(/[/\\]/).pop() || path;
  };

  // Determine breakpoint type and state for icon
  const getBreakpointType = (bp: Breakpoint): "standard" | "conditional" | "log" => {
    if (bp.logMessage) return "log";
    if (bp.condition) return "conditional";
    return "standard";
  };

  const getBreakpointState = (bp: Breakpoint): "enabled" | "disabled" | "unverified" | "pending" => {
    if (!bp.enabled) return "disabled";
    if (!bp.verified) return "unverified";
    return "enabled";
  };

  // Detect platform for font size
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const fontSize = isMac ? "11px" : "13px";

  return (
    <div class="debug-breakpoints p-2">
      {/* Header with remove all button */}
      <Show when={allBreakpoints().length > 0}>
        <div class="flex items-center justify-end mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveAll}
            title="Remove all breakpoints"
            icon={<Icon name="circle-xmark" size="xs" />}
          >
            Clear All
          </Button>
        </div>
      </Show>

      <Show
        when={allBreakpoints().length > 0}
        fallback={
          <Text variant="muted" align="center" as="div" style={{ padding: "1rem 0" }}>
            No breakpoints set.
            <br />
            Click in the editor gutter to add breakpoints.
          </Text>
        }
      >
        <For each={allBreakpoints()}>
          {(file) => (
            <div class="mb-3">
              {/* File header */}
              <div
                class="flex items-center gap-1.5 text-xs mb-1 px-1"
                style={{ color: "var(--text-weak)" }}
              >
                <Icon name="file" size="xs" />
                <span class="truncate" title={file.path}>
                  {getFileName(file.path)}
                </span>
              </div>

              {/* Breakpoints in this file */}
              <For each={file.breakpoints}>
                {(bp) => {
                  const isEditing = () => {
                    const e = editingCondition();
                    return e?.path === bp.path && e?.line === bp.line;
                  };

                  const isEditingLog = () => {
                    const e = editingLogMessage();
                    return e?.path === bp.path && e?.line === bp.line;
                  };

                  const isLogpoint = () => Boolean(bp.logMessage);

                  const breakpointId = createBreakpointId(bp.path, bp.line, bp.column);

                  return (
                    <div class="mb-1">
                      {/* VS Code spec: display flex, padding-right 0.8em, line-height 22px */}
                      <div
                        class="breakpoint group flex items-center rounded transition-colors cursor-pointer hover:bg-[var(--surface-raised)]"
                        style={{ 
                          opacity: bp.enabled ? 1 : 0.65,  // VS Code disabled opacity
                          height: "22px",
                          "line-height": "22px",
                          "padding-right": "0.8em",
                          "font-size": fontSize,
                        }}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(breakpointId, e)}
                        onDragEnd={handleDragEnd}
                        onContextMenu={(e) => handleBreakpointContextMenu(bp, e)}
                        onClick={() => handleGoToBreakpoint(bp.path, bp.line)}
                      >
                        {/* VS Code-style breakpoint icon - 19px × 19px */}
                        <IconButton
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleEnabled(bp);
                          }}
                          tooltip={bp.enabled ? (isLogpoint() ? "Disable logpoint" : "Disable breakpoint") : (isLogpoint() ? "Enable logpoint" : "Enable breakpoint")}
                        >
                          <BreakpointIcon 
                            type={getBreakpointType(bp)} 
                            state={getBreakpointState(bp)} 
                          />
                        </IconButton>

                        {/* Chain icon for triggered breakpoints */}
                        <Show when={bp.isTriggeredBreakpoint}>
                          <span
                            class="flex items-center justify-center"
                            style={{
                              width: "14px",
                              height: "14px",
                              color: bp.enabled ? "var(--cortex-success)" : "var(--cortex-text-inactive)",
                            }}
                            title={bp.enabled ? "Triggered breakpoint (active)" : "Triggered breakpoint (waiting for trigger)"}
                          >
                            <Icon name="link" size="xs" />
                          </span>
                        </Show>

                        {/* Line number and info - VS Code spec: name overflow ellipsis */}
                        <div class="name flex-1 min-w-0" style={{ overflow: "hidden", "text-overflow": "ellipsis" }}>
                          <span style={{ color: "var(--text-base)" }}>
                            Line {bp.line}{bp.column !== undefined ? `:${bp.column}` : ""}
                          </span>
                          <Show when={bp.column !== undefined}>
                            <span
                              class="inline-badge"
                              style={{
                                "margin-left": "0.5em",
                                padding: "0 4px",
                                "border-radius": "var(--cortex-radius-sm)",
                                background: "var(--cortex-error)20",
                                color: "var(--cortex-error)",
                                "font-size": "10px",
                              }}
                              title={`Inline breakpoint at column ${bp.column}`}
                            >
                              inline
                            </span>
                          </Show>
                          {/* VS Code spec: condition opacity 0.7, margin-left 0.9em */}
                          <Show when={bp.condition && !isLogpoint()}>
                            <span
                              class="condition truncate"
                              style={{ 
                                opacity: "0.7",
                                "margin-left": "0.9em",
                                color: "var(--cortex-warning)",
                              }}
                            >
                              when: {bp.condition}
                            </span>
                          </Show>
                          <Show when={isLogpoint()}>
                            <span
                              class="condition truncate max-w-[150px] inline-block align-bottom"
                              style={{ 
                                opacity: "0.7",
                                "margin-left": "0.9em",
                                color: "var(--cortex-info)",
                              }}
                              title={bp.logMessage}
                            >
                              log: {bp.logMessage}
                            </span>
                            <Show when={bp.logHitCount && bp.logHitCount > 0}>
                              <span
                                style={{ 
                                  "margin-left": "4px",
                                  color: "var(--text-weak)",
                                }}
                              >
                                ({bp.logHitCount}×)
                              </span>
                            </Show>
                          </Show>
                          <Show when={bp.message}>
                            <span
                              class="italic"
                              style={{ 
                                opacity: "0.7",
                                "margin-left": "0.9em",
                                color: "var(--cortex-warning)",
                              }}
                            >
                              {bp.message}
                            </span>
                          </Show>
                          <Show when={bp.hitCondition && !isLogpoint()}>
                            <span
                              class="hit-count-badge"
                              style={{
                                "margin-left": "0.5em",
                                padding: "0 4px",
                                "border-radius": "var(--cortex-radius-sm)",
                                background: "var(--cortex-success)20",
                                color: "var(--cortex-success)",
                                "font-size": "10px",
                              }}
                              title={`Break when hit count ${bp.hitCondition}`}
                            >
                              hit: {bp.hitCondition}
                            </span>
                          </Show>
                          {/* Triggered-by indicator */}
                          <Show when={bp.triggeredBy}>
                            {(() => {
                              const triggerInfo = getTriggerBreakpointInfo(bp.triggeredBy);
                              return (
                                <span
                                  class="triggered-by-badge"
                                  style={{
                                    "margin-left": "0.5em",
                                    padding: "0 4px",
                                    "border-radius": "var(--cortex-radius-sm)",
                                    background: bp.enabled ? "var(--cortex-success)20" : "var(--cortex-text-inactive)20",
                                    color: bp.enabled ? "var(--cortex-success)" : "var(--cortex-text-inactive)",
                                    "font-size": "10px",
                                    display: "inline-flex",
                                    "align-items": "center",
                                    gap: "2px",
                                  }}
                                  title={`Triggered by breakpoint at ${bp.triggeredBy}`}
                                >
                                    <Icon name="link" style={{ width: "10px", height: "10px" }} />
                                  {triggerInfo ? `${triggerInfo.fileName}:${triggerInfo.line}` : bp.triggeredBy}
                                </span>
                              );
                            })()}
                          </Show>
                        </div>

                        {/* Convert breakpoint/logpoint button */}
                        <Show when={isLogpoint()}>
                          <IconButton
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConvertToBreakpoint(bp);
                            }}
                            style={{ opacity: "0" }}
                            class="group-hover:opacity-100"
                            tooltip="Convert to breakpoint"
                          >
                            <Icon name="rotate" size="xs" />
                          </IconButton>
                        </Show>
                        <Show when={!isLogpoint()}>
                          <IconButton
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConvertToLogpoint(bp);
                            }}
                            style={{ opacity: "0" }}
                            class="group-hover:opacity-100"
                            tooltip="Convert to logpoint"
                          >
                            <Icon name="comment" size="xs" />
                          </IconButton>
                        </Show>

                        {/* Edit condition/log message button */}
                        <Show when={isLogpoint()}>
                          <IconButton
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditLogMessage(bp);
                            }}
                            style={{ opacity: "0" }}
                            class="group-hover:opacity-100"
                            tooltip="Edit log message"
                          >
                            <Icon name="pen" size="xs" />
                          </IconButton>
                        </Show>
                        <Show when={!isLogpoint()}>
                          <IconButton
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCondition(bp);
                            }}
                            style={{ opacity: "0" }}
                            class="group-hover:opacity-100"
                            tooltip="Edit condition"
                          >
                            <Icon name="pen" size="xs" />
                          </IconButton>
                        </Show>

                        {/* Edit hit count button - only for non-logpoints */}
                        <Show when={!isLogpoint()}>
                          <IconButton
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditHitCount(bp);
                            }}
                            style={{ opacity: "0", color: bp.hitCondition ? "var(--cortex-success)" : undefined }}
                            class="group-hover:opacity-100"
                            tooltip="Edit hit count condition"
                          >
                            <Icon name="hashtag" size="xs" />
                          </IconButton>
                        </Show>

                        {/* Set/Clear Triggered By button */}
                        <Show when={!isLogpoint()}>
                          <IconButton
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (bp.triggeredBy) {
                                handleClearTriggeredBy(bp);
                              } else {
                                handleShowTriggeredByPicker(bp);
                              }
                            }}
                            style={{ opacity: "0", color: bp.triggeredBy ? "var(--cortex-success)" : undefined }}
                            class="group-hover:opacity-100"
                            tooltip={bp.triggeredBy ? "Clear triggered by (make independent)" : "Set triggered by (make dependent on another breakpoint)"}
                          >
                            <Icon name="link" size="xs" />
                          </IconButton>
                        </Show>

                        {/* Remove button */}
                        <IconButton
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveBreakpoint(bp.path, bp.line, bp.column);
                          }}
                          style={{ opacity: "0" }}
                          class="group-hover:opacity-100"
                          tooltip={bp.column !== undefined ? "Remove inline breakpoint" : (isLogpoint() ? "Remove logpoint" : "Remove breakpoint")}
                        >
                          <Icon name="trash" size="xs" />
                        </IconButton>
                      </div>

                      {/* Condition editing */}
                      <Show when={isEditing()}>
                        <div class="flex items-center gap-1 px-2 py-1 ml-6">
                          <Input
                            type="text"
                            value={conditionInput()}
                            onInput={(e) => setConditionInput(e.currentTarget.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveCondition();
                              if (e.key === "Escape") handleCancelEdit();
                            }}
                            placeholder="Enter condition (e.g., x > 5)"
                            style={{ flex: "1" }}
                            autofocus
                          />
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSaveCondition}
                          >
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </Button>
                        </div>
                      </Show>

                      {/* Log message editing */}
                      <Show when={isEditingLog()}>
                        <div class="flex flex-col gap-1 px-2 py-1 ml-6">
                          <Text variant="muted" size="xs">
                            Use {"{expression}"} to interpolate values (e.g., "x = {"{x}"}")
                          </Text>
                          <div class="flex items-center gap-1">
                            <Input
                              type="text"
                              value={logMessageInput()}
                              onInput={(e) => setLogMessageInput(e.currentTarget.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveLogMessage();
                                if (e.key === "Escape") handleCancelLogMessageEdit();
                              }}
                              placeholder="Log message (e.g., Value is {x})"
                              style={{ flex: "1", border: "1px solid var(--cortex-info)" }}
                              autofocus
                            />
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={handleSaveLogMessage}
                              style={{ background: "var(--cortex-info)" }}
                            >
                              Save
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelLogMessageEdit}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </Show>

                      {/* Hit count editing */}
                      <Show when={editingHitCount()?.path === bp.path && editingHitCount()?.line === bp.line}>
                        <div class="flex flex-col gap-1 px-2 py-1 ml-6">
                          <Text variant="muted" size="xs">
                            Break when hit count meets condition
                          </Text>
                          <div class="flex items-center gap-1">
                            <select
                              value={hitCountOperator()}
                              onChange={(e) => setHitCountOperator(e.currentTarget.value as "=" | ">=" | ">" | "%")}
                              class="px-2 py-1 text-xs rounded outline-none"
                              style={{
                                background: "var(--surface-sunken)",
                                color: "var(--text-base)",
                                border: "1px solid var(--cortex-success)",
                              }}
                            >
                              <option value="=">=</option>
                              <option value=">=">≥</option>
                              <option value=">">{">"}</option>
                              <option value="%">% (every Nth)</option>
                            </select>
                            <Input
                              type="number"
                              min="1"
                              value={hitCountValue()}
                              onInput={(e) => setHitCountValue(e.currentTarget.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveHitCount();
                                if (e.key === "Escape") handleCancelHitCountEdit();
                              }}
                              placeholder="e.g., 5"
                              style={{
                                flex: "1",
                                border: "1px solid var(--cortex-success)",
                                "max-width": "80px",
                              }}
                              autofocus
                            />
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={handleSaveHitCount}
                              style={{ background: "var(--cortex-success)" }}
                            >
                              Save
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelHitCountEdit}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          )}
        </For>
      </Show>

      {/* Breakpoint Groups Section */}
      <div class="mt-4 border-t border-[var(--border-weak)] pt-3">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-weak)" }}>
            <Icon name="folder" size="xs" />
            <Text variant="muted" size="xs">Groups</Text>
          </div>
          <IconButton
            size="sm"
            onClick={() => setShowAddGroup(true)}
            tooltip="Create new breakpoint group"
          >
            <Icon name="plus" size="xs" />
          </IconButton>
        </div>

        {/* Add group form */}
        <Show when={showAddGroup()}>
          <div class="mb-2 p-2 rounded" style={{ background: "var(--surface-sunken)" }}>
            <Input
              type="text"
              value={newGroupName()}
              onInput={(e) => setNewGroupName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateGroup();
                if (e.key === "Escape") handleCancelAddGroup();
              }}
              placeholder="Group name"
              style={{ width: "100%", "margin-bottom": "0.5rem" }}
              autofocus
            />
            <div class="flex items-center gap-1">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateGroup}
              >
                Create
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelAddGroup}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Show>

        {/* Groups list */}
        <Show
          when={debug.state.breakpointGroups.length > 0}
          fallback={
            <Show when={!showAddGroup()}>
              <Text variant="muted" size="xs" align="center" as="div" style={{ padding: "0.5rem 0" }}>
                No groups created.
                <br />
                <Text size="xs" variant="muted">Drag breakpoints here to organize them.</Text>
              </Text>
            </Show>
          }
        >
          <For each={debug.state.breakpointGroups}>
            {(group) => {
              const isExpanded = () => expandedGroups().has(group.id);
              const isDropTarget = () => dropTargetGroupId() === group.id;
              const isEditingName = () => editingGroupName() === group.id;

              return (
                <div class="mb-1">
                  {/* Group header */}
                  <div
                    class={`group flex items-center gap-1 px-1 rounded text-xs transition-colors cursor-pointer ${
                      isDropTarget() ? "bg-[var(--accent)]" : "hover:bg-[var(--surface-raised)]"
                    }`}
                    style={{ 
                      height: "22px",
                      opacity: group.enabled ? 1 : 0.5,
                      border: isDropTarget() ? "1px dashed var(--accent)" : "1px solid transparent",
                    }}
                    onDragOver={(e) => handleDragOver(group.id, e)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(group.id, e)}
                    onClick={() => toggleGroupExpanded(group.id)}
                  >
                    {/* Expand/collapse icon */}
                    <span class="text-[10px]" style={{ color: "var(--text-weak)" }}>
                      <Show when={isExpanded()} fallback={<Icon name="chevron-right" size="xs" />}>
                        <Icon name="chevron-down" size="xs" />
                      </Show>
                    </span>

                    {/* Enable/disable toggle */}
                    <IconButton
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleGroup(group.id);
                      }}
                      tooltip={group.enabled ? "Disable group" : "Enable group"}
                    >
                      <Show
                        when={group.enabled}
                        fallback={
                          <div
                            class="w-3.5 h-3.5 border rounded"
                            style={{ "border-color": "var(--text-weak)" }}
                          />
                        }
                      >
                        <div
                          class="w-3.5 h-3.5 rounded flex items-center justify-center"
                          style={{ background: "var(--accent)" }}
                        >
                          <Icon name="check" style={{ width: "10px", height: "10px", color: "white" }} />
                        </div>
                      </Show>
                    </IconButton>

                    {/* Group name (editable) */}
                    <Show
                      when={!isEditingName()}
                      fallback={
                        <Input
                          type="text"
                          value={editGroupNameInput()}
                          onInput={(e) => setEditGroupNameInput(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") handleSaveGroupName();
                            if (e.key === "Escape") handleCancelRenameGroup();
                          }}
                          onBlur={handleSaveGroupName}
                          onClick={(e) => e.stopPropagation()}
                          style={{ flex: "1", border: "1px solid var(--accent)" }}
                          autofocus
                        />
                      }
                    >
                      <span 
                        class="flex-1 truncate" 
                        style={{ color: "var(--text-base)" }}
                        onDblClick={(e) => {
                          e.stopPropagation();
                          handleRenameGroup(group.id);
                        }}
                        title={`${group.name} (${group.breakpointIds.length} breakpoints) - Double-click to rename`}
                      >
                        {group.name}
                        <span class="ml-1 text-[10px]" style={{ color: "var(--text-weak)" }}>
                          ({group.breakpointIds.length})
                        </span>
                      </span>
                    </Show>

                    {/* Edit name button */}
                    <IconButton
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameGroup(group.id);
                      }}
                      style={{ opacity: "0" }}
                      class="group-hover:opacity-100"
                      tooltip="Rename group"
                    >
                      <Icon name="pen" size="xs" />
                    </IconButton>

                    {/* Delete group button */}
                    <IconButton
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup(group.id);
                      }}
                      style={{ opacity: "0" }}
                      class="group-hover:opacity-100"
                      tooltip="Delete group"
                    >
                      <Icon name="trash" size="xs" />
                    </IconButton>
                  </div>

                  {/* Group breakpoints (expanded) */}
                  <Show when={isExpanded()}>
                    <div class="ml-4 mt-1">
                      <Show
                        when={group.breakpointIds.length > 0}
                        fallback={
                          <Text variant="muted" size="xs" as="div" style={{ padding: "0.25rem 0.5rem" }}>
                            No breakpoints in this group
                          </Text>
                        }
                      >
                        <For each={group.breakpointIds}>
                          {(breakpointId) => {
                            const bp = getBreakpointById(breakpointId);
                            
                            return (
                              <Show when={bp}>
                                <div
                                  class="group flex items-center gap-1 px-1 rounded text-xs transition-colors cursor-pointer hover:bg-[var(--surface-raised)]"
                                  style={{ height: "20px", opacity: bp!.enabled ? 1 : 0.5 }}
                                  onClick={() => handleGoToBreakpoint(bp!.path, bp!.line)}
                                >
                                  <BreakpointIcon 
                                    type={getBreakpointType(bp!)} 
                                    state={getBreakpointState(bp!)} 
                                  />
                                  <span class="truncate flex-1" style={{ color: "var(--text-base)" }}>
                                    {getFileName(bp!.path)}:{bp!.line}
                                  </span>
                                  <IconButton
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveFromGroup(group.id, breakpointId);
                                    }}
                                    style={{ opacity: "0" }}
                                    class="group-hover:opacity-100"
                                    tooltip="Remove from group"
                                  >
                                    <Icon name="circle-xmark" size="xs" />
                                  </IconButton>
                                </div>
                              </Show>
                            );
                          }}
                        </For>
                      </Show>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>
      </div>

      {/* Function Breakpoints Section */}
      <div class="mt-4 border-t border-[var(--border-weak)] pt-3">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-weak)" }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2L14 13H2L8 2Z" />
            </svg>
            <Text variant="muted" size="xs">Function Breakpoints</Text>
          </div>
          <IconButton
            size="sm"
            onClick={() => setShowAddFunctionBreakpoint(true)}
            tooltip="Add function breakpoint"
          >
            <Icon name="plus" size="xs" />
          </IconButton>
        </div>

        {/* Add function breakpoint form */}
        <Show when={showAddFunctionBreakpoint()}>
          <div class="mb-2 p-2 rounded" style={{ background: "var(--surface-sunken)" }}>
            <Input
              type="text"
              value={newFunctionBreakpointName()}
              onInput={(e) => setNewFunctionBreakpointName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddFunctionBreakpoint();
                if (e.key === "Escape") handleCancelAddFunction();
              }}
              placeholder="Function name (e.g., main)"
              style={{ width: "100%", "margin-bottom": "0.5rem" }}
              autofocus
            />
            <div class="flex items-center gap-1">
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddFunctionBreakpoint}
              >
                Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelAddFunction}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Show>

        {/* Function breakpoints list */}
        <Show
          when={debug.state.functionBreakpoints.length > 0}
          fallback={
            <Show when={!showAddFunctionBreakpoint()}>
              <Text variant="muted" size="xs" align="center" as="div" style={{ padding: "0.5rem 0" }}>
                No function breakpoints set.
              </Text>
            </Show>
          }
        >
          <For each={debug.state.functionBreakpoints}>
            {(bp) => {
              const isEditing = () => editingFunctionCondition() === bp.name;

              return (
                <div class="mb-1">
                  <div
                    class="group flex items-center gap-2 px-2 rounded text-xs transition-colors hover:bg-[var(--surface-raised)]"
                    style={{ opacity: bp.enabled ? 1 : 0.5, height: "22px" }}
                  >
                    <IconButton
                      size="sm"
                      onClick={() => handleToggleFunctionEnabled(bp)}
                      tooltip={bp.enabled ? "Disable breakpoint" : "Enable breakpoint"}
                    >
                      <BreakpointIcon 
                        type="function" 
                        state={bp.enabled ? (bp.verified ? "enabled" : "unverified") : "disabled"} 
                      />
                    </IconButton>

                    <div class="flex-1 min-w-0 truncate" title={bp.name}>
                      <Text>{bp.name}</Text>
                      <Show when={bp.condition}>
                        <Text variant="muted" style={{ "margin-left": "0.5rem", opacity: "0.7", color: "var(--cortex-warning)" }}>
                          when: {bp.condition}
                        </Text>
                      </Show>
                    </div>

                    <IconButton
                      size="sm"
                      onClick={() => handleEditFunctionCondition(bp)}
                      style={{ opacity: "0" }}
                      class="group-hover:opacity-100"
                      tooltip="Edit condition"
                    >
                      <Icon name="pen" size="xs" />
                    </IconButton>

                    <IconButton
                      size="sm"
                      onClick={() => handleRemoveFunctionBreakpoint(bp.name)}
                      style={{ opacity: "0" }}
                      class="group-hover:opacity-100"
                      tooltip="Remove breakpoint"
                    >
                      <Icon name="trash" size="xs" />
                    </IconButton>
                  </div>

                  <Show when={isEditing()}>
                    <div class="flex items-center gap-1 px-2 py-1 ml-6">
                      <Input
                        type="text"
                        value={functionConditionInput()}
                        onInput={(e) => setFunctionConditionInput(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveFunctionCondition();
                          if (e.key === "Escape") handleCancelFunctionConditionEdit();
                        }}
                        placeholder="Condition"
                        style={{ flex: "1" }}
                        autofocus
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveFunctionCondition}
                      >
                        Save
                      </Button>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>
      </div>

      {/* Data Breakpoints Section */}
      <div class="mt-4 border-t border-[var(--border-weak)] pt-3">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-weak)" }}>
            <Icon name="eye" size="xs" />
            <Text variant="muted" size="xs">Data Breakpoints</Text>
          </div>
          <div class="flex items-center gap-1">
            <Show when={debug.state.dataBreakpoints.length > 0}>
              <IconButton
                size="sm"
                onClick={handleClearDataBreakpoints}
                tooltip="Clear all data breakpoints"
              >
                <Icon name="circle-xmark" size="xs" />
              </IconButton>
            </Show>
            <IconButton
              size="sm"
              onClick={() => setShowAddDataBreakpoint(true)}
              tooltip="Add data breakpoint"
            >
              <Icon name="plus" size="xs" />
            </IconButton>
          </div>
        </div>

        {/* Add data breakpoint form */}
        <Show when={showAddDataBreakpoint()}>
          <div class="mb-2 p-2 rounded" style={{ background: "var(--surface-sunken)" }}>
            <Text variant="muted" size="xs" as="div" style={{ "margin-bottom": "0.5rem" }}>
              Break when variable is accessed
            </Text>
            <Input
              type="text"
              value={newDataBreakpointName()}
              onInput={(e) => setNewDataBreakpointName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddDataBreakpoint();
                if (e.key === "Escape") handleCancelAddDataBreakpoint();
              }}
              placeholder="Variable name (e.g., myObj.property)"
              style={{ width: "100%", "margin-bottom": "0.5rem" }}
              autofocus
            />
            <div class="flex items-center gap-2 mb-2">
              <Text variant="muted" size="xs" as="label">Access type:</Text>
              <select
                value={newDataBreakpointAccessType()}
                onChange={(e) => setNewDataBreakpointAccessType(e.currentTarget.value as DataBreakpointAccessType)}
                class="px-2 py-1 text-xs rounded outline-none"
                style={{
                  background: "var(--surface-base)",
                  color: "var(--text-base)",
                  border: "1px solid var(--border-weak)",
                }}
              >
                <option value="read">Read</option>
                <option value="write">Write</option>
                <option value="readWrite">Read/Write</option>
              </select>
            </div>
            <div class="flex items-center gap-1">
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddDataBreakpoint}
                style={{ background: "var(--cortex-info)" }}
              >
                Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelAddDataBreakpoint}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Show>

        {/* Data breakpoints list */}
        <Show
          when={debug.state.dataBreakpoints.length > 0}
          fallback={
            <Show when={!showAddDataBreakpoint()}>
              <Text variant="muted" size="xs" align="center" as="div" style={{ padding: "0.5rem 0" }}>
                No data breakpoints set.
                <br />
                <Text size="xs" variant="muted">Right-click on a variable to add a data breakpoint.</Text>
              </Text>
            </Show>
          }
        >
          <For each={debug.state.dataBreakpoints}>
            {(bp) => (
              <div
                class="group flex items-center gap-2 px-2 rounded text-xs transition-colors cursor-pointer hover:bg-[var(--surface-raised)]"
                style={{ opacity: bp.enabled ? 1 : 0.5, height: "22px" }}
              >
                {/* Enable/disable toggle with eye icon */}
                <IconButton
                  size="sm"
                  onClick={() => handleToggleDataBreakpoint(bp)}
                  style={{ color: bp.enabled ? getAccessTypeColor(bp.accessType) : undefined }}
                  tooltip={bp.enabled ? "Disable data breakpoint" : "Enable data breakpoint"}
                >
                  <Show
                    when={bp.enabled}
                    fallback={<Icon name="circle" size="xs" />}
                  >
                    <Icon name="eye" size="xs" />
                  </Show>
                </IconButton>

                {/* Variable name and access type */}
                <div class="flex-1 min-w-0">
                  <Text style={{ "font-family": "monospace" }}>
                    {bp.variableName}
                  </Text>
                  <Badge
                    style={{
                      "margin-left": "0.5rem",
                      color: getAccessTypeColor(bp.accessType),
                      background: `${getAccessTypeColor(bp.accessType)}20`,
                    }}
                  >
                    {getAccessTypeLabel(bp.accessType)}
                  </Badge>
                  <Show when={bp.hitCount > 0}>
                    <Text variant="muted" size="xs" style={{ "margin-left": "0.25rem" }}>
                      ({bp.hitCount}×)
                    </Text>
                  </Show>
                  <Show when={bp.verified === false}>
                    <Text variant="muted" size="xs" style={{ "margin-left": "0.25rem", "font-style": "italic", color: "var(--cortex-warning)" }}>
                      (unverified)
                    </Text>
                  </Show>
                  <Show when={bp.description}>
                    <span
                      class="text-xs italic"
                      style={{ "margin-left": "0.25rem", color: "var(--jb-text-muted-color)" }}
                      title={bp.description}
                    >
                      {bp.description}
                    </span>
                  </Show>
                </div>

                {/* Remove button */}
                <IconButton
                  size="sm"
                  onClick={() => handleRemoveDataBreakpoint(bp.id)}
                  style={{ opacity: "0" }}
                  class="group-hover:opacity-100"
                  tooltip="Remove data breakpoint"
                >
                  <Icon name="trash" size="xs" />
                </IconButton>
              </div>
            )}
          </For>
        </Show>
      </div>

      {/* Exception Breakpoints Section */}
      <div class="mt-4 border-t border-[var(--border-weak)] pt-3">
        <div class="flex items-center gap-1.5 text-xs mb-2" style={{ color: "var(--text-weak)" }}>
          <Icon name="triangle-exclamation" size="xs" />
          <Text variant="muted" size="xs">Exception Breakpoints</Text>
          <Show when={debug.state.currentDebugType}>
            <Text variant="muted" size="xs" style={{ "margin-left": "auto", opacity: "0.7" }}>
              ({debug.state.currentDebugType})
            </Text>
          </Show>
        </div>

        <Show
          when={debug.state.exceptionBreakpoints.length > 0}
          fallback={
            <Text variant="muted" size="xs" align="center" as="div" style={{ padding: "0.5rem 0" }}>
              <Show
                when={debug.state.isDebugging}
                fallback={
                  <>
                    Start debugging to configure
                    <br />
                    exception breakpoints.
                  </>
                }
              >
                No exception filters available
                <br />
                for this debug adapter.
              </Show>
            </Text>
          }
        >
          <For each={debug.state.exceptionBreakpoints}>
            {(eb) => {
              const isEditingCondition = () => editingExceptionCondition() === eb.filter;

              return (
                <div class="mb-1">
                  <div
                    class="group flex items-center gap-2 px-2 rounded text-xs transition-colors hover:bg-[var(--surface-raised)]"
                    style={{ opacity: eb.enabled ? 1 : 0.6, height: "22px" }}
                  >
                    {/* Checkbox for enable/disable */}
                    <IconButton
                      size="sm"
                      onClick={() => handleToggleExceptionBreakpoint(eb)}
                      style={{ color: eb.enabled ? "var(--cortex-warning)" : undefined }}
                      tooltip={eb.enabled ? "Disable exception breakpoint" : "Enable exception breakpoint"}
                    >
                      <Show
                        when={eb.enabled}
                        fallback={
                          <div
                            class="w-3.5 h-3.5 border rounded"
                            style={{ "border-color": "var(--text-weak)" }}
                          />
                        }
                      >
                        <div
                          class="w-3.5 h-3.5 rounded flex items-center justify-center"
                          style={{ background: "var(--cortex-warning)" }}
                        >
                          <Icon name="check" style={{ width: "10px", height: "10px", color: "white" }} />
                        </div>
                      </Show>
                    </IconButton>

                    {/* Exception type label and description */}
                    <div class="flex-1 min-w-0">
                      <Text>{eb.label}</Text>
                      <Show when={eb.description}>
                        <div
                          class="text-xs truncate"
                          style={{ "margin-left": "0.25rem", color: "var(--jb-text-muted-color)" }}
                          title={eb.description}
                        >
                          {eb.description}
                        </div>
                      </Show>
                      <Show when={eb.condition}>
                        <div
                          class="text-xs truncate"
                          style={{ color: "var(--cortex-info)" }}
                          title={`Condition: ${eb.condition}`}
                        >
                          when: {eb.condition}
                        </div>
                      </Show>
                    </div>

                    {/* Edit condition button - only if supports conditions */}
                    <Show when={eb.supportsCondition}>
                      <IconButton
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditExceptionCondition(eb);
                        }}
                        style={{ opacity: "0" }}
                        class="group-hover:opacity-100"
                        tooltip={eb.conditionDescription || "Edit condition"}
                      >
                        <Icon name="pen" size="xs" />
                      </IconButton>
                    </Show>
                  </div>

                  {/* Condition editing form */}
                  <Show when={isEditingCondition()}>
                    <div class="flex flex-col gap-1 px-2 py-1 ml-6">
                      <Show when={eb.conditionDescription}>
                        <Text variant="muted" size="xs">
                          {eb.conditionDescription}
                        </Text>
                      </Show>
                      <div class="flex items-center gap-1">
                        <Input
                          type="text"
                          value={exceptionConditionInput()}
                          onInput={(e) => setExceptionConditionInput(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveExceptionCondition();
                            if (e.key === "Escape") handleCancelExceptionConditionEdit();
                          }}
                          placeholder="Enter condition"
                          style={{ flex: "1", border: "1px solid var(--cortex-info)" }}
                          autofocus
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSaveExceptionCondition}
                          style={{ background: "var(--cortex-info)" }}
                        >
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelExceptionConditionEdit}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>
      </div>

      {/* Triggered By Picker Modal */}
      <Show when={showTriggeredByPicker()}>
        {(pickerTarget) => {
          const currentBpId = `${pickerTarget().path}:${pickerTarget().line}${pickerTarget().column !== undefined ? `:${pickerTarget().column}` : ""}`;
          const availableBreakpoints = () => {
            const bps: Breakpoint[] = [];
            for (const [, breakpoints] of Object.entries(debug.state.breakpoints)) {
              for (const bp of breakpoints) {
                const bpId = debug.getBreakpointId(bp);
                // Exclude the current breakpoint and any that are already triggered by this one
                if (bpId !== currentBpId && bp.triggeredBy !== currentBpId) {
                  bps.push(bp);
                }
              }
            }
            return bps;
          };

          return (
            <div
              class="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: "var(--ui-panel-bg)" }}
              onClick={() => setShowTriggeredByPicker(null)}
            >
              <div
                class="rounded-lg shadow-xl max-w-md w-full mx-4"
                style={{
                  background: "var(--surface-base)",
                  border: "1px solid var(--border-weak)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div class="p-4 border-b" style={{ "border-color": "var(--border-weak)" }}>
                  <Text weight="medium" size="sm" as="h3">
                    Select Trigger Breakpoint
                  </Text>
                  <Text variant="muted" size="xs" as="p" style={{ "margin-top": "0.25rem" }}>
                    This breakpoint will be enabled when the selected trigger breakpoint is hit.
                  </Text>
                </div>
                <div class="max-h-64 overflow-y-auto p-2">
                  <Show
                    when={availableBreakpoints().length > 0}
                    fallback={
                      <Text variant="muted" size="xs" align="center" as="div" style={{ padding: "1rem 0" }}>
                        No other breakpoints available to trigger this one.
                      </Text>
                    }
                  >
                    <For each={availableBreakpoints()}>
                      {(bp) => {
                        const bpId = debug.getBreakpointId(bp);
                        const fileName = bp.path.split(/[/\\]/).pop() || bp.path;
                        return (
                          <Button
                            variant="ghost"
                            style={{ width: "100%", "justify-content": "flex-start", gap: "0.5rem", padding: "0.5rem 0.75rem" }}
                            onClick={() => handleSetTriggeredBy(bpId)}
                          >
                            <BreakpointIcon
                              type={bp.condition ? "conditional" : bp.logMessage ? "log" : "standard"}
                              state={bp.enabled ? (bp.verified ? "enabled" : "unverified") : "disabled"}
                            />
                            <div class="flex-1 min-w-0 text-left">
                              <Text truncate as="div">
                                {fileName}
                              </Text>
                              <Text variant="muted" size="xs" as="div">
                                Line {bp.line}{bp.column !== undefined ? `:${bp.column}` : ""}
                                {bp.condition && <Text style={{ "margin-left": "0.25rem", color: "var(--cortex-warning)" }}>• conditional</Text>}
                              </Text>
                            </div>
                          </Button>
                        );
                      }}
                    </For>
                  </Show>
                </div>
                <div class="p-3 border-t flex justify-end gap-2" style={{ "border-color": "var(--border-weak)" }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTriggeredByPicker(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          );
        }}
      </Show>

      {/* Context Menu for Breakpoints */}
      <Show when={contextMenuBreakpoint()}>
        {(bp) => (
          <div
            class="fixed z-50 shadow-lg rounded overflow-hidden"
            style={{
              left: `${bp().x}px`,
              top: `${bp().y}px`,
              background: "var(--surface-raised)",
              border: "1px solid var(--border-weak)",
              "min-width": "160px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Backdrop to close menu */}
            <div
              class="fixed inset-0 z-[-1]"
              onClick={closeContextMenu}
            />

            {/* Create Group option */}
            <Button
              variant="ghost"
              size="sm"
              style={{ width: "100%", "justify-content": "flex-start", "border-radius": "0" }}
              onClick={handleCreateGroupFromMenu}
              icon={<Icon name="plus" size="xs" />}
            >
              Create Group with Breakpoint
            </Button>

            {/* Add to existing groups */}
            <Show when={debug.state.breakpointGroups.length > 0}>
              <div class="border-t" style={{ "border-color": "var(--border-weak)" }} />
              <Text variant="muted" size="xs" as="div" style={{ padding: "0.25rem 0.75rem" }}>
                Add to Group
              </Text>
              <For each={debug.state.breakpointGroups}>
                {(group) => {
                  const bpId = createBreakpointId(bp().path, bp().line, bp().column);
                  const isInGroup = group.breakpointIds.includes(bpId);
                  
                  return (
                    <Button
                      variant="ghost"
                      size="sm"
                      style={{ 
                        width: "100%",
                        "justify-content": "flex-start",
                        "border-radius": "0",
                        opacity: isInGroup ? "0.5" : "1",
                      }}
                      disabled={isInGroup}
                      onClick={() => !isInGroup && handleAddToGroupFromMenu(group.id)}
                      icon={<Icon name="folder" size="xs" />}
                    >
                      {group.name}
                      <Show when={isInGroup}>
                        <Text variant="muted" size="xs" style={{ "margin-left": "auto" }}>(already added)</Text>
                      </Show>
                    </Button>
                  );
                }}
              </For>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}


