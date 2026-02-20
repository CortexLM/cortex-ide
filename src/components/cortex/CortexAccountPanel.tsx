import { Component, createSignal, createResource, For, Show, onMount } from "solid-js";
import { CortexIcon } from "./primitives/CortexIcon";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "../../utils/tauri";

type AccountTab = "profile" | "subscription" | "usage" | "tokens" | "security";

interface TabDef { id: AccountTab; label: string; icon: string }

const TABS: TabDef[] = [
  { id: "profile", label: "Profile", icon: "user-01" },
  { id: "subscription", label: "Subscription", icon: "tag-02" },
  { id: "usage", label: "AI Usage", icon: "pie-chart-01" },
  { id: "tokens", label: "API Tokens", icon: "data" },
  { id: "security", label: "Security", icon: "shield-02" },
];

interface ProviderDef { key: string; label: string; description: string }

const PROVIDERS: ProviderDef[] = [
  { key: "openai_api_key", label: "OpenAI", description: "GPT-4, GPT-3.5" },
  { key: "anthropic_api_key", label: "Anthropic", description: "Claude models" },
  { key: "openrouter_api_key", label: "OpenRouter", description: "Multi-provider router" },
  { key: "supermaven_api_key", label: "Supermaven", description: "Code completion" },
  { key: "google_api_key", label: "Google", description: "Gemini models" },
];

export const CortexAccountPanel: Component = () => {
  const [activeTab, setActiveTab] = createSignal<AccountTab>("profile");
  const [providerStatus, setProviderStatus] = createSignal<Record<string, boolean>>({});
  const [editingKey, setEditingKey] = createSignal<string | null>(null);
  const [keyInput, setKeyInput] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  onMount(() => { checkAllKeys(); });

  const checkAllKeys = async () => {
    const status: Record<string, boolean> = {};
    for (const p of PROVIDERS) {
      try {
        status[p.key] = await invoke<boolean>("settings_get_api_key_exists", { keyName: p.key });
      } catch { status[p.key] = false; }
    }
    setProviderStatus(status);
  };

  const handleSaveKey = async (keyName: string) => {
    const value = keyInput().trim();
    if (!value) return;
    setSaving(true);
    try {
      await invoke("settings_set_api_key", { keyName, apiKey: value });
      setProviderStatus(prev => ({ ...prev, [keyName]: true }));
      setEditingKey(null);
      setKeyInput("");
    } catch { /* key not saved */ }
    setSaving(false);
  };

  const handleDeleteKey = async (keyName: string) => {
    try {
      await invoke("settings_delete_api_key", { keyName });
      setProviderStatus(prev => ({ ...prev, [keyName]: false }));
    } catch { /* ignore */ }
  };

  return (
    <div style={panelStyle}>
      <div style={tabBarStyle}>
        <div style={tabRowStyle}>
          <For each={TABS}>{(tab) => (
            <button
              style={tabBtnStyle(activeTab() === tab.id)}
              onClick={() => setActiveTab(tab.id)}
            >
              <CortexIcon name={tab.icon} size={16} color={activeTab() === tab.id ? "var(--cortex-text-primary)" : "var(--cortex-text-inactive)"} />
              <span>{tab.label}</span>
              <Show when={activeTab() === tab.id}>
                <div style={tabIndicatorStyle} />
              </Show>
            </button>
          )}</For>
        </div>
      </div>

      <div style={contentStyle}>
        <Show when={activeTab() === "profile"}><ProfileContent /></Show>
        <Show when={activeTab() === "subscription"}><SubscriptionContent /></Show>
        <Show when={activeTab() === "usage"}><UsageContent /></Show>
        <Show when={activeTab() === "tokens"}>
          <TokensContent
            providers={PROVIDERS}
            status={providerStatus()}
            editingKey={editingKey()}
            keyInput={keyInput()}
            saving={saving()}
            onEdit={(key) => { setEditingKey(key); setKeyInput(""); }}
            onCancel={() => { setEditingKey(null); setKeyInput(""); }}
            onInputChange={setKeyInput}
            onSave={handleSaveKey}
            onDelete={handleDeleteKey}
          />
        </Show>
        <Show when={activeTab() === "security"}><SecurityContent /></Show>
      </div>
    </div>
  );
};

const ProfileContent: Component = () => {
  const [appVersion] = createResource(() => getVersion().catch(() => "0.1.0"));

  return (
    <div style={{ padding: "24px 20px", display: "flex", "flex-direction": "column", gap: "24px" }}>
      <div style={{ display: "flex", "align-items": "center", gap: "16px" }}>
        <div style={avatarStyle}>
          <CortexIcon name="user" size={32} color="var(--cortex-text-inactive)" />
        </div>
        <div>
          <div style={{ "font-size": "16px", "font-weight": "500", color: "var(--cortex-text-primary)" }}>User</div>
          <div style={{ "font-size": "13px", color: "var(--cortex-text-inactive)", "margin-top": "2px" }}>Not signed in</div>
        </div>
      </div>
      <button style={signInBtnStyle}>
        <CortexIcon name="git-logo" size={16} color="var(--cortex-text-primary)" />
        <span>Continue with GitHub</span>
      </button>
      <button style={{ ...signInBtnStyle, "margin-top": "-12px" }}>
        <CortexIcon name="globe" size={16} color="var(--cortex-text-primary)" />
        <span>Continue with Google</span>
      </button>
      <div style={{ "margin-top": "auto", "font-size": "12px", color: "var(--cortex-text-inactive)" }}>
        Cortex Desktop v{appVersion() ?? "0.1.0"}
      </div>
    </div>
  );
};

const SubscriptionContent: Component = () => (
  <div style={placeholderStyle}>
    <CortexIcon name="tag-02" size={32} color="var(--cortex-text-inactive)" />
    <div style={{ "font-size": "14px", "font-weight": "500" }}>Free Plan</div>
    <div style={{ "font-size": "12px", color: "var(--cortex-text-inactive)" }}>Sign in to manage your subscription</div>
  </div>
);

const UsageContent: Component = () => (
  <div style={placeholderStyle}>
    <CortexIcon name="pie-chart-01" size={32} color="var(--cortex-text-inactive)" />
    <div style={{ "font-size": "14px", "font-weight": "500" }}>AI Usage</div>
    <div style={{ "font-size": "12px", color: "var(--cortex-text-inactive)" }}>Configure an API key to track usage</div>
  </div>
);

const SecurityContent: Component = () => (
  <div style={placeholderStyle}>
    <CortexIcon name="shield-02" size={32} color="var(--cortex-text-inactive)" />
    <div style={{ "font-size": "14px", "font-weight": "500" }}>Security</div>
    <div style={{ "font-size": "12px", color: "var(--cortex-text-inactive)" }}>API keys are stored securely in your OS keychain</div>
  </div>
);

interface TokensProps {
  providers: ProviderDef[];
  status: Record<string, boolean>;
  editingKey: string | null;
  keyInput: string;
  saving: boolean;
  onEdit: (key: string) => void;
  onCancel: () => void;
  onInputChange: (v: string) => void;
  onSave: (key: string) => void;
  onDelete: (key: string) => void;
}

const TokensContent: Component<TokensProps> = (props) => (
  <div style={{ padding: "16px 0" }}>
    <div style={{ padding: "0 20px 12px", "font-size": "12px", color: "var(--cortex-text-inactive)" }}>
      Manage API keys for AI providers. Keys are stored in your OS keychain.
    </div>
    <For each={props.providers}>{(provider) => (
      <div style={providerRowStyle}>
        <div style={{ display: "flex", "align-items": "center", gap: "12px", flex: "1" }}>
          <div style={statusDotStyle(props.status[provider.key] ?? false)} />
          <div>
            <div style={{ "font-size": "14px", "font-weight": "500", color: "var(--cortex-text-primary)" }}>{provider.label}</div>
            <div style={{ "font-size": "12px", color: "var(--cortex-text-inactive)" }}>{provider.description}</div>
          </div>
        </div>
        <Show when={props.editingKey === provider.key} fallback={
          <div style={{ display: "flex", gap: "6px" }}>
            <button style={smallBtnStyle} onClick={() => props.onEdit(provider.key)}>
              {props.status[provider.key] ? "Edit" : "Add"}
            </button>
            <Show when={props.status[provider.key]}>
              <button style={{ ...smallBtnStyle, color: "var(--cortex-error)" }} onClick={() => props.onDelete(provider.key)}>
                Remove
              </button>
            </Show>
          </div>
        }>
          <div style={{ display: "flex", gap: "6px", "align-items": "center" }}>
            <input
              type="password"
              value={props.keyInput}
              onInput={(e) => props.onInputChange(e.currentTarget.value)}
              placeholder="sk-..."
              style={keyInputStyle}
            />
            <button style={{ ...smallBtnStyle, background: "var(--cortex-accent-primary)", color: "var(--cortex-accent-text)" }} onClick={() => props.onSave(provider.key)}>
              {props.saving ? "..." : "Save"}
            </button>
            <button style={smallBtnStyle} onClick={props.onCancel}>Cancel</button>
          </div>
        </Show>
      </div>
    )}</For>
  </div>
);

// === Styles ===

const panelStyle = {
  display: "flex", "flex-direction": "column" as const, height: "100%",
  background: "var(--cortex-bg-secondary)", color: "var(--cortex-text-primary)",
  "font-family": "var(--cortex-font-sans)", "font-size": "13px",
};

const tabBarStyle = {
  "border-bottom": "1px solid var(--cortex-border-default)",
  "flex-shrink": "0" as const,
};

const tabRowStyle = {
  display: "flex", "align-items": "center", "overflow-x": "auto" as const,
  gap: "0", padding: "0 12px",
};

const tabBtnStyle = (active: boolean) => ({
  position: "relative" as const, display: "flex", "align-items": "center", gap: "6px",
  padding: "12px 16px", background: "transparent", border: "none",
  color: active ? "var(--cortex-text-primary)" : "var(--cortex-text-inactive)",
  "font-size": "13px", "font-family": "var(--cortex-font-sans)", cursor: "pointer",
  "white-space": "nowrap" as const,
});

const tabIndicatorStyle = {
  position: "absolute" as const, bottom: "0", left: "16px", right: "16px",
  height: "2px", background: "var(--cortex-text-primary)",
  "border-radius": "1px 1px 0 0",
};

const contentStyle = { flex: "1", overflow: "auto" as const };

const avatarStyle = {
  width: "64px", height: "64px", "border-radius": "var(--cortex-radius-full)",
  background: "var(--cortex-bg-hover)",
  border: "2px solid var(--cortex-border-default)",
  display: "flex", "align-items": "center", "justify-content": "center", "flex-shrink": "0",
};

const signInBtnStyle = {
  display: "flex", "align-items": "center", "justify-content": "center", gap: "8px",
  padding: "10px 16px", background: "var(--cortex-bg-hover)",
  border: "1px solid var(--cortex-border-default)",
  "border-radius": "var(--cortex-radius-md)", color: "var(--cortex-text-primary)",
  "font-size": "13px", "font-family": "var(--cortex-font-sans)", cursor: "pointer",
};

const placeholderStyle = {
  display: "flex", "flex-direction": "column" as const, "align-items": "center",
  "justify-content": "center", gap: "12px", padding: "48px 24px",
  color: "var(--cortex-text-inactive)",
};

const providerRowStyle = {
  display: "flex", "align-items": "center", "justify-content": "space-between",
  padding: "12px 20px", "border-bottom": "1px solid var(--cortex-border-default)",
};

const statusDotStyle = (configured: boolean) => ({
  width: "8px", height: "8px", "border-radius": "var(--cortex-radius-full)",
  background: configured ? "var(--cortex-success)" : "var(--cortex-text-inactive)",
  "flex-shrink": "0",
});

const smallBtnStyle = {
  padding: "4px 10px", background: "transparent",
  border: "1px solid var(--cortex-border-default)",
  "border-radius": "var(--cortex-radius-sm)", color: "var(--cortex-text-primary)",
  "font-size": "12px", "font-family": "var(--cortex-font-sans)", cursor: "pointer",
};

const keyInputStyle = {
  width: "160px", padding: "4px 8px",
  background: "var(--cortex-bg-primary)",
  border: "1px solid var(--cortex-border-default)",
  "border-radius": "var(--cortex-radius-sm)", color: "var(--cortex-text-primary)",
  "font-size": "12px", "font-family": "var(--cortex-font-mono)", outline: "none",
};

export default CortexAccountPanel;