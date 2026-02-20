import { Show, For, JSX } from "solid-js";
import { useSettings, type SettingsScope, type HttpSettings } from "@/context/SettingsContext";
import { Toggle, SectionHeader, FormGroup, Button } from "./FormComponents";
import { Icon } from "../ui/Icon";

interface NetworkSettingsPanelProps {
  scope?: SettingsScope;
}

/** Row with workspace override indicator */
function SettingRowWithOverride(props: {
  label: string;
  settingKey: keyof HttpSettings;
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
  settingKey: keyof HttpSettings;
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

export function NetworkSettingsPanel(props: NetworkSettingsPanelProps) {
  const settings = useSettings();
  const scope = () => props.scope || "user";
  
  // Use effective settings for display
  const http = () => settings.effectiveSettings().http;

  // Helper to update setting based on current scope
  const updateSetting = <K extends keyof HttpSettings>(key: K, value: HttpSettings[K]) => {
    if (scope() === "workspace" && settings.hasWorkspace()) {
      settings.setWorkspaceSetting("http", key, value);
    } else {
      settings.updateHttpSetting(key, value);
    }
  };

  // Check if setting has workspace override
  const hasOverride = (key: keyof HttpSettings) => settings.hasWorkspaceOverride("http", key);
  
  // Reset workspace override
  const resetOverride = (key: keyof HttpSettings) => {
    settings.resetWorkspaceSetting("http", key);
  };

  const proxySupportOptions = [
    { value: "off", label: "Off", description: "Never use proxy" },
    { value: "on", label: "On", description: "Always use proxy" },
    { value: "fallback", label: "Fallback", description: "Use proxy only if direct connection fails" },
  ];

  return (
    <div class="space-y-6 max-h-[500px] overflow-y-auto pr-2">
      {/* Scope indicator */}
      <Show when={scope() === "workspace"}>
        <div class="text-xs text-purple-400 bg-purple-500/10 rounded-lg px-3 py-2 mb-4">
          Editing workspace-specific network settings. Changes apply only to this workspace.
        </div>
      </Show>

      {/* Proxy Configuration */}
      <SectionHeader 
        title="HTTP Proxy" 
        icon={<Icon name="globe" class="h-4 w-4" />}
      />
      <FormGroup>
        <SettingRowColumnWithOverride 
          label="Proxy URL" 
          settingKey="proxy"
          hasOverride={hasOverride("proxy")}
          onReset={() => resetOverride("proxy")}
          hint="HTTP proxy URL (e.g., http://proxy.example.com:8080)"
        >
          <input
            type="text"
            value={http().proxy}
            placeholder="http://proxy.example.com:8080"
            onChange={(e) => updateSetting("proxy", e.currentTarget.value)}
            class={`settings-inline-input w-full ${hasOverride("proxy") ? "ring-1 ring-purple-500/50" : ""}`}
          />
        </SettingRowColumnWithOverride>

        <SettingRowWithOverride 
          label="Proxy Support" 
          settingKey="proxySupport"
          hasOverride={hasOverride("proxySupport")}
          onReset={() => resetOverride("proxySupport")}
        >
          <select
            value={http().proxySupport}
            onChange={(e) => updateSetting("proxySupport", e.currentTarget.value as HttpSettings["proxySupport"])}
            class={`settings-inline-select flex-1 ${hasOverride("proxySupport") ? "ring-1 ring-purple-500/50" : ""}`}
          >
            <For each={proxySupportOptions}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </SettingRowWithOverride>

        <SettingRowWithOverride 
          label="Strict SSL" 
          settingKey="proxyStrictSSL"
          hasOverride={hasOverride("proxyStrictSSL")}
          onReset={() => resetOverride("proxyStrictSSL")}
        >
          <Toggle
            checked={http().proxyStrictSSL}
            onChange={(checked) => updateSetting("proxyStrictSSL", checked)}
          />
        </SettingRowWithOverride>
      </FormGroup>

      {/* Proxy Authentication */}
      <SectionHeader title="Proxy Authentication" />
      <FormGroup>
        <SettingRowColumnWithOverride 
          label="Proxy Authorization" 
          settingKey="proxyAuthorization"
          hasOverride={hasOverride("proxyAuthorization")}
          onReset={() => resetOverride("proxyAuthorization")}
          hint="Authorization header value for proxy authentication (e.g., Basic <base64-credentials>)"
        >
          <input
            type="password"
            value={http().proxyAuthorization || ""}
            placeholder="Basic username:password (base64 encoded)"
            onChange={(e) => updateSetting("proxyAuthorization", e.currentTarget.value || null)}
            class={`settings-inline-input w-full ${hasOverride("proxyAuthorization") ? "ring-1 ring-purple-500/50" : ""}`}
          />
        </SettingRowColumnWithOverride>
      </FormGroup>

      {/* Info Box */}
      <div class="rounded-lg border border-border p-4 bg-background-tertiary/50">
        <h4 class="font-medium text-sm mb-2">Proxy Configuration</h4>
        <div class="space-y-2 text-xs text-foreground-muted">
          <p>
            Configure HTTP proxy settings for network requests including API calls, 
            extension downloads, and AI provider requests.
          </p>
          <div class="space-y-1">
            <div><strong>Off:</strong> Never use proxy, connect directly.</div>
            <div><strong>On:</strong> Always route traffic through the proxy.</div>
            <div><strong>Fallback:</strong> Try direct connection first, use proxy if it fails.</div>
          </div>
          <p class="mt-2">
            <strong>Note:</strong> Disable "Strict SSL" only if your proxy uses a self-signed certificate.
            This reduces security and should be used with caution.
          </p>
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
                // Reset all workspace http overrides
                const keys: (keyof HttpSettings)[] = [
                  "proxy", "proxyStrictSSL", "proxyAuthorization", "proxySupport"
                ];
                keys.forEach(key => {
                  if (hasOverride(key)) {
                    resetOverride(key);
                  }
                });
              }}
            >
              Reset All Workspace Network Overrides
            </Button>
          }
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => settings.resetSection("http")}
          >
            Reset Network Settings to Defaults
          </Button>
        </Show>
      </div>
    </div>
  );
}
