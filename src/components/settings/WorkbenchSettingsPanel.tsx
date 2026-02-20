import { Show, For, JSX } from "solid-js";
import { useSettings, type SettingsScope, type ThemeSettings } from "@/context/SettingsContext";
import { SectionHeader, FormGroup } from "./FormComponents";
import { Icon } from "../ui/Icon";

interface WorkbenchSettingsPanelProps {
  scope?: SettingsScope;
}

// ============================================================================
// Setting Row with Override Support
// ============================================================================

function SettingRowWithOverride(props: {
  label: string;
  description?: string;
  settingKey: keyof ThemeSettings;
  hasOverride: boolean;
  isModified?: boolean;
  onReset?: () => void;
  onResetToDefault?: () => void;
  children: JSX.Element;
}) {
  const isModifiedValue = () => props.isModified ?? false;
  return (
    <div 
      class="setting-item-contents group relative" 
      classList={{ 
        "is-configured": props.hasOverride,
        "is-modified": isModifiedValue() && !props.hasOverride
      }}
    >
      {/* Modified indicator - VS Code spec: 2px left border, 6px width, positioned at left: 5px */}
      <div class="setting-item-modified-indicator" />
      <div class="flex flex-col gap-2" style={{ padding: "12px 14px 18px" }}>
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <span class="setting-item-label" style={{ "font-weight": "600", "font-size": "13px" }}>{props.label}</span>
            {/* Modified from default indicator dot */}
            <Show when={isModifiedValue() && !props.hasOverride}>
              <span 
                class="modified-indicator-dot"
                title="Modified from default"
              />
            </Show>
          </div>
          <div class="flex items-center gap-2">
            {/* Reset to workspace/user setting button */}
            <Show when={props.hasOverride && props.onReset}>
              <button
                onClick={props.onReset}
                class="setting-toolbar-container opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background-tertiary text-foreground-muted hover:text-foreground"
                style={{ transition: "opacity 0.3s" }}
                title="Reset to user setting"
              >
                <Icon name="rotate-left" class="h-3 w-3 toolbar-icon" />
              </button>
            </Show>
            {/* Reset to default button (when modified but not overridden) */}
            <Show when={isModifiedValue() && !props.hasOverride && props.onResetToDefault}>
              <button
                onClick={props.onResetToDefault}
                class="reset-to-default-button"
                title="Reset to default"
              >
                <Icon name="rotate-left" class="h-3 w-3" />
              </button>
            </Show>
          </div>
        </div>
        <Show when={props.description}>
          <span class="text-xs" style={{ color: "var(--text-weak)" }}>{props.description}</span>
        </Show>
        <div class="mt-1">
          {props.children}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Visual Option Card Component
// ============================================================================

interface OptionCardProps {
  selected: boolean;
  onClick: () => void;
  icon: JSX.Element;
  label: string;
  description?: string;
}

function OptionCard(props: OptionCardProps) {
  return (
    <button
      onClick={props.onClick}
      class="flex flex-col items-center gap-2 p-3 rounded-lg border transition-all"
      style={{
        background: props.selected ? "var(--accent-primary-subtle, rgba(99, 102, 241, 0.1))" : "var(--background-base)",
        "border-color": props.selected ? "var(--accent-primary)" : "var(--border-weak)",
        color: props.selected ? "var(--accent-primary)" : "var(--text-base)",
        "min-width": "80px",
      }}
    >
      <div class="flex items-center justify-center" style={{ width: "32px", height: "32px" }}>
        {props.icon}
      </div>
      <span class="text-xs font-medium text-center">{props.label}</span>
      <Show when={props.description}>
        <span class="text-[10px] text-center" style={{ color: "var(--text-weak)" }}>{props.description}</span>
      </Show>
    </button>
  );
}

// ============================================================================
// Activity Bar Position Preview Icons
// ============================================================================

function ActivityBarSideIcon() {
  return (
    <svg width="28" height="24" viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="1.5">
      {/* Outer frame */}
      <rect x="1" y="1" width="26" height="22" rx="2" />
      {/* Activity bar on left */}
      <rect x="1" y="1" width="5" height="22" rx="1" fill="currentColor" opacity="0.3" />
      {/* Sidebar */}
      <rect x="6" y="1" width="6" height="22" opacity="0.1" fill="currentColor" />
      {/* Icons in activity bar */}
      <circle cx="3.5" cy="5" r="1" fill="currentColor" />
      <circle cx="3.5" cy="9" r="1" fill="currentColor" />
      <circle cx="3.5" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

function ActivityBarTopIcon() {
  return (
    <svg width="28" height="24" viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="1.5">
      {/* Outer frame */}
      <rect x="1" y="1" width="26" height="22" rx="2" />
      {/* Activity bar on top */}
      <rect x="1" y="1" width="26" height="4" rx="1" fill="currentColor" opacity="0.3" />
      {/* Sidebar */}
      <rect x="1" y="5" width="7" height="18" opacity="0.1" fill="currentColor" />
      {/* Icons in top bar */}
      <circle cx="5" cy="3" r="1" fill="currentColor" />
      <circle cx="9" cy="3" r="1" fill="currentColor" />
      <circle cx="13" cy="3" r="1" fill="currentColor" />
    </svg>
  );
}

function ActivityBarHiddenIcon() {
  return (
    <svg width="28" height="24" viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="1.5">
      {/* Outer frame */}
      <rect x="1" y="1" width="26" height="22" rx="2" />
      {/* Sidebar only (no activity bar) */}
      <rect x="1" y="1" width="7" height="22" rx="1" fill="currentColor" opacity="0.1" />
      {/* Content area */}
      <line x1="10" y1="6" x2="25" y2="6" opacity="0.3" />
      <line x1="10" y1="10" x2="22" y2="10" opacity="0.3" />
      <line x1="10" y1="14" x2="24" y2="14" opacity="0.3" />
    </svg>
  );
}

// ============================================================================
// Panel Position Preview Icons
// ============================================================================

function PanelBottomIcon() {
  return (
    <svg width="28" height="24" viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="1" y="1" width="26" height="22" rx="2" />
      {/* Editor area */}
      <rect x="2" y="2" width="24" height="12" opacity="0.1" fill="currentColor" />
      {/* Bottom panel */}
      <rect x="1" y="15" width="26" height="8" rx="1" fill="currentColor" opacity="0.3" />
      <line x1="4" y1="17" x2="14" y2="17" opacity="0.6" />
      <line x1="4" y1="20" x2="10" y2="20" opacity="0.4" />
    </svg>
  );
}

function PanelLeftIcon() {
  return (
    <svg width="28" height="24" viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="1" y="1" width="26" height="22" rx="2" />
      {/* Left panel */}
      <rect x="1" y="1" width="9" height="22" rx="1" fill="currentColor" opacity="0.3" />
      {/* Editor area */}
      <rect x="11" y="2" width="15" height="20" opacity="0.1" fill="currentColor" />
      <line x1="3" y1="5" x2="8" y2="5" opacity="0.6" />
      <line x1="3" y1="8" x2="7" y2="8" opacity="0.4" />
    </svg>
  );
}

function PanelRightIcon() {
  return (
    <svg width="28" height="24" viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="1" y="1" width="26" height="22" rx="2" />
      {/* Editor area */}
      <rect x="2" y="2" width="15" height="20" opacity="0.1" fill="currentColor" />
      {/* Right panel */}
      <rect x="18" y="1" width="9" height="22" rx="1" fill="currentColor" opacity="0.3" />
      <line x1="20" y1="5" x2="25" y2="5" opacity="0.6" />
      <line x1="20" y1="8" x2="24" y2="8" opacity="0.4" />
    </svg>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkbenchSettingsPanel(props: WorkbenchSettingsPanelProps) {
  const settings = useSettings();
  const scope = () => props.scope || "user";
  
  // Use effective settings for display, but update based on scope
  const theme = () => settings.effectiveSettings().theme;
  
  // Helper to update setting based on current scope
  const updateSetting = <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) => {
    if (scope() === "workspace" && settings.hasWorkspace()) {
      settings.setWorkspaceSetting("theme", key, value);
    } else {
      settings.updateThemeSetting(key, value);
    }
  };

  // Check if setting has workspace override
  const hasOverride = (key: keyof ThemeSettings) => settings.hasWorkspaceOverride("theme", key);
  
  // Check if setting is modified from default
  const isModified = (key: keyof ThemeSettings) => settings.isSettingModified("theme", key);
  
  // Reset workspace override
  const resetOverride = (key: keyof ThemeSettings) => {
    settings.resetWorkspaceSetting("theme", key);
  };
  
  // Reset setting to default value
  const resetToDefault = (key: keyof ThemeSettings) => {
    settings.resetSettingToDefault("theme", key);
  };

  // Activity bar position options
  const activityBarPositionOptions: Array<{ value: ThemeSettings["activityBarPosition"]; label: string; icon: JSX.Element }> = [
    { value: "side", label: "Side", icon: <ActivityBarSideIcon /> },
    { value: "top", label: "Top", icon: <ActivityBarTopIcon /> },
    { value: "hidden", label: "Hidden", icon: <ActivityBarHiddenIcon /> },
  ];

  // Menu bar visibility options
  const menuBarVisibilityOptions: Array<{ value: ThemeSettings["menuBarVisibility"]; label: string; description: string }> = [
    { value: "classic", label: "Classic", description: "Always visible" },
    { value: "compact", label: "Compact", description: "Condensed menu" },
    { value: "toggle", label: "Toggle", description: "Press Alt to show" },
    { value: "hidden", label: "Hidden", description: "Never visible" },
  ];

  // Panel position options
  const panelPositionOptions: Array<{ value: ThemeSettings["panelPosition"]; label: string; icon: JSX.Element }> = [
    { value: "bottom", label: "Bottom", icon: <PanelBottomIcon /> },
    { value: "left", label: "Left", icon: <PanelLeftIcon /> },
    { value: "right", label: "Right", icon: <PanelRightIcon /> },
  ];

  // Panel alignment options
  const panelAlignmentOptions: Array<{ value: ThemeSettings["panelAlignment"]; label: string; icon: JSX.Element }> = [
    { value: "left", label: "Left", icon: <Icon name="align-left" class="w-5 h-5" /> },
    { value: "center", label: "Center", icon: <Icon name="align-center" class="w-5 h-5" /> },
    { value: "right", label: "Right", icon: <Icon name="align-right" class="w-5 h-5" /> },
    { value: "justify", label: "Justify", icon: <Icon name="align-justify" class="w-5 h-5" /> },
  ];

  return (
    <div class="space-y-6 max-h-[500px] overflow-y-auto pr-2">
      {/* Scope indicator */}
      <Show when={scope() === "workspace"}>
        <div class="text-xs text-purple-400 bg-purple-500/10 rounded-lg px-3 py-2 mb-4">
          Editing workspace-specific workbench settings. Changes apply only to this workspace.
        </div>
      </Show>

      {/* Activity Bar Settings */}
      <SectionHeader 
        title="Activity Bar" 
        description="Control the position and visibility of the activity bar"
        icon={<Icon name="sidebar" class="w-4 h-4" />}
      />
      <FormGroup>
        <SettingRowWithOverride 
          label="Activity Bar Position" 
          description="Controls where the activity bar icons are displayed"
          settingKey="activityBarPosition"
          hasOverride={hasOverride("activityBarPosition")}
          isModified={isModified("activityBarPosition")}
          onReset={() => resetOverride("activityBarPosition")}
          onResetToDefault={() => resetToDefault("activityBarPosition")}
        >
          <div class="flex flex-wrap gap-3">
            <For each={activityBarPositionOptions}>
              {(option) => (
                <OptionCard
                  selected={theme().activityBarPosition === option.value}
                  onClick={() => updateSetting("activityBarPosition", option.value)}
                  icon={option.icon}
                  label={option.label}
                />
              )}
            </For>
          </div>
        </SettingRowWithOverride>
      </FormGroup>

      {/* Menu Bar Settings */}
      <SectionHeader 
        title="Menu Bar" 
        description="Control the visibility and behavior of the menu bar"
        icon={<Icon name="bars" class="w-4 h-4" />}
      />
      <FormGroup>
        <SettingRowWithOverride 
          label="Menu Bar Visibility" 
          description="Controls the visibility of the menu bar. Toggle mode shows menu when Alt is pressed."
          settingKey="menuBarVisibility"
          hasOverride={hasOverride("menuBarVisibility")}
          isModified={isModified("menuBarVisibility")}
          onReset={() => resetOverride("menuBarVisibility")}
          onResetToDefault={() => resetToDefault("menuBarVisibility")}
        >
          <select
            value={theme().menuBarVisibility}
            onChange={(e) => updateSetting("menuBarVisibility", e.currentTarget.value as ThemeSettings["menuBarVisibility"])}
            class={`settings-inline-select ${hasOverride("menuBarVisibility") ? "ring-1 ring-purple-500/50" : ""}`}
            style={{ height: "32px", width: "200px" }}
          >
            <For each={menuBarVisibilityOptions}>
              {(opt) => <option value={opt.value}>{opt.label} - {opt.description}</option>}
            </For>
          </select>
        </SettingRowWithOverride>
      </FormGroup>

      {/* Panel Settings */}
      <SectionHeader 
        title="Panel" 
        description="Control the position and alignment of the bottom panel (terminal, output, etc.)"
        icon={<Icon name="table-columns" class="w-4 h-4" />}
      />
      <FormGroup>
        <SettingRowWithOverride 
          label="Panel Position" 
          description="Controls where the panel (terminal, output, debug console) is displayed"
          settingKey="panelPosition"
          hasOverride={hasOverride("panelPosition")}
          isModified={isModified("panelPosition")}
          onReset={() => resetOverride("panelPosition")}
          onResetToDefault={() => resetToDefault("panelPosition")}
        >
          <div class="flex flex-wrap gap-3">
            <For each={panelPositionOptions}>
              {(option) => (
                <OptionCard
                  selected={theme().panelPosition === option.value}
                  onClick={() => updateSetting("panelPosition", option.value)}
                  icon={option.icon}
                  label={option.label}
                />
              )}
            </For>
          </div>
        </SettingRowWithOverride>

        <SettingRowWithOverride 
          label="Panel Alignment" 
          description="Controls the alignment of content within the panel when panel is at the bottom"
          settingKey="panelAlignment"
          hasOverride={hasOverride("panelAlignment")}
          isModified={isModified("panelAlignment")}
          onReset={() => resetOverride("panelAlignment")}
          onResetToDefault={() => resetToDefault("panelAlignment")}
        >
          <div class="flex flex-wrap gap-3">
            <For each={panelAlignmentOptions}>
              {(option) => (
                <OptionCard
                  selected={theme().panelAlignment === option.value}
                  onClick={() => updateSetting("panelAlignment", option.value)}
                  icon={option.icon}
                  label={option.label}
                />
              )}
            </For>
          </div>
        </SettingRowWithOverride>
      </FormGroup>

      {/* Reset Section */}
      <div class="pt-4 border-t border-border">
        <Show 
          when={scope() === "user"}
          fallback={
            <button
              onClick={() => {
                // Reset all workspace workbench overrides
                const keys: (keyof ThemeSettings)[] = [
                  "activityBarPosition", 
                  "menuBarVisibility", 
                  "panelPosition", 
                  "panelAlignment"
                ];
                keys.forEach(key => {
                  if (hasOverride(key)) {
                    resetOverride(key);
                  }
                });
              }}
              class="form-button form-button-ghost form-button-sm"
            >
              Reset All Workspace Workbench Overrides
            </button>
          }
        >
          <button
            onClick={() => {
              // Reset workbench settings to defaults
              const keys: (keyof ThemeSettings)[] = [
                "activityBarPosition", 
                "menuBarVisibility", 
                "panelPosition", 
                "panelAlignment"
              ];
              keys.forEach(key => {
                if (isModified(key)) {
                  resetToDefault(key);
                }
              });
            }}
            class="form-button form-button-ghost form-button-sm"
          >
            Reset Workbench Settings to Defaults
          </button>
        </Show>
      </div>
    </div>
  );
}
