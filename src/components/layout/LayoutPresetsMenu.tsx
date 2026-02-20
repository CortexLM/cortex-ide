/**
 * Layout Presets Menu Component
 * 
 * A dropdown menu for selecting and managing layout presets.
 * Allows users to:
 * - Apply built-in presets
 * - Apply custom presets
 * - Save current layout as a new preset
 * - Delete custom presets
 */

import { createSignal, For, Show, JSX, onCleanup } from "solid-js";
import { Icon } from "../ui/Icon";
import { 
  LayoutPreset, 
  LayoutState,
  BUILTIN_PRESETS,
  loadCustomPresets,
  saveCustomPresets,
  createCustomPreset,
} from "../../types/layout";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    position: "relative",
  } as JSX.CSSProperties,

  trigger: {
    display: "flex",
    "align-items": "center",
    gap: "6px",
    padding: "4px 8px",
    border: "1px solid var(--jb-border-default)",
    "border-radius": "var(--cortex-radius-sm)",
    background: "var(--jb-background-secondary)",
    color: "var(--jb-text-primary)",
    cursor: "pointer",
    "font-size": "12px",
    transition: "all 0.15s ease",
  } as JSX.CSSProperties,

  triggerHover: {
    background: "var(--jb-background-tertiary)",
    "border-color": "var(--jb-border-focus)",
  } as JSX.CSSProperties,

  dropdown: {
    position: "absolute",
    top: "100%",
    right: "0",
    "margin-top": "4px",
    "min-width": "220px",
    "max-width": "300px",
    background: "var(--jb-background-secondary)",
    border: "1px solid var(--jb-border-default)",
    "border-radius": "var(--cortex-radius-md)",
    "box-shadow": "0 4px 12px rgba(0, 0, 0, 0.3)",
    "z-index": "1000",
    overflow: "hidden",
  } as JSX.CSSProperties,

  section: {
    padding: "4px 0",
    "border-bottom": "1px solid var(--jb-border-default)",
  } as JSX.CSSProperties,

  sectionLast: {
    padding: "4px 0",
  } as JSX.CSSProperties,

  sectionTitle: {
    padding: "4px 12px",
    "font-size": "10px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: "var(--jb-text-muted)",
  } as JSX.CSSProperties,

  item: {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "6px 12px",
    cursor: "pointer",
    "font-size": "12px",
    color: "var(--jb-text-primary)",
    transition: "background 0.1s ease",
  } as JSX.CSSProperties,

  itemHover: {
    background: "var(--jb-background-tertiary)",
  } as JSX.CSSProperties,

  itemActive: {
    background: "rgba(99, 102, 241, 0.15)",
    color: "var(--jb-accent)",
  } as JSX.CSSProperties,

  itemIcon: {
    width: "14px",
    height: "14px",
    opacity: "0.7",
  } as JSX.CSSProperties,

  itemLabel: {
    flex: "1",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  } as JSX.CSSProperties,

  itemCheck: {
    width: "14px",
    height: "14px",
    color: "var(--jb-accent)",
  } as JSX.CSSProperties,

  itemDelete: {
    padding: "2px",
    "border-radius": "var(--cortex-radius-sm)",
    opacity: "0",
    transition: "opacity 0.1s ease",
  } as JSX.CSSProperties,

  itemDeleteVisible: {
    opacity: "0.6",
  } as JSX.CSSProperties,

  saveInput: {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
  } as JSX.CSSProperties,

  input: {
    flex: "1",
    padding: "4px 8px",
    border: "1px solid var(--jb-border-default)",
    "border-radius": "var(--cortex-radius-sm)",
    background: "var(--jb-background-primary)",
    color: "var(--jb-text-primary)",
    "font-size": "12px",
    outline: "none",
  } as JSX.CSSProperties,

  inputFocus: {
    "border-color": "var(--jb-border-focus)",
  } as JSX.CSSProperties,

  saveButton: {
    padding: "4px 8px",
    border: "none",
    "border-radius": "var(--cortex-radius-sm)",
    background: "var(--jb-accent)",
    color: "white",
    "font-size": "11px",
    cursor: "pointer",
    transition: "opacity 0.1s ease",
  } as JSX.CSSProperties,
} as const;

// ============================================================================
// Props
// ============================================================================

interface LayoutPresetsMenuProps {
  /** Currently active preset ID */
  activePresetId: string | null;
  /** Current layout state (for saving new presets) */
  currentState: LayoutState;
  /** Callback when a preset is selected */
  onApplyPreset: (preset: LayoutPreset) => void;
  /** Callback when active preset changes */
  onActivePresetChange: (presetId: string | null) => void;
}

// ============================================================================
// Component
// ============================================================================

export function LayoutPresetsMenu(props: LayoutPresetsMenuProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [customPresets, setCustomPresets] = createSignal<LayoutPreset[]>(loadCustomPresets());
  const [showSaveInput, setShowSaveInput] = createSignal(false);
  const [newPresetName, setNewPresetName] = createSignal("");
  const [hoveredItem, setHoveredItem] = createSignal<string | null>(null);
  const [inputFocused, setInputFocused] = createSignal(false);

  // All presets combined
  const allPresets = () => [...BUILTIN_PRESETS, ...customPresets()];

  // Find current active preset
  const activePreset = () => allPresets().find(p => p.id === props.activePresetId);

  // Handle preset selection
  const handleSelectPreset = (preset: LayoutPreset) => {
    props.onApplyPreset(preset);
    props.onActivePresetChange(preset.id);
    setIsOpen(false);
  };

  // Handle save new preset
  const handleSavePreset = () => {
    const name = newPresetName().trim();
    if (!name) return;

    const newPreset = createCustomPreset(name, props.currentState);
    const updated = [...customPresets(), newPreset];
    setCustomPresets(updated);
    saveCustomPresets(updated);
    
    // Apply the new preset
    props.onActivePresetChange(newPreset.id);
    
    // Reset UI
    setNewPresetName("");
    setShowSaveInput(false);
  };

  // Handle delete preset
  const handleDeletePreset = (e: MouseEvent, presetId: string) => {
    e.stopPropagation();
    const updated = customPresets().filter(p => p.id !== presetId);
    setCustomPresets(updated);
    saveCustomPresets(updated);
    
    // If deleted preset was active, clear active
    if (props.activePresetId === presetId) {
      props.onActivePresetChange(null);
    }
  };

  // Handle keyboard in input
  const handleInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSavePreset();
    } else if (e.key === "Escape") {
      setShowSaveInput(false);
      setNewPresetName("");
    }
  };

  // Close on click outside
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".layout-presets-menu")) {
      setIsOpen(false);
      setShowSaveInput(false);
    }
  };

  // Register click outside handler with cleanup
  if (typeof window !== "undefined") {
    window.addEventListener("click", handleClickOutside);
    onCleanup(() => {
      window.removeEventListener("click", handleClickOutside);
    });
  }

  return (
    <div class="layout-presets-menu" style={styles.container}>
      {/* Trigger Button */}
      <button
        style={{
          ...styles.trigger,
          ...(isOpen() ? styles.triggerHover : {}),
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen());
        }}
        title="Layout Presets"
      >
        <Icon name="layout" style={{ width: "14px", height: "14px" }} />
        <span>{activePreset()?.name ?? "Layout"}</span>
        <Icon 
          name={isOpen() ? "chevron-up" : "chevron-down"} 
          style={{ width: "12px", height: "12px", opacity: "0.6" }} 
        />
      </button>

      {/* Dropdown Menu */}
      <Show when={isOpen()}>
        <div style={styles.dropdown} onClick={(e) => e.stopPropagation()}>
          {/* Built-in Presets */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Built-in Presets</div>
            <For each={BUILTIN_PRESETS}>
              {(preset) => (
                <div
                  style={{
                    ...styles.item,
                    ...(hoveredItem() === preset.id ? styles.itemHover : {}),
                    ...(props.activePresetId === preset.id ? styles.itemActive : {}),
                  }}
                  onMouseEnter={() => setHoveredItem(preset.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  onClick={() => handleSelectPreset(preset)}
                >
                  <Icon name={preset.icon} style={styles.itemIcon} />
                  <span style={styles.itemLabel}>{preset.name}</span>
                  <Show when={props.activePresetId === preset.id}>
                    <Icon name="check" style={styles.itemCheck} />
                  </Show>
                </div>
              )}
            </For>
          </div>

          {/* Custom Presets */}
          <Show when={customPresets().length > 0}>
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Custom Presets</div>
              <For each={customPresets()}>
                {(preset) => (
                  <div
                    style={{
                      ...styles.item,
                      ...(hoveredItem() === preset.id ? styles.itemHover : {}),
                      ...(props.activePresetId === preset.id ? styles.itemActive : {}),
                    }}
                    onMouseEnter={() => setHoveredItem(preset.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    onClick={() => handleSelectPreset(preset)}
                  >
                    <Icon name={preset.icon} style={styles.itemIcon} />
                    <span style={styles.itemLabel}>{preset.name}</span>
                    <Show when={props.activePresetId === preset.id}>
                      <Icon name="check" style={styles.itemCheck} />
                    </Show>
                    <div
                      style={{
                        ...styles.itemDelete,
                        ...(hoveredItem() === preset.id ? styles.itemDeleteVisible : {}),
                      }}
                      onClick={(e) => handleDeletePreset(e, preset.id)}
                      title="Delete preset"
                    >
                      <Icon name="trash" style={{ width: "12px", height: "12px", color: "var(--jb-text-muted)" }} />
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Save Current Layout */}
          <div style={styles.sectionLast}>
            <Show
              when={showSaveInput()}
              fallback={
                <div
                  style={{
                    ...styles.item,
                    ...(hoveredItem() === "save" ? styles.itemHover : {}),
                  }}
                  onMouseEnter={() => setHoveredItem("save")}
                  onMouseLeave={() => setHoveredItem(null)}
                  onClick={() => setShowSaveInput(true)}
                >
                  <Icon name="plus" style={styles.itemIcon} />
                  <span style={styles.itemLabel}>Save Current Layout...</span>
                </div>
              }
            >
              <div style={styles.saveInput}>
                <input
                  type="text"
                  placeholder="Preset name"
                  value={newPresetName()}
                  onInput={(e) => setNewPresetName(e.currentTarget.value)}
                  onKeyDown={handleInputKeyDown}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  style={{
                    ...styles.input,
                    ...(inputFocused() ? styles.inputFocus : {}),
                  }}
                  autofocus
                />
                <button
                  style={styles.saveButton}
                  onClick={handleSavePreset}
                  disabled={!newPresetName().trim()}
                >
                  Save
                </button>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default LayoutPresetsMenu;

