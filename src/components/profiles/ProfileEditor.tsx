import { Show, For, createSignal, createMemo } from "solid-js";
import { type Profile, type KeyBinding, type ProfileUIState } from "@/context/ProfilesContext";
import { Button, Input, Toggle, Text, Badge, Tabs, TabList, Tab } from "@/components/ui";
import { getProfileIcon } from "./ProfileSwitcher";
import { Icon } from "../ui/Icon";
import type { JSX } from "solid-js";

interface ProfileEditorProps {
  profile: Profile;
  onClose: () => void;
  onSave: (changes: Partial<Profile>) => void;
}

type EditorTab = "settings" | "keybindings" | "extensions" | "ui";

export function ProfileEditor(props: ProfileEditorProps) {
  const [activeTab, setActiveTab] = createSignal<EditorTab>("settings");
  const [editedProfile, setEditedProfile] = createSignal<Partial<Profile>>({});
  const [isDirty, setIsDirty] = createSignal(false);

  // Track changes
  const updateField = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setEditedProfile(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    props.onSave(editedProfile());
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    gap: "16px",
  };

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
    "padding-bottom": "16px",
    "border-bottom": "1px solid var(--jb-border-default)",
  };

  const iconStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "48px",
    height: "48px",
    "border-radius": "var(--jb-radius-lg)",
    background: "var(--jb-surface-alt)",
    color: "var(--jb-text-body-color)",
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    "overflow-y": "auto",
  };

  const footerStyle: JSX.CSSProperties = {
    display: "flex",
    "justify-content": "flex-end",
    gap: "8px",
    "padding-top": "16px",
    "border-top": "1px solid var(--jb-border-default)",
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={iconStyle}>
          {getProfileIcon(props.profile.icon, 24)}
        </div>
        <div style={{ flex: "1" }}>
          <Text variant="header" size="lg">{props.profile.name}</Text>
          <Text variant="body" style={{ color: "var(--jb-text-muted-color)", "font-size": "12px" }}>
            Last updated: {props.profile.updatedAt.toLocaleDateString()}
          </Text>
        </div>
        <Show when={props.profile.isDefault}>
          <Badge variant="default">Default Profile</Badge>
        </Show>
      </div>

      {/* Tab Navigation */}
      <Tabs activeTab={activeTab()} onChange={setActiveTab as (v: string) => void}>
        <TabList>
          <Tab id="settings">
            <Icon name="gear" size={14} />
            Settings
          </Tab>
          <Tab id="keybindings">
            <Icon name="command" size={14} />
            Keybindings
          </Tab>
          <Tab id="extensions">
            <Icon name="box" size={14} />
            Extensions
          </Tab>
          <Tab id="ui">
            <Icon name="table-columns" size={14} />
            UI State
          </Tab>
        </TabList>
      </Tabs>

      {/* Content */}
      <div style={contentStyle}>
        {/* Settings Tab */}
        <Show when={activeTab() === "settings"}>
          <SettingsEditor 
            settings={props.profile.settings || {}}
            onChange={(settings) => updateField("settings", settings)}
          />
        </Show>

        {/* Keybindings Tab */}
        <Show when={activeTab() === "keybindings"}>
          <KeybindingsEditor
            keybindings={props.profile.keybindings || []}
            onChange={(keybindings) => updateField("keybindings", keybindings)}
          />
        </Show>

        {/* Extensions Tab */}
        <Show when={activeTab() === "extensions"}>
          <ExtensionsEditor
            enabledExtensions={props.profile.enabledExtensions || []}
            onChange={(extensions) => updateField("enabledExtensions", extensions)}
          />
        </Show>

        {/* UI State Tab */}
        <Show when={activeTab() === "ui"}>
          <UIStateEditor
            uiState={props.profile.uiState}
            onChange={(uiState) => updateField("uiState", uiState)}
          />
        </Show>
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <Button variant="ghost" onClick={props.onClose}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSave}
          disabled={!isDirty()}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Settings Editor
// ============================================================================

interface SettingsEditorProps {
  settings: Partial<Record<string, unknown>>;
  onChange: (settings: Partial<Record<string, unknown>>) => void;
}

function SettingsEditor(props: SettingsEditorProps) {
  const [expandedSections, setExpandedSections] = createSignal<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const sections = createMemo(() => {
    return Object.entries(props.settings).map(([key, value]) => ({
      key,
      value,
      count: typeof value === "object" && value ? Object.keys(value).length : 1,
    }));
  });

  const sectionStyle: JSX.CSSProperties = {
    "border-radius": "var(--jb-radius-md)",
    border: "1px solid var(--jb-border-default)",
    "margin-bottom": "8px",
    overflow: "hidden",
  };

  const sectionHeaderStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "12px",
    background: "var(--jb-surface-alt)",
    cursor: "pointer",
  };

  const sectionContentStyle: JSX.CSSProperties = {
    padding: "12px",
    "font-size": "12px",
    "font-family": "var(--jb-font-mono)",
    "white-space": "pre-wrap",
    background: "var(--jb-surface)",
    color: "var(--jb-text-muted-color)",
    "max-height": "200px",
    "overflow-y": "auto",
  };

  return (
    <div>
      <Show when={sections().length === 0}>
        <div style={{ 
          "text-align": "center", 
          padding: "32px",
          color: "var(--jb-text-muted-color)",
        }}>
          <Icon name="gear" size={32} style={{ "margin-bottom": "12px", opacity: "0.5" }} />
          <Text>No custom settings in this profile</Text>
          <Text variant="muted" style={{ "margin-top": "8px" }}>
            Settings will be saved when you make changes in the Settings panel
          </Text>
        </div>
      </Show>

      <For each={sections()}>
        {(section) => {
          const isExpanded = () => expandedSections().has(section.key);
          return (
            <div style={sectionStyle}>
              <div 
                style={sectionHeaderStyle}
                onClick={() => toggleSection(section.key)}
              >
                {isExpanded() ? <Icon name="chevron-down" size={14} /> : <Icon name="chevron-right" size={14} />}
                <span style={{ flex: "1", "font-weight": "500" }}>{section.key}</span>
                <Badge variant="default" size="sm">
                  {section.count} {section.count === 1 ? "setting" : "settings"}
                </Badge>
              </div>
              <Show when={isExpanded()}>
                <div style={sectionContentStyle}>
                  {JSON.stringify(section.value, null, 2)}
                </div>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}

// ============================================================================
// Keybindings Editor
// ============================================================================

interface KeybindingsEditorProps {
  keybindings: KeyBinding[];
  onChange: (keybindings: KeyBinding[]) => void;
}

function KeybindingsEditor(props: KeybindingsEditorProps) {
  const [filter, setFilter] = createSignal("");

  const filteredKeybindings = createMemo(() => {
    const query = filter().toLowerCase();
    if (!query) return props.keybindings;
    return props.keybindings.filter(kb => 
      kb.command.toLowerCase().includes(query) ||
      kb.key.toLowerCase().includes(query)
    );
  });

  const removeKeybinding = (index: number) => {
    const updated = [...props.keybindings];
    updated.splice(index, 1);
    props.onChange(updated);
  };

  const rowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
    padding: "8px 12px",
    "border-radius": "var(--jb-radius-sm)",
    border: "1px solid var(--jb-border-default)",
    "margin-bottom": "4px",
  };

  const keyStyle: JSX.CSSProperties = {
    display: "inline-block",
    padding: "2px 8px",
    "border-radius": "var(--jb-radius-sm)",
    background: "var(--jb-surface-alt)",
    "font-family": "var(--jb-font-mono)",
    "font-size": "12px",
    "min-width": "100px",
    "text-align": "center",
  };

  return (
    <div>
      <div style={{ "margin-bottom": "12px" }}>
        <Input
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
          placeholder="Filter keybindings..."
        />
      </div>

      <Show when={filteredKeybindings().length === 0}>
        <div style={{ 
          "text-align": "center", 
          padding: "32px",
          color: "var(--jb-text-muted-color)",
        }}>
          <Icon name="command" size={32} style={{ "margin-bottom": "12px", opacity: "0.5" }} />
          <Text>No custom keybindings in this profile</Text>
          <Text variant="muted" style={{ "margin-top": "8px" }}>
            Custom keybindings will appear here when configured
          </Text>
        </div>
      </Show>

      <For each={filteredKeybindings()}>
        {(kb, index) => (
          <div style={rowStyle}>
            <span style={keyStyle}>{kb.key}</span>
            <span style={{ flex: "1", "font-size": "13px" }}>{kb.command}</span>
            <Show when={kb.when}>
              <Badge variant="default" size="sm">{kb.when}</Badge>
            </Show>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeKeybinding(index())}
            >
              <Icon name="xmark" size={14} />
            </Button>
          </div>
        )}
      </For>
    </div>
  );
}

// ============================================================================
// Extensions Editor
// ============================================================================

interface ExtensionsEditorProps {
  enabledExtensions: string[];
  onChange: (extensions: string[]) => void;
}

function ExtensionsEditor(props: ExtensionsEditorProps) {
  // In a real implementation, this would fetch all available extensions
  // For now, we just show the enabled ones with ability to toggle

  const toggleExtension = (extId: string) => {
    const current = [...props.enabledExtensions];
    const index = current.indexOf(extId);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(extId);
    }
    props.onChange(current);
  };

  const extStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
    padding: "12px",
    "border-radius": "var(--jb-radius-md)",
    border: "1px solid var(--jb-border-default)",
    "margin-bottom": "8px",
  };

  return (
    <div>
      <Show when={props.enabledExtensions.length === 0}>
        <div style={{ 
          "text-align": "center", 
          padding: "32px",
          color: "var(--jb-text-muted-color)",
        }}>
          <Icon name="box" size={32} style={{ "margin-bottom": "12px", opacity: "0.5" }} />
          <Text>No extensions configured for this profile</Text>
          <Text variant="muted" style={{ "margin-top": "8px" }}>
            Extensions enabled in this profile will be synced when you switch profiles
          </Text>
        </div>
      </Show>

      <For each={props.enabledExtensions}>
        {(extId) => (
          <div style={extStyle}>
            <Icon name="box" size={16} />
            <span style={{ flex: "1", "font-size": "13px" }}>{extId}</span>
            <Toggle
              checked={true}
              onChange={() => toggleExtension(extId)}
            />
          </div>
        )}
      </For>
    </div>
  );
}

// ============================================================================
// UI State Editor
// ============================================================================

interface UIStateEditorProps {
  uiState?: ProfileUIState;
  onChange: (uiState: ProfileUIState) => void;
}

function UIStateEditor(props: UIStateEditorProps) {
  const defaultState: ProfileUIState = {
    sidebarWidth: 260,
    sidebarCollapsed: false,
    panelHeight: 250,
    panelCollapsed: true,
    activityBarVisible: true,
    statusBarVisible: true,
    zenMode: false,
    activeActivityBarItem: "explorer",
    explorerExpandedFolders: [],
    auxiliaryBarWidth: 320,
    auxiliaryBarCollapsed: true,
  };

  const state = () => ({ ...defaultState, ...props.uiState });

  const updateState = <K extends keyof ProfileUIState>(key: K, value: ProfileUIState[K]) => {
    props.onChange({ ...state(), [key]: value });
  };

  const rowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "12px 0",
    "border-bottom": "1px solid var(--jb-border-light)",
  };

  const labelStyle: JSX.CSSProperties = {
    "font-size": "13px",
    color: "var(--jb-text-body-color)",
  };

  return (
    <div>
      <Text variant="muted" style={{ "margin-bottom": "16px", display: "block" }}>
        UI state determines the layout when this profile is activated.
      </Text>

      <div style={rowStyle}>
        <span style={labelStyle}>Sidebar Collapsed</span>
        <Toggle
          checked={state().sidebarCollapsed}
          onChange={(checked) => updateState("sidebarCollapsed", checked)}
        />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Panel Collapsed</span>
        <Toggle
          checked={state().panelCollapsed}
          onChange={(checked) => updateState("panelCollapsed", checked)}
        />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Activity Bar Visible</span>
        <Toggle
          checked={state().activityBarVisible}
          onChange={(checked) => updateState("activityBarVisible", checked)}
        />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Status Bar Visible</span>
        <Toggle
          checked={state().statusBarVisible}
          onChange={(checked) => updateState("statusBarVisible", checked)}
        />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Zen Mode</span>
        <Toggle
          checked={state().zenMode}
          onChange={(checked) => updateState("zenMode", checked)}
        />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Sidebar Width</span>
        <Input
          type="number"
          value={state().sidebarWidth.toString()}
          onInput={(e) => updateState("sidebarWidth", parseInt(e.currentTarget.value) || 260)}
          style={{ width: "80px" }}
        />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Panel Height</span>
        <Input
          type="number"
          value={state().panelHeight.toString()}
          onInput={(e) => updateState("panelHeight", parseInt(e.currentTarget.value) || 250)}
          style={{ width: "80px" }}
        />
      </div>
    </div>
  );
}
