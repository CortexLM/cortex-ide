import { Show, For, JSX } from "solid-js";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useSettings, type SettingsScope, type GitSettings } from "@/context/SettingsContext";
import { Toggle, SectionHeader, FormGroup, Button } from "./FormComponents";
import { Icon } from "../ui/Icon";

interface GitSettingsPanelProps {
  scope?: SettingsScope;
}

/** Row with workspace override indicator */
function SettingRowWithOverride(props: {
  label: string;
  description?: string;
  settingKey: keyof GitSettings;
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
      <div class="setting-item-modified-indicator" />
      <div class="flex flex-col gap-1" style={{ padding: "12px 14px 18px" }}>
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <span class="setting-item-label" style={{ "font-weight": "600", "font-size": "13px" }}>{props.label}</span>
            <Show when={isModifiedValue() && !props.hasOverride}>
              <span 
                class="modified-indicator-dot"
                title="Modified from default"
              />
            </Show>
          </div>
          <div class="flex items-center gap-2">
            {props.children}
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

/** Row with folder picker */
function FolderPickerRow(props: {
  label: string;
  description?: string;
  settingKey: keyof GitSettings;
  value: string;
  hasOverride: boolean;
  isModified?: boolean;
  onReset?: () => void;
  onResetToDefault?: () => void;
  onChange: (value: string) => void;
}) {
  const isModifiedValue = () => props.isModified ?? false;

  const handleBrowse = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Default Clone Directory",
      });
      if (selected && typeof selected === "string") {
        props.onChange(selected);
      }
    } catch (err) {
      console.error("Failed to open folder dialog:", err);
    }
  };

  return (
    <div 
      class="setting-item-contents group relative" 
      classList={{ 
        "is-configured": props.hasOverride,
        "is-modified": isModifiedValue() && !props.hasOverride
      }}
    >
      <div class="setting-item-modified-indicator" />
      <div class="flex flex-col gap-2" style={{ padding: "12px 14px 18px" }}>
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <span class="setting-item-label" style={{ "font-weight": "600", "font-size": "13px" }}>{props.label}</span>
            <Show when={isModifiedValue() && !props.hasOverride}>
              <span 
                class="modified-indicator-dot"
                title="Modified from default"
              />
            </Show>
          </div>
          <div class="flex items-center gap-2">
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
        <div class="flex items-center gap-2">
          <input
            type="text"
            value={props.value}
            placeholder="Select a folder..."
            onChange={(e) => props.onChange(e.currentTarget.value)}
            class={`flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none ${
              props.hasOverride ? "ring-1 ring-purple-500/50" : ""
            }`}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleBrowse}
            icon={<Icon name="folder" class="h-3.5 w-3.5" />}
          >
            Browse
          </Button>
        </div>
      </div>
    </div>
  );
}

export function GitSettingsPanel(props: GitSettingsPanelProps) {
  const settings = useSettings();
  const scope = () => props.scope || "user";
  
  // Use effective settings for display
  const git = () => settings.effectiveSettings().git;

  // Helper to update setting based on current scope
  const updateSetting = <K extends keyof GitSettings>(key: K, value: GitSettings[K]) => {
    if (scope() === "workspace" && settings.hasWorkspace()) {
      settings.setWorkspaceSetting("git", key, value);
    } else {
      settings.updateSettings("git", { ...settings.userSettings().git, [key]: value });
    }
  };

  // Check if setting has workspace override
  const hasOverride = (key: keyof GitSettings) => settings.hasWorkspaceOverride("git", key);
  
  // Check if setting is modified from default
  const isModified = (key: keyof GitSettings) => settings.isSettingModified("git", key);
  
  // Reset workspace override
  const resetOverride = (key: keyof GitSettings) => {
    settings.resetWorkspaceSetting("git", key);
  };
  
  // Reset to default value
  const resetToDefault = (key: keyof GitSettings) => {
    settings.resetSettingToDefault("git", key);
  };

  const postCommitOptions = [
    { value: "none", label: "None" },
    { value: "push", label: "Push" },
    { value: "sync", label: "Sync" },
  ];

  const branchSortOptions = [
    { value: "alphabetically", label: "Alphabetically" },
    { value: "committerDate", label: "By Committer Date" },
  ];

  return (
    <div class="space-y-6 max-h-[500px] overflow-y-auto pr-2">
      {/* Scope indicator */}
      <Show when={scope() === "workspace"}>
        <div class="text-xs text-purple-400 bg-purple-500/10 rounded-lg px-3 py-2 mb-4">
          Editing workspace-specific Git settings. Changes apply only to this workspace.
        </div>
      </Show>

      {/* General Settings */}
      <SectionHeader 
        title="General" 
        description="Basic Git settings"
        icon={<Icon name="code-branch" class="h-4 w-4" />}
      />
      <FormGroup>
        <SettingRowWithOverride 
          label="Git Enabled" 
          description="Enable Git integration features"
          settingKey="enabled"
          hasOverride={hasOverride("enabled")}
          isModified={isModified("enabled")}
          onReset={() => resetOverride("enabled")}
          onResetToDefault={() => resetToDefault("enabled")}
        >
          <Toggle
            checked={git().enabled}
            onChange={(checked) => updateSetting("enabled", checked)}
          />
        </SettingRowWithOverride>
      </FormGroup>

      {/* Clone Settings */}
      <SectionHeader 
        title="Clone" 
        description="Settings for cloning repositories"
        icon={<Icon name="download" class="h-4 w-4" />}
      />
      <FormGroup>
        <FolderPickerRow
          label="Default Clone Directory"
          description="The default location for cloning repositories"
          settingKey="defaultCloneDirectory"
          value={git().defaultCloneDirectory}
          hasOverride={hasOverride("defaultCloneDirectory")}
          isModified={isModified("defaultCloneDirectory")}
          onReset={() => resetOverride("defaultCloneDirectory")}
          onResetToDefault={() => resetToDefault("defaultCloneDirectory")}
          onChange={(value) => updateSetting("defaultCloneDirectory", value)}
        />
      </FormGroup>

      {/* Commit Settings */}
      <SectionHeader 
        title="Commit" 
        description="Settings for committing changes"
        icon={<Icon name="upload" class="h-4 w-4" />}
      />
      <FormGroup>
        <SettingRowWithOverride 
          label="Post Commit Command" 
          description="Action to perform automatically after a commit"
          settingKey="postCommitCommand"
          hasOverride={hasOverride("postCommitCommand")}
          isModified={isModified("postCommitCommand")}
          onReset={() => resetOverride("postCommitCommand")}
          onResetToDefault={() => resetToDefault("postCommitCommand")}
        >
          <select
            value={git().postCommitCommand}
            onChange={(e) => updateSetting("postCommitCommand", e.currentTarget.value as GitSettings["postCommitCommand"])}
            class={`settings-inline-select ${hasOverride("postCommitCommand") ? "ring-1 ring-purple-500/50" : ""}`}
          >
            <For each={postCommitOptions}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </SettingRowWithOverride>

        <SettingRowWithOverride 
          label="Enable Smart Commit" 
          description="Stage all changes when there are no staged changes and commit"
          settingKey="enableSmartCommit"
          hasOverride={hasOverride("enableSmartCommit")}
          isModified={isModified("enableSmartCommit")}
          onReset={() => resetOverride("enableSmartCommit")}
          onResetToDefault={() => resetToDefault("enableSmartCommit")}
        >
          <Toggle
            checked={git().enableSmartCommit}
            onChange={(checked) => updateSetting("enableSmartCommit", checked)}
          />
        </SettingRowWithOverride>

        <SettingRowWithOverride 
          label="Confirm Sync" 
          description="Always confirm before synchronizing changes"
          settingKey="confirmSync"
          hasOverride={hasOverride("confirmSync")}
          isModified={isModified("confirmSync")}
          onReset={() => resetOverride("confirmSync")}
          onResetToDefault={() => resetToDefault("confirmSync")}
        >
          <Toggle
            checked={git().confirmSync}
            onChange={(checked) => updateSetting("confirmSync", checked)}
          />
        </SettingRowWithOverride>
      </FormGroup>

      {/* Fetch Settings */}
      <SectionHeader 
        title="Fetch" 
        description="Settings for fetching changes"
        icon={<Icon name="rotate" class="h-4 w-4" />}
      />
      <FormGroup>
        <SettingRowWithOverride 
          label="Autofetch" 
          description="Automatically fetch changes from remotes periodically"
          settingKey="autofetch"
          hasOverride={hasOverride("autofetch")}
          isModified={isModified("autofetch")}
          onReset={() => resetOverride("autofetch")}
          onResetToDefault={() => resetToDefault("autofetch")}
        >
          <Toggle
            checked={git().autofetch}
            onChange={(checked) => updateSetting("autofetch", checked)}
          />
        </SettingRowWithOverride>

        <Show when={git().autofetch}>
          <SettingRowWithOverride 
            label="Autofetch Period" 
            description="Time in seconds between automatic fetches"
            settingKey="autofetchPeriod"
            hasOverride={hasOverride("autofetchPeriod")}
            isModified={isModified("autofetchPeriod")}
            onReset={() => resetOverride("autofetchPeriod")}
            onResetToDefault={() => resetToDefault("autofetchPeriod")}
          >
            <div class="flex items-center gap-2">
              <input
                type="number"
                min="60"
                max="3600"
                step="30"
                value={git().autofetchPeriod}
                onChange={(e) => updateSetting("autofetchPeriod", parseInt(e.currentTarget.value) || 180)}
                class={`settings-inline-input w-24 ${hasOverride("autofetchPeriod") ? "ring-1 ring-purple-500/50" : ""}`}
              />
              <span class="text-xs text-foreground-muted">seconds</span>
            </div>
          </SettingRowWithOverride>
        </Show>

        <SettingRowWithOverride 
          label="Fetch Tags" 
          description="Fetch tags when fetching from remotes"
          settingKey="fetchTags"
          hasOverride={hasOverride("fetchTags")}
          isModified={isModified("fetchTags")}
          onReset={() => resetOverride("fetchTags")}
          onResetToDefault={() => resetToDefault("fetchTags")}
        >
          <Toggle
            checked={git().fetchTags}
            onChange={(checked) => updateSetting("fetchTags", checked)}
          />
        </SettingRowWithOverride>

        <SettingRowWithOverride 
          label="Prune on Fetch" 
          description="Remove stale remote-tracking branches when fetching"
          settingKey="pruneOnFetch"
          hasOverride={hasOverride("pruneOnFetch")}
          isModified={isModified("pruneOnFetch")}
          onReset={() => resetOverride("pruneOnFetch")}
          onResetToDefault={() => resetToDefault("pruneOnFetch")}
        >
          <Toggle
            checked={git().pruneOnFetch}
            onChange={(checked) => updateSetting("pruneOnFetch", checked)}
          />
        </SettingRowWithOverride>
      </FormGroup>

      {/* Sync Settings */}
      <SectionHeader 
        title="Sync" 
        description="Settings for synchronizing changes"
      />
      <FormGroup>
        <SettingRowWithOverride 
          label="Follow Tags When Sync" 
          description="Push tags when syncing with remote"
          settingKey="followTagsWhenSync"
          hasOverride={hasOverride("followTagsWhenSync")}
          isModified={isModified("followTagsWhenSync")}
          onReset={() => resetOverride("followTagsWhenSync")}
          onResetToDefault={() => resetToDefault("followTagsWhenSync")}
        >
          <Toggle
            checked={git().followTagsWhenSync}
            onChange={(checked) => updateSetting("followTagsWhenSync", checked)}
          />
        </SettingRowWithOverride>

        <SettingRowWithOverride 
          label="Rebase When Sync" 
          description="Use rebase instead of merge when pulling"
          settingKey="rebaseWhenSync"
          hasOverride={hasOverride("rebaseWhenSync")}
          isModified={isModified("rebaseWhenSync")}
          onReset={() => resetOverride("rebaseWhenSync")}
          onResetToDefault={() => resetToDefault("rebaseWhenSync")}
        >
          <Toggle
            checked={git().rebaseWhenSync}
            onChange={(checked) => updateSetting("rebaseWhenSync", checked)}
          />
        </SettingRowWithOverride>
      </FormGroup>

      {/* Branch Settings */}
      <SectionHeader 
        title="Branches" 
        description="Settings for branch display and behavior"
      />
      <FormGroup>
        <SettingRowWithOverride 
          label="Branch Sort Order" 
          description="How to sort branches in the branch selector"
          settingKey="branchSortOrder"
          hasOverride={hasOverride("branchSortOrder")}
          isModified={isModified("branchSortOrder")}
          onReset={() => resetOverride("branchSortOrder")}
          onResetToDefault={() => resetToDefault("branchSortOrder")}
        >
          <select
            value={git().branchSortOrder}
            onChange={(e) => updateSetting("branchSortOrder", e.currentTarget.value as GitSettings["branchSortOrder"])}
            class={`settings-inline-select ${hasOverride("branchSortOrder") ? "ring-1 ring-purple-500/50" : ""}`}
          >
            <For each={branchSortOptions}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </SettingRowWithOverride>
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
                // Reset all workspace git overrides
                const keys: (keyof GitSettings)[] = [
                  "enabled", "autofetch", "autofetchPeriod", "confirmSync",
                  "enableSmartCommit", "pruneOnFetch", "fetchTags",
                  "followTagsWhenSync", "postCommitCommand", "defaultCloneDirectory",
                  "branchSortOrder", "rebaseWhenSync"
                ];
                keys.forEach(key => {
                  if (hasOverride(key)) {
                    resetOverride(key);
                  }
                });
              }}
            >
              Reset All Workspace Git Overrides
            </Button>
          }
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => settings.resetSection("git")}
          >
            Reset Git Settings to Defaults
          </Button>
        </Show>
      </div>
    </div>
  );
}
