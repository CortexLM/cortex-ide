import { Show, For, JSX } from "solid-js";
import { useSettings, type SettingsScope, type DebugSettings, type JavaScriptDebugSettings } from "@/context/SettingsContext";
import { Toggle, SectionHeader, FormGroup, Button } from "./FormComponents";
import { Icon } from "../ui/Icon";

interface DebugSettingsPanelProps {
  scope?: SettingsScope;
}

/** Row with workspace override indicator and modified from default indicator */
function SettingRowWithOverride(props: {
  label: string;
  description?: string;
  settingKey: keyof DebugSettings;
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
      <div class="flex flex-col gap-1" style={{ padding: "12px 14px 18px" }}>
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
            {props.children}
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
          <span class="text-xs text-foreground-muted">{props.description}</span>
        </Show>
      </div>
    </div>
  );
}

export function DebugSettingsPanel(props: DebugSettingsPanelProps) {
  const settings = useSettings();
  const scope = () => props.scope || "user";
  
  // Use effective settings for display, but update based on scope
  const debug = () => settings.effectiveSettings().debug;
  
  // Helper to update setting based on current scope
  const updateSetting = <K extends keyof DebugSettings>(key: K, value: DebugSettings[K]) => {
    if (scope() === "workspace" && settings.hasWorkspace()) {
      settings.setWorkspaceSetting("debug", key, value);
    } else {
      settings.updateDebugSetting(key, value);
    }
  };

  // Check if setting has workspace override
  const hasOverride = (key: keyof DebugSettings) => settings.hasWorkspaceOverride("debug", key);
  
  // Check if setting is modified from default
  const isModified = (key: keyof DebugSettings) => settings.isSettingModified("debug", key);
  
  // Reset workspace override
  const resetOverride = (key: keyof DebugSettings) => {
    settings.resetWorkspaceSetting("debug", key);
  };
  
  // Reset setting to default value
  const resetToDefault = (key: keyof DebugSettings) => {
    settings.resetSettingToDefault("debug", key);
  };

  // Toolbar location options
  const toolbarLocationOptions = [
    { value: "floating", label: "Floating" },
    { value: "docked", label: "Docked" },
    { value: "commandCenter", label: "Command Center" },
    { value: "hidden", label: "Hidden" },
  ];

  // JavaScript auto-attach filter options
  const autoAttachFilterOptions = [
    { value: "disabled", label: "Disabled" },
    { value: "always", label: "Always" },
    { value: "smart", label: "Smart" },
    { value: "onlyWithFlag", label: "Only With Flag" },
  ];

  return (
    <div class="space-y-6 max-h-[500px] overflow-y-auto pr-2">
      {/* Scope indicator */}
      <Show when={scope() === "workspace"}>
        <div class="text-xs text-purple-400 bg-purple-500/10 rounded-lg px-3 py-2 mb-4">
          Editing workspace-specific debug settings. Changes apply only to this workspace.
        </div>
      </Show>

      {/* General Debug Settings */}
      <SectionHeader title="General" />
      <FormGroup>
        <SettingRowWithOverride 
          label="Toolbar Location" 
          description="Controls where the debug toolbar is displayed during debugging sessions."
          settingKey="toolbarLocation"
          hasOverride={hasOverride("toolbarLocation")}
          isModified={isModified("toolbarLocation")}
          onReset={() => resetOverride("toolbarLocation")}
          onResetToDefault={() => resetToDefault("toolbarLocation")}
        >
          <select
            value={debug().toolbarLocation}
            onChange={(e) => updateSetting("toolbarLocation", e.currentTarget.value as DebugSettings["toolbarLocation"])}
            class={`settings-inline-select ${hasOverride("toolbarLocation") ? "ring-1 ring-purple-500/50" : ""}`}
            style={{ width: "180px" }}
          >
            <For each={toolbarLocationOptions}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </SettingRowWithOverride>

        <SettingRowWithOverride 
          label="Open Debug Panel on Session Start" 
          description="Automatically open the debug panel when a debug session starts."
          settingKey="openDebugOnSessionStart"
          hasOverride={hasOverride("openDebugOnSessionStart")}
          isModified={isModified("openDebugOnSessionStart")}
          onReset={() => resetOverride("openDebugOnSessionStart")}
          onResetToDefault={() => resetToDefault("openDebugOnSessionStart")}
        >
          <Toggle
            checked={debug().openDebugOnSessionStart}
            onChange={(checked) => updateSetting("openDebugOnSessionStart", checked)}
          />
        </SettingRowWithOverride>

        <SettingRowWithOverride 
          label="Close Readonly Tabs on End" 
          description="Automatically close readonly debug tabs when the debug session ends."
          settingKey="closeReadonlyTabsOnEnd"
          hasOverride={hasOverride("closeReadonlyTabsOnEnd")}
          isModified={isModified("closeReadonlyTabsOnEnd")}
          onReset={() => resetOverride("closeReadonlyTabsOnEnd")}
          onResetToDefault={() => resetToDefault("closeReadonlyTabsOnEnd")}
        >
          <Toggle
            checked={debug().closeReadonlyTabsOnEnd}
            onChange={(checked) => updateSetting("closeReadonlyTabsOnEnd", checked)}
          />
        </SettingRowWithOverride>
      </FormGroup>

      {/* Focus Behavior */}
      <SectionHeader title="Focus Behavior" />
      <FormGroup>
        <SettingRowWithOverride 
          label="Focus Window on Break" 
          description="Bring the window to front when the debugger hits a breakpoint."
          settingKey="focusWindowOnBreak"
          hasOverride={hasOverride("focusWindowOnBreak")}
          isModified={isModified("focusWindowOnBreak")}
          onReset={() => resetOverride("focusWindowOnBreak")}
          onResetToDefault={() => resetToDefault("focusWindowOnBreak")}
        >
          <Toggle
            checked={debug().focusWindowOnBreak}
            onChange={(checked) => updateSetting("focusWindowOnBreak", checked)}
          />
        </SettingRowWithOverride>

        <SettingRowWithOverride 
          label="Focus Editor on Break" 
          description="Focus the editor at the breakpoint location when the debugger stops."
          settingKey="focusEditorOnBreak"
          hasOverride={hasOverride("focusEditorOnBreak")}
          isModified={isModified("focusEditorOnBreak")}
          onReset={() => resetOverride("focusEditorOnBreak")}
          onResetToDefault={() => resetToDefault("focusEditorOnBreak")}
        >
          <Toggle
            checked={debug().focusEditorOnBreak}
            onChange={(checked) => updateSetting("focusEditorOnBreak", checked)}
          />
        </SettingRowWithOverride>
      </FormGroup>

      {/* Breakpoints */}
      <SectionHeader title="Breakpoints" />
      <FormGroup>
        <SettingRowWithOverride 
          label="Show Inline Breakpoint Candidates" 
          description="Display inline breakpoint suggestions in the editor gutter."
          settingKey="showInlineBreakpointCandidates"
          hasOverride={hasOverride("showInlineBreakpointCandidates")}
          isModified={isModified("showInlineBreakpointCandidates")}
          onReset={() => resetOverride("showInlineBreakpointCandidates")}
          onResetToDefault={() => resetToDefault("showInlineBreakpointCandidates")}
        >
          <Toggle
            checked={debug().showInlineBreakpointCandidates}
            onChange={(checked) => updateSetting("showInlineBreakpointCandidates", checked)}
          />
        </SettingRowWithOverride>
      </FormGroup>

      {/* JavaScript Debugging */}
      <SectionHeader title="JavaScript Debugging" />
      <FormGroup>
        <SettingRowWithOverride 
          label="Auto Attach Filter" 
          description="Controls when the debugger should automatically attach to Node.js processes."
          settingKey="javascript"
          hasOverride={hasOverride("javascript")}
          isModified={isModified("javascript")}
          onReset={() => resetOverride("javascript")}
          onResetToDefault={() => resetToDefault("javascript")}
        >
          <select
            value={debug().javascript.autoAttachFilter}
            onChange={(e) => updateSetting("javascript", { 
              ...debug().javascript, 
              autoAttachFilter: e.currentTarget.value as JavaScriptDebugSettings["autoAttachFilter"] 
            })}
            class={`settings-inline-select ${hasOverride("javascript") ? "ring-1 ring-purple-500/50" : ""}`}
            style={{ width: "180px" }}
          >
            <For each={autoAttachFilterOptions}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </SettingRowWithOverride>
        <div class="text-xs text-foreground-muted px-4 pb-2 -mt-2">
          <strong>Disabled:</strong> Never auto-attach. <strong>Always:</strong> Attach to all Node.js processes. 
          <strong>Smart:</strong> Only attach when running from integrated terminal. 
          <strong>Only With Flag:</strong> Only attach when --inspect flag is present.
        </div>
      </FormGroup>

      {/* Reset Button */}
      <div class="pt-4 border-t border-border">
        <Show 
          when={scope() === "user"}
          fallback={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Reset all workspace debug overrides
                const keys: (keyof DebugSettings)[] = [
                  "toolbarLocation",
                  "openDebugOnSessionStart",
                  "closeReadonlyTabsOnEnd",
                  "focusWindowOnBreak",
                  "focusEditorOnBreak",
                  "showInlineBreakpointCandidates",
                  "javascript",
                ];
                keys.forEach(key => {
                  if (hasOverride(key)) {
                    resetOverride(key);
                  }
                });
              }}
            >
              Reset All Workspace Debug Overrides
            </Button>
          }
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => settings.resetSection("debug")}
          >
            Reset Debug Settings to Defaults
          </Button>
        </Show>
      </div>
    </div>
  );
}
