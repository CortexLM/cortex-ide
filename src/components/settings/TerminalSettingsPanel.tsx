import { Show, For, createSignal, onMount, JSX } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useSettings, type SettingsScope, type TerminalSettings } from "@/context/SettingsContext";
import { Toggle, SectionHeader, FormGroup, Button } from "./FormComponents";
import { Icon } from "../ui/Icon";
import { TERMINAL_THEMES, getTerminalThemeDefinition } from "@/lib/terminalThemes";

interface TerminalSettingsPanelProps {
  scope?: SettingsScope;
}

/** Row with workspace override indicator */
function SettingRowWithOverride(props: {
  label: string;
  settingKey: keyof TerminalSettings;
  hasOverride: boolean;
  onReset?: () => void;
  children: JSX.Element;
}) {
  return (
    <div class="settings-row group relative">
      <div class="flex items-center gap-2">
        <Show when={props.hasOverride}>
          <span 
            class="w-2 h-2 rounded-full bg-purple-500" 
            title="This setting has a workspace override"
          />
        </Show>
        <span class="settings-row-label">{props.label}</span>
      </div>
      <div class="flex items-center gap-2">
        {props.children}
        <Show when={props.hasOverride && props.onReset}>
          <button
            onClick={props.onReset}
            class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background-tertiary text-foreground-muted hover:text-foreground transition-opacity"
            title="Reset to user setting"
          >
            <Icon name="rotate-left" class="h-3 w-3" />
          </button>
        </Show>
      </div>
    </div>
  );
}

/** Flex column row variant for multi-line inputs */
function SettingRowColumnWithOverride(props: {
  label: string;
  settingKey: keyof TerminalSettings;
  hasOverride: boolean;
  onReset?: () => void;
  hint?: string;
  children: JSX.Element;
}) {
  return (
    <div class="settings-row flex-col items-start gap-2 group">
      <div class="flex items-center gap-2 w-full justify-between">
        <div class="flex items-center gap-2">
          <Show when={props.hasOverride}>
            <span 
              class="w-2 h-2 rounded-full bg-purple-500" 
              title="This setting has a workspace override"
            />
          </Show>
          <span class="settings-row-label">{props.label}</span>
        </div>
        <Show when={props.hasOverride && props.onReset}>
          <button
            onClick={props.onReset}
            class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background-tertiary text-foreground-muted hover:text-foreground transition-opacity"
            title="Reset to user setting"
          >
            <Icon name="rotate-left" class="h-3 w-3" />
          </button>
        </Show>
      </div>
      {props.children}
      <Show when={props.hint}>
        <span class="text-xs text-foreground-muted">{props.hint}</span>
      </Show>
    </div>
  );
}

export function TerminalSettingsPanel(props: TerminalSettingsPanelProps) {
  const settings = useSettings();
  const scope = () => props.scope || "user";
  
  // Use effective settings for display
  const terminal = () => settings.effectiveSettings().terminal;
  const [defaultShell, setDefaultShell] = createSignal("");

  onMount(async () => {
    try {
      const shell = await invoke<string>("terminal_get_default_shell");
      setDefaultShell(shell);
    } catch (e) {
      console.error("Failed to get default shell:", e);
    }
  });

  // Helper to update setting based on current scope
  const updateSetting = <K extends keyof TerminalSettings>(key: K, value: TerminalSettings[K]) => {
    if (scope() === "workspace" && settings.hasWorkspace()) {
      settings.setWorkspaceSetting("terminal", key, value);
    } else {
      settings.updateTerminalSetting(key, value);
    }
  };

  // Check if setting has workspace override
  const hasOverride = (key: keyof TerminalSettings) => settings.hasWorkspaceOverride("terminal", key);
  
  // Reset workspace override
  const resetOverride = (key: keyof TerminalSettings) => {
    settings.resetWorkspaceSetting("terminal", key);
  };

  const fontFamilyOptions = [
    { value: "JetBrains Mono, Fira Code, Consolas, monospace", label: "JetBrains Mono" },
    { value: "Fira Code, Consolas, monospace", label: "Fira Code" },
    { value: "SF Mono, Monaco, Consolas, monospace", label: "SF Mono" },
    { value: "Cascadia Code, Consolas, monospace", label: "Cascadia Code" },
    { value: "Consolas, monospace", label: "Consolas" },
    { value: "Monaco, monospace", label: "Monaco" },
    { value: "monospace", label: "System Monospace" },
  ];

  const fontSizeOptions = [10, 11, 12, 13, 14, 15, 16, 18, 20].map(s => ({
    value: s.toString(),
    label: `${s}px`,
  }));

  const lineHeightOptions = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5].map(s => ({
    value: s.toString(),
    label: s.toString(),
  }));

  const cursorStyleOptions = [
    { value: "block", label: "Block" },
    { value: "underline", label: "Underline" },
    { value: "bar", label: "Bar" },
  ];

  const scrollbackOptions = [
    { value: "1000", label: "1,000 lines" },
    { value: "5000", label: "5,000 lines" },
    { value: "10000", label: "10,000 lines" },
    { value: "50000", label: "50,000 lines" },
    { value: "100000", label: "100,000 lines" },
  ];

  const bellOptions = [
    { value: "none", label: "None" },
    { value: "audible", label: "Audible (System Beep)" },
    { value: "visual", label: "Visual (Flash)" },
  ];

  // Terminal color scheme options from predefined themes
  const colorSchemeOptions = TERMINAL_THEMES.map(theme => ({
    value: theme.id,
    label: theme.name,
  }));

  // Get current theme for preview
  const currentThemeDef = () => getTerminalThemeDefinition(terminal().colorScheme || "default-dark");

  return (
    <div class="space-y-6 max-h-[500px] overflow-y-auto pr-2">
      {/* Scope indicator */}
      <Show when={scope() === "workspace"}>
        <div class="text-xs text-purple-400 bg-purple-500/10 rounded-lg px-3 py-2 mb-4">
          Editing workspace-specific terminal settings. Changes apply only to this workspace.
        </div>
      </Show>

      {/* Shell Configuration */}
      <SectionHeader title="Shell" />
      <FormGroup>
        <SettingRowWithOverride 
          label="Shell Path" 
          settingKey="shellPath"
          hasOverride={hasOverride("shellPath")}
          onReset={() => resetOverride("shellPath")}
        >
          <input
            type="text"
            value={terminal().shellPath || defaultShell()}
            placeholder={defaultShell() || "Default shell"}
            onChange={(e) => updateSetting("shellPath", e.currentTarget.value)}
            class={`settings-inline-input flex-1 ${hasOverride("shellPath") ? "ring-1 ring-purple-500/50" : ""}`}
          />
        </SettingRowWithOverride>
        <SettingRowColumnWithOverride 
          label="Shell Arguments" 
          settingKey="shellArgs"
          hasOverride={hasOverride("shellArgs")}
          onReset={() => resetOverride("shellArgs")}
          hint="Space-separated arguments passed to the shell"
        >
          <input
            type="text"
            value={terminal().shellArgs.join(" ")}
            placeholder="e.g., -l -i"
            onChange={(e) => updateSetting("shellArgs", e.currentTarget.value.split(" ").filter(Boolean))}
            class={`settings-inline-input w-full ${hasOverride("shellArgs") ? "ring-1 ring-purple-500/50" : ""}`}
          />
        </SettingRowColumnWithOverride>
        <SettingRowColumnWithOverride 
          label="Working Directory" 
          settingKey="cwd"
          hasOverride={hasOverride("cwd")}
          onReset={() => resetOverride("cwd")}
          hint="Initial working directory for new terminals"
        >
          <input
            type="text"
            value={terminal().cwd}
            placeholder="Default: workspace root"
            onChange={(e) => updateSetting("cwd", e.currentTarget.value)}
            class={`settings-inline-input w-full ${hasOverride("cwd") ? "ring-1 ring-purple-500/50" : ""}`}
          />
        </SettingRowColumnWithOverride>
      </FormGroup>

      {/* Appearance */}
      <SectionHeader title="Appearance" />
      <FormGroup>
        <SettingRowWithOverride 
          label="Color Scheme" 
          settingKey="colorScheme"
          hasOverride={hasOverride("colorScheme")}
          onReset={() => resetOverride("colorScheme")}
        >
          <select
            value={terminal().colorScheme || "default-dark"}
            onChange={(e) => updateSetting("colorScheme", e.currentTarget.value)}
            class={`settings-inline-select flex-1 ${hasOverride("colorScheme") ? "ring-1 ring-purple-500/50" : ""}`}
          >
            <For each={colorSchemeOptions}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </SettingRowWithOverride>
        {/* Theme preview */}
        <div class="mt-2">
          <div 
            class="rounded-md p-3 font-mono text-xs overflow-hidden"
            style={{
              "background-color": currentThemeDef().theme.background,
              color: currentThemeDef().theme.foreground,
              border: "1px solid var(--border)"
            }}
          >
            <div class="flex gap-2 mb-1">
              <span style={{ color: currentThemeDef().theme.green }}>user@cortex</span>
              <span style={{ color: currentThemeDef().theme.blue }}>~/projects</span>
              <span style={{ color: currentThemeDef().theme.foreground }}>$</span>
            </div>
            <div class="flex gap-1 flex-wrap">
              <span style={{ color: currentThemeDef().theme.red }}>red</span>
              <span style={{ color: currentThemeDef().theme.green }}>green</span>
              <span style={{ color: currentThemeDef().theme.yellow }}>yellow</span>
              <span style={{ color: currentThemeDef().theme.blue }}>blue</span>
              <span style={{ color: currentThemeDef().theme.magenta }}>magenta</span>
              <span style={{ color: currentThemeDef().theme.cyan }}>cyan</span>
            </div>
          </div>
          <span class="text-xs text-foreground-muted mt-1 block">{currentThemeDef().description}</span>
        </div>
      </FormGroup>

      {/* Font Settings */}
      <SectionHeader title="Font" />
      <FormGroup>
        <SettingRowWithOverride 
          label="Font Family" 
          settingKey="fontFamily"
          hasOverride={hasOverride("fontFamily")}
          onReset={() => resetOverride("fontFamily")}
        >
          <select
            value={terminal().fontFamily}
            onChange={(e) => updateSetting("fontFamily", e.currentTarget.value)}
            class={`settings-inline-select flex-1 ${hasOverride("fontFamily") ? "ring-1 ring-purple-500/50" : ""}`}
          >
            <For each={fontFamilyOptions}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </SettingRowWithOverride>
        <SettingRowWithOverride 
          label="Font Size" 
          settingKey="fontSize"
          hasOverride={hasOverride("fontSize")}
          onReset={() => resetOverride("fontSize")}
        >
          <select
            value={terminal().fontSize.toString()}
            onChange={(e) => updateSetting("fontSize", parseInt(e.currentTarget.value))}
            class={`settings-inline-select ${hasOverride("fontSize") ? "ring-1 ring-purple-500/50" : ""}`}
          >
            <For each={fontSizeOptions}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </SettingRowWithOverride>
        <SettingRowWithOverride 
          label="Line Height" 
          settingKey="lineHeight"
          hasOverride={hasOverride("lineHeight")}
          onReset={() => resetOverride("lineHeight")}
        >
          <select
            value={terminal().lineHeight.toString()}
            onChange={(e) => updateSetting("lineHeight", parseFloat(e.currentTarget.value))}
            class={`settings-inline-select ${hasOverride("lineHeight") ? "ring-1 ring-purple-500/50" : ""}`}
          >
            <For each={lineHeightOptions}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </SettingRowWithOverride>
      </FormGroup>

      {/* Cursor */}
      <SectionHeader title="Cursor" />
      <FormGroup>
        <SettingRowWithOverride 
          label="Cursor Style" 
          settingKey="cursorStyle"
          hasOverride={hasOverride("cursorStyle")}
          onReset={() => resetOverride("cursorStyle")}
        >
          <select
            value={terminal().cursorStyle}
            onChange={(e) => updateSetting("cursorStyle", e.currentTarget.value as TerminalSettings["cursorStyle"])}
            class={`settings-inline-select ${hasOverride("cursorStyle") ? "ring-1 ring-purple-500/50" : ""}`}
          >
            <For each={cursorStyleOptions}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </SettingRowWithOverride>
        <SettingRowWithOverride 
          label="Cursor Blink" 
          settingKey="cursorBlink"
          hasOverride={hasOverride("cursorBlink")}
          onReset={() => resetOverride("cursorBlink")}
        >
          <Toggle
            checked={terminal().cursorBlink}
            onChange={(checked) => updateSetting("cursorBlink", checked)}
          />
        </SettingRowWithOverride>
      </FormGroup>

      {/* Behavior */}
      <SectionHeader title="Behavior" />
      <FormGroup>
        <SettingRowWithOverride 
          label="Scrollback" 
          settingKey="scrollback"
          hasOverride={hasOverride("scrollback")}
          onReset={() => resetOverride("scrollback")}
        >
          <select
            value={terminal().scrollback.toString()}
            onChange={(e) => updateSetting("scrollback", parseInt(e.currentTarget.value))}
            class={`settings-inline-select ${hasOverride("scrollback") ? "ring-1 ring-purple-500/50" : ""}`}
          >
            <For each={scrollbackOptions}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </SettingRowWithOverride>
        <SettingRowWithOverride 
          label="Copy On Selection" 
          settingKey="copyOnSelection"
          hasOverride={hasOverride("copyOnSelection")}
          onReset={() => resetOverride("copyOnSelection")}
        >
          <Toggle
            checked={terminal().copyOnSelection}
            onChange={(checked) => updateSetting("copyOnSelection", checked)}
          />
        </SettingRowWithOverride>
        <SettingRowWithOverride 
          label="Use Integrated GPU" 
          settingKey="integratedGpu"
          hasOverride={hasOverride("integratedGpu")}
          onReset={() => resetOverride("integratedGpu")}
        >
          <Toggle
            checked={terminal().integratedGpu}
            onChange={(checked) => updateSetting("integratedGpu", checked)}
          />
        </SettingRowWithOverride>
        <SettingRowColumnWithOverride 
          label="Word Separators" 
          settingKey="wordSeparators"
          hasOverride={hasOverride("wordSeparators")}
          onReset={() => resetOverride("wordSeparators")}
          hint="Characters that separate words for double-click selection"
        >
          <input
            type="text"
            value={terminal().wordSeparators}
            placeholder={" ()[]{}',\"'─''"}
            onChange={(e) => updateSetting("wordSeparators", e.currentTarget.value)}
            class={`settings-inline-input w-full font-mono ${hasOverride("wordSeparators") ? "ring-1 ring-purple-500/50" : ""}`}
          />
        </SettingRowColumnWithOverride>
        <SettingRowWithOverride 
          label="Bell" 
          settingKey="bell"
          hasOverride={hasOverride("bell")}
          onReset={() => resetOverride("bell")}
        >
          <select
            value={terminal().bell}
            onChange={(e) => updateSetting("bell", e.currentTarget.value as TerminalSettings["bell"])}
            class={`settings-inline-select ${hasOverride("bell") ? "ring-1 ring-purple-500/50" : ""}`}
          >
            <For each={bellOptions}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </SettingRowWithOverride>
      </FormGroup>

      {/* Accessibility */}
      <SectionHeader title="Accessibility" />
      <FormGroup>
        <SettingRowWithOverride 
          label="Accessible View Mode" 
          settingKey="accessibleViewEnabled"
          hasOverride={hasOverride("accessibleViewEnabled")}
          onReset={() => resetOverride("accessibleViewEnabled")}
        >
          <Toggle
            checked={terminal().accessibleViewEnabled}
            onChange={(checked) => updateSetting("accessibleViewEnabled", checked)}
          />
        </SettingRowWithOverride>
        <div class="text-xs text-foreground-muted ml-4 -mt-2 mb-2">
          Enables an accessible buffer for screen readers. May impact performance.
        </div>
        <SettingRowWithOverride 
          label="Screen Reader Announcements" 
          settingKey="screenReaderAnnounce"
          hasOverride={hasOverride("screenReaderAnnounce")}
          onReset={() => resetOverride("screenReaderAnnounce")}
        >
          <Toggle
            checked={terminal().screenReaderAnnounce}
            onChange={(checked) => updateSetting("screenReaderAnnounce", checked)}
          />
        </SettingRowWithOverride>
        <div class="text-xs text-foreground-muted ml-4 -mt-2 mb-2">
          Announce command completions and important terminal events to screen readers.
        </div>
      </FormGroup>

      {/* Info Box */}
      <div class="rounded-lg border border-border p-4 bg-background-tertiary/50">
        <h4 class="font-medium text-sm mb-2">Terminal Shortcuts</h4>
        <div class="space-y-1 text-xs text-foreground-muted">
          <div class="flex items-center gap-2">
            <kbd class="px-1.5 py-0.5 rounded bg-background text-foreground">Ctrl+`</kbd>
            <span>Toggle Terminal Panel</span>
          </div>
          <div class="flex items-center gap-2">
            <kbd class="px-1.5 py-0.5 rounded bg-background text-foreground">Ctrl+Shift+`</kbd>
            <span>Create New Terminal</span>
          </div>
          <div class="flex items-center gap-2">
            <kbd class="px-1.5 py-0.5 rounded bg-background text-foreground">Ctrl+C</kbd>
            <span>Interrupt (Send SIGINT)</span>
          </div>
          <div class="flex items-center gap-2">
            <kbd class="px-1.5 py-0.5 rounded bg-background text-foreground">Ctrl+↑/↓</kbd>
            <span>Navigate command history (accessibility)</span>
          </div>
          <div class="flex items-center gap-2">
            <kbd class="px-1.5 py-0.5 rounded bg-background text-foreground">Ctrl+A</kbd>
            <span>Select all terminal content</span>
          </div>
        </div>
      </div>

      {/* Reset Button */}
      <div class="pt-4 border-t border-border">
        <Show 
          when={scope() === "user"}
          fallback={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Reset all workspace terminal overrides
                const keys: (keyof TerminalSettings)[] = [
                  "shellPath", "shellArgs", "cwd", "fontFamily", "fontSize",
                  "lineHeight", "cursorStyle", "cursorBlink", "scrollback",
                  "copyOnSelection", "integratedGpu", "env", "colorScheme",
                  "wordSeparators", "bell", "accessibleViewEnabled", "screenReaderAnnounce"
                ];
                keys.forEach(key => {
                  if (hasOverride(key)) {
                    resetOverride(key);
                  }
                });
              }}
            >
              Reset All Workspace Terminal Overrides
            </Button>
          }
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => settings.resetSection("terminal")}
          >
            Reset Terminal Settings to Defaults
          </Button>
        </Show>
      </div>
    </div>
  );
}
