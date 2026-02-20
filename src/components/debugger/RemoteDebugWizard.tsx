/**
 * RemoteDebugWizard - Guided wizard for setting up remote debugging
 * 
 * A multi-step wizard that helps users configure:
 * 1. Connection type and settings (SSH, TCP, Docker, etc.)
 * 2. Debug adapter selection
 * 3. Path mappings between local and remote
 * 4. Review and save configuration
 */

import { createSignal, Show, For, JSX, createMemo, createEffect } from "solid-js";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";
import {
  type RemoteDebugConfig,
  type RemoteConnectionType,
  type RemoteConnectionConfig,
  type RemoteDebugAdapterType,
  type RemoteDebugAdapterConfig,
  type PathMapping,
  type RemoteDebugWizardStep,
  generateConfigId,
  generateMappingId,
  getDefaultConnectionConfig,
  getDefaultAdapterConfig,
  getConnectionTypeDisplayName,
  getAdapterTypeDisplayName,
  getConnectionTypeIcon,
  getAdapterTypeIcon,
  loadSavedConfigs,
  saveConfigs,
} from "@/types/remote-debug";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  overlay: {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    bottom: "0",
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "z-index": "9999",
  } as JSX.CSSProperties,

  dialog: {
    width: "600px",
    "max-width": "90vw",
    "max-height": "80vh",
    background: tokens.colors.surface.panel,
    "border-radius": tokens.radius.lg,
    "box-shadow": "0 8px 32px rgba(0, 0, 0, 0.4)",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
  } as JSX.CSSProperties,

  header: {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: tokens.spacing.lg,
    "border-bottom": `1px solid ${tokens.colors.border.divider}`,
  } as JSX.CSSProperties,

  headerTitle: {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    "font-size": "16px",
    "font-weight": "600",
    color: tokens.colors.text.primary,
  } as JSX.CSSProperties,

  closeButton: {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "28px",
    height: "28px",
    "border-radius": tokens.radius.sm,
    border: "none",
    background: "transparent",
    color: tokens.colors.text.muted,
    cursor: "pointer",
  } as JSX.CSSProperties,

  stepIndicator: {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    gap: tokens.spacing.md,
    padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
    "border-bottom": `1px solid ${tokens.colors.border.divider}`,
    background: tokens.colors.surface.card,
  } as JSX.CSSProperties,

  stepDot: {
    width: "8px",
    height: "8px",
    "border-radius": "var(--cortex-radius-full)",
    background: tokens.colors.border.default,
    transition: "all 0.2s ease",
  } as JSX.CSSProperties,

  stepDotActive: {
    width: "10px",
    height: "10px",
    background: tokens.colors.semantic.primary,
    "box-shadow": `0 0 0 3px rgba(99, 102, 241, 0.2)`,
  } as JSX.CSSProperties,

  stepDotCompleted: {
    background: tokens.colors.semantic.success,
  } as JSX.CSSProperties,

  stepLine: {
    width: "40px",
    height: "2px",
    background: tokens.colors.border.default,
    transition: "background 0.2s ease",
  } as JSX.CSSProperties,

  stepLineCompleted: {
    background: tokens.colors.semantic.success,
  } as JSX.CSSProperties,

  content: {
    flex: "1",
    padding: tokens.spacing.lg,
    "overflow-y": "auto",
  } as JSX.CSSProperties,

  footer: {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: tokens.spacing.lg,
    "border-top": `1px solid ${tokens.colors.border.divider}`,
  } as JSX.CSSProperties,

  button: {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    "border-radius": tokens.radius.md,
    border: "none",
    "font-size": "13px",
    "font-weight": "500",
    cursor: "pointer",
    transition: "all 0.15s ease",
  } as JSX.CSSProperties,

  buttonPrimary: {
    background: tokens.colors.semantic.primary,
    color: "white",
  } as JSX.CSSProperties,

  buttonSecondary: {
    background: tokens.colors.surface.card,
    color: tokens.colors.text.primary,
    border: `1px solid ${tokens.colors.border.default}`,
  } as JSX.CSSProperties,

  sectionTitle: {
    "font-size": "14px",
    "font-weight": "600",
    color: tokens.colors.text.primary,
    "margin-bottom": tokens.spacing.md,
  } as JSX.CSSProperties,

  optionGrid: {
    display: "grid",
    "grid-template-columns": "repeat(3, 1fr)",
    gap: tokens.spacing.md,
    "margin-bottom": tokens.spacing.lg,
  } as JSX.CSSProperties,

  optionCard: {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    "border-radius": tokens.radius.md,
    border: `2px solid ${tokens.colors.border.default}`,
    background: tokens.colors.surface.card,
    cursor: "pointer",
    transition: "all 0.15s ease",
  } as JSX.CSSProperties,

  optionCardSelected: {
    "border-color": tokens.colors.semantic.primary,
    background: "rgba(99, 102, 241, 0.1)",
  } as JSX.CSSProperties,

  optionIcon: {
    width: "24px",
    height: "24px",
    color: tokens.colors.text.muted,
  } as JSX.CSSProperties,

  optionLabel: {
    "font-size": "12px",
    "font-weight": "500",
    color: tokens.colors.text.primary,
    "text-align": "center",
  } as JSX.CSSProperties,

  formGroup: {
    display: "flex",
    "flex-direction": "column",
    gap: tokens.spacing.sm,
    "margin-bottom": tokens.spacing.md,
  } as JSX.CSSProperties,

  label: {
    "font-size": "12px",
    "font-weight": "500",
    color: tokens.colors.text.muted,
  } as JSX.CSSProperties,

  input: {
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    "border-radius": tokens.radius.md,
    border: `1px solid ${tokens.colors.border.default}`,
    background: tokens.colors.surface.input,
    color: tokens.colors.text.primary,
    "font-size": "13px",
    outline: "none",
    transition: "border-color 0.15s ease",
  } as JSX.CSSProperties,

  inputFocus: {
    "border-color": tokens.colors.semantic.primary,
  } as JSX.CSSProperties,

  select: {
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    "border-radius": tokens.radius.md,
    border: `1px solid ${tokens.colors.border.default}`,
    background: tokens.colors.surface.input,
    color: tokens.colors.text.primary,
    "font-size": "13px",
    cursor: "pointer",
  } as JSX.CSSProperties,

  row: {
    display: "flex",
    gap: tokens.spacing.md,
  } as JSX.CSSProperties,

  mappingItem: {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: tokens.spacing.sm,
    background: tokens.colors.surface.card,
    "border-radius": tokens.radius.md,
    "margin-bottom": tokens.spacing.sm,
  } as JSX.CSSProperties,

  mappingInput: {
    flex: "1",
    padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
    "border-radius": tokens.radius.sm,
    border: `1px solid ${tokens.colors.border.default}`,
    background: tokens.colors.surface.input,
    color: tokens.colors.text.primary,
    "font-size": "12px",
  } as JSX.CSSProperties,

  arrow: {
    color: tokens.colors.text.muted,
  } as JSX.CSSProperties,

  removeButton: {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "24px",
    height: "24px",
    "border-radius": tokens.radius.sm,
    border: "none",
    background: "transparent",
    color: tokens.colors.text.muted,
    cursor: "pointer",
  } as JSX.CSSProperties,

  addButton: {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    "border-radius": tokens.radius.md,
    border: `1px dashed ${tokens.colors.border.default}`,
    background: "transparent",
    color: tokens.colors.text.muted,
    cursor: "pointer",
    "font-size": "12px",
    width: "100%",
    "justify-content": "center",
  } as JSX.CSSProperties,

  reviewSection: {
    padding: tokens.spacing.md,
    background: tokens.colors.surface.card,
    "border-radius": tokens.radius.md,
    "margin-bottom": tokens.spacing.md,
  } as JSX.CSSProperties,

  reviewLabel: {
    "font-size": "11px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: tokens.colors.text.muted,
    "margin-bottom": tokens.spacing.xs,
  } as JSX.CSSProperties,

  reviewValue: {
    "font-size": "13px",
    color: tokens.colors.text.primary,
  } as JSX.CSSProperties,
};

// ============================================================================
// Connection Types
// ============================================================================

const CONNECTION_TYPES: RemoteConnectionType[] = [
  "ssh",
  "tcp",
  "docker",
  "wsl",
  "kubernetes",
];

const ADAPTER_TYPES: RemoteDebugAdapterType[] = [
  "node",
  "python",
  "go",
  "rust",
  "cpp",
  "java",
  "dotnet",
  "ruby",
  "php",
  "custom",
];

// ============================================================================
// Step Components
// ============================================================================

interface ConnectionStepProps {
  connectionType: RemoteConnectionType | null;
  connectionConfig: Partial<RemoteConnectionConfig>;
  onTypeChange: (type: RemoteConnectionType) => void;
  onConfigChange: (config: Partial<RemoteConnectionConfig>) => void;
}

function ConnectionStep(props: ConnectionStepProps) {
  const [focusedField, setFocusedField] = createSignal<string | null>(null);

  return (
    <div>
      <div style={styles.sectionTitle}>Select Connection Type</div>
      <div style={styles.optionGrid}>
        <For each={CONNECTION_TYPES}>
          {(type) => (
            <div
              style={{
                ...styles.optionCard,
                ...(props.connectionType === type ? styles.optionCardSelected : {}),
              }}
              onClick={() => props.onTypeChange(type)}
            >
              <Icon name={getConnectionTypeIcon(type)} style={styles.optionIcon} />
              <span style={styles.optionLabel}>{getConnectionTypeDisplayName(type)}</span>
            </div>
          )}
        </For>
      </div>

      <Show when={props.connectionType === "ssh"}>
        <div style={styles.sectionTitle}>SSH Connection Settings</div>
        <div style={styles.row}>
          <div style={{ ...styles.formGroup, flex: 2 }}>
            <label style={styles.label}>Host</label>
            <input
              type="text"
              placeholder="hostname or IP"
              value={(props.connectionConfig as any)?.host || ""}
              onInput={(e) => props.onConfigChange({ ...props.connectionConfig, host: e.currentTarget.value })}
              onFocus={() => setFocusedField("host")}
              onBlur={() => setFocusedField(null)}
              style={{
                ...styles.input,
                ...(focusedField() === "host" ? styles.inputFocus : {}),
              }}
            />
          </div>
          <div style={{ ...styles.formGroup, flex: 1 }}>
            <label style={styles.label}>Port</label>
            <input
              type="number"
              placeholder="22"
              value={(props.connectionConfig as any)?.port || 22}
              onInput={(e) => props.onConfigChange({ ...props.connectionConfig, port: parseInt(e.currentTarget.value) || 22 })}
              onFocus={() => setFocusedField("port")}
              onBlur={() => setFocusedField(null)}
              style={{
                ...styles.input,
                ...(focusedField() === "port" ? styles.inputFocus : {}),
              }}
            />
          </div>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Username</label>
          <input
            type="text"
            placeholder="username"
            value={(props.connectionConfig as any)?.username || ""}
            onInput={(e) => props.onConfigChange({ ...props.connectionConfig, username: e.currentTarget.value })}
            onFocus={() => setFocusedField("username")}
            onBlur={() => setFocusedField(null)}
            style={{
              ...styles.input,
              ...(focusedField() === "username" ? styles.inputFocus : {}),
            }}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Authentication Method</label>
          <select
            value={(props.connectionConfig as any)?.authMethod || "key"}
            onChange={(e) => props.onConfigChange({ ...props.connectionConfig, authMethod: e.currentTarget.value as any })}
            style={styles.select}
          >
            <option value="key">SSH Key</option>
            <option value="password">Password</option>
            <option value="agent">SSH Agent</option>
          </select>
        </div>
        <div style={styles.row}>
          <div style={{ ...styles.formGroup, flex: 1 }}>
            <label style={styles.label}>Remote Debug Port</label>
            <input
              type="number"
              placeholder="9229"
              value={(props.connectionConfig as any)?.remoteDebugPort || 9229}
              onInput={(e) => props.onConfigChange({ ...props.connectionConfig, remoteDebugPort: parseInt(e.currentTarget.value) || 9229 })}
              style={styles.input}
            />
          </div>
          <div style={{ ...styles.formGroup, flex: 1 }}>
            <label style={styles.label}>Local Port (0 = auto)</label>
            <input
              type="number"
              placeholder="0"
              value={(props.connectionConfig as any)?.localPort || 0}
              onInput={(e) => props.onConfigChange({ ...props.connectionConfig, localPort: parseInt(e.currentTarget.value) || 0 })}
              style={styles.input}
            />
          </div>
        </div>
      </Show>

      <Show when={props.connectionType === "tcp"}>
        <div style={styles.sectionTitle}>TCP Connection Settings</div>
        <div style={styles.row}>
          <div style={{ ...styles.formGroup, flex: 2 }}>
            <label style={styles.label}>Host</label>
            <input
              type="text"
              placeholder="localhost"
              value={(props.connectionConfig as any)?.host || "localhost"}
              onInput={(e) => props.onConfigChange({ ...props.connectionConfig, host: e.currentTarget.value })}
              style={styles.input}
            />
          </div>
          <div style={{ ...styles.formGroup, flex: 1 }}>
            <label style={styles.label}>Port</label>
            <input
              type="number"
              placeholder="9229"
              value={(props.connectionConfig as any)?.port || 9229}
              onInput={(e) => props.onConfigChange({ ...props.connectionConfig, port: parseInt(e.currentTarget.value) || 9229 })}
              style={styles.input}
            />
          </div>
        </div>
      </Show>

      <Show when={props.connectionType === "docker"}>
        <div style={styles.sectionTitle}>Docker Container Settings</div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Container ID or Name</label>
          <input
            type="text"
            placeholder="container_name or abc123def456"
            value={(props.connectionConfig as any)?.containerId || ""}
            onInput={(e) => props.onConfigChange({ ...props.connectionConfig, containerId: e.currentTarget.value })}
            style={styles.input}
          />
        </div>
        <div style={styles.row}>
          <div style={{ ...styles.formGroup, flex: 1 }}>
            <label style={styles.label}>Container Port</label>
            <input
              type="number"
              placeholder="9229"
              value={(props.connectionConfig as any)?.containerPort || 9229}
              onInput={(e) => props.onConfigChange({ ...props.connectionConfig, containerPort: parseInt(e.currentTarget.value) || 9229 })}
              style={styles.input}
            />
          </div>
          <div style={{ ...styles.formGroup, flex: 1 }}>
            <label style={styles.label}>Host Port (optional)</label>
            <input
              type="number"
              placeholder="auto"
              value={(props.connectionConfig as any)?.hostPort || ""}
              onInput={(e) => props.onConfigChange({ ...props.connectionConfig, hostPort: parseInt(e.currentTarget.value) || undefined })}
              style={styles.input}
            />
          </div>
        </div>
      </Show>
    </div>
  );
}

interface AdapterStepProps {
  adapterType: RemoteDebugAdapterType | null;
  adapterConfig: Partial<RemoteDebugAdapterConfig>;
  onTypeChange: (type: RemoteDebugAdapterType) => void;
  onConfigChange: (config: Partial<RemoteDebugAdapterConfig>) => void;
}

function AdapterStep(props: AdapterStepProps) {
  return (
    <div>
      <div style={styles.sectionTitle}>Select Debug Adapter</div>
      <div style={{ ...styles.optionGrid, "grid-template-columns": "repeat(5, 1fr)" }}>
        <For each={ADAPTER_TYPES}>
          {(type) => (
            <div
              style={{
                ...styles.optionCard,
                ...(props.adapterType === type ? styles.optionCardSelected : {}),
              }}
              onClick={() => props.onTypeChange(type)}
            >
              <Icon name={getAdapterTypeIcon(type)} style={styles.optionIcon} />
              <span style={styles.optionLabel}>{getAdapterTypeDisplayName(type)}</span>
            </div>
          )}
        </For>
      </div>

      <Show when={props.adapterType === "custom"}>
        <div style={styles.sectionTitle}>Custom Adapter Settings</div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Adapter Executable Path</label>
          <input
            type="text"
            placeholder="/path/to/debug-adapter"
            value={props.adapterConfig?.adapterPath || ""}
            onInput={(e) => props.onConfigChange({ ...props.adapterConfig, adapterPath: e.currentTarget.value })}
            style={styles.input}
          />
        </div>
      </Show>
    </div>
  );
}

interface PathMappingsStepProps {
  mappings: PathMapping[];
  onMappingsChange: (mappings: PathMapping[]) => void;
}

function PathMappingsStep(props: PathMappingsStepProps) {
  const addMapping = () => {
    props.onMappingsChange([
      ...props.mappings,
      {
        id: generateMappingId(),
        localPath: "",
        remotePath: "",
        enabled: true,
      },
    ]);
  };

  const updateMapping = (id: string, updates: Partial<PathMapping>) => {
    props.onMappingsChange(
      props.mappings.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  const removeMapping = (id: string) => {
    props.onMappingsChange(props.mappings.filter((m) => m.id !== id));
  };

  return (
    <div>
      <div style={styles.sectionTitle}>Path Mappings</div>
      <p style={{ "font-size": "12px", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.md }}>
        Map local paths to remote paths so the debugger can locate source files.
      </p>

      <For each={props.mappings}>
        {(mapping) => (
          <div style={styles.mappingItem}>
            <input
              type="text"
              placeholder="Local path (e.g., /home/user/project)"
              value={mapping.localPath}
              onInput={(e) => updateMapping(mapping.id, { localPath: e.currentTarget.value })}
              style={styles.mappingInput}
            />
            <Icon name="arrow-right" style={styles.arrow} />
            <input
              type="text"
              placeholder="Remote path (e.g., /app)"
              value={mapping.remotePath}
              onInput={(e) => updateMapping(mapping.id, { remotePath: e.currentTarget.value })}
              style={styles.mappingInput}
            />
            <button
              style={styles.removeButton}
              onClick={() => removeMapping(mapping.id)}
              title="Remove mapping"
            >
              <Icon name="trash" style={{ width: "14px", height: "14px" }} />
            </button>
          </div>
        )}
      </For>

      <button style={styles.addButton} onClick={addMapping}>
        <Icon name="plus" style={{ width: "14px", height: "14px" }} />
        Add Path Mapping
      </button>
    </div>
  );
}

interface ReviewStepProps {
  config: Partial<RemoteDebugConfig>;
  configName: string;
  onNameChange: (name: string) => void;
}

function ReviewStep(props: ReviewStepProps) {
  const connectionType = () => props.config.connection?.type;
  const adapterType = () => props.config.adapter?.type;

  return (
    <div>
      <div style={styles.sectionTitle}>Review Configuration</div>
      
      <div style={styles.formGroup}>
        <label style={styles.label}>Configuration Name</label>
        <input
          type="text"
          placeholder="My Remote Debug Config"
          value={props.configName}
          onInput={(e) => props.onNameChange(e.currentTarget.value)}
          style={styles.input}
        />
      </div>

      <div style={styles.reviewSection}>
        <div style={styles.reviewLabel}>Connection</div>
        <div style={styles.reviewValue}>
          {connectionType() ? getConnectionTypeDisplayName(connectionType()!) : "Not configured"}
          <Show when={props.config.connection && "host" in props.config.connection}>
            {" - "}{(props.config.connection as any).host}:{(props.config.connection as any).port || (props.config.connection as any).remoteDebugPort}
          </Show>
        </div>
      </div>

      <div style={styles.reviewSection}>
        <div style={styles.reviewLabel}>Debug Adapter</div>
        <div style={styles.reviewValue}>
          {adapterType() ? getAdapterTypeDisplayName(adapterType()!) : "Not configured"}
        </div>
      </div>

      <div style={styles.reviewSection}>
        <div style={styles.reviewLabel}>Path Mappings</div>
        <div style={styles.reviewValue}>
          {props.config.pathMappings?.length || 0} mapping(s) configured
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Wizard Component
// ============================================================================

export interface RemoteDebugWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: RemoteDebugConfig) => void;
  /** Optional existing config to edit */
  editConfig?: RemoteDebugConfig;
}

const STEPS: RemoteDebugWizardStep[] = ["connection", "adapter", "pathMappings", "review"];

export function RemoteDebugWizard(props: RemoteDebugWizardProps) {
  const [currentStep, setCurrentStep] = createSignal<RemoteDebugWizardStep>("connection");
  const [connectionType, setConnectionType] = createSignal<RemoteConnectionType | null>(null);
  const [connectionConfig, setConnectionConfig] = createSignal<Partial<RemoteConnectionConfig>>({});
  const [adapterType, setAdapterType] = createSignal<RemoteDebugAdapterType | null>(null);
  const [adapterConfig, setAdapterConfig] = createSignal<Partial<RemoteDebugAdapterConfig>>({});
  const [pathMappings, setPathMappings] = createSignal<PathMapping[]>([]);
  const [configName, setConfigName] = createSignal("");

  // Initialize from edit config if provided
  createEffect(() => {
    if (props.editConfig) {
      setConnectionType(props.editConfig.connection.type);
      setConnectionConfig(props.editConfig.connection);
      setAdapterType(props.editConfig.adapter.type);
      setAdapterConfig(props.editConfig.adapter);
      setPathMappings(props.editConfig.pathMappings);
      setConfigName(props.editConfig.name);
    }
  });

  const currentStepIndex = createMemo(() => STEPS.indexOf(currentStep()));

  const handleConnectionTypeChange = (type: RemoteConnectionType) => {
    setConnectionType(type);
    setConnectionConfig(getDefaultConnectionConfig(type));
  };

  const handleAdapterTypeChange = (type: RemoteDebugAdapterType) => {
    setAdapterType(type);
    setAdapterConfig(getDefaultAdapterConfig(type));
  };

  const canProceed = createMemo(() => {
    switch (currentStep()) {
      case "connection":
        return connectionType() !== null;
      case "adapter":
        return adapterType() !== null;
      case "pathMappings":
        return true; // Path mappings are optional
      case "review":
        return configName().trim().length > 0;
      default:
        return false;
    }
  });

  const handleNext = () => {
    const idx = currentStepIndex();
    if (idx < STEPS.length - 1) {
      setCurrentStep(STEPS[idx + 1]);
    }
  };

  const handleBack = () => {
    const idx = currentStepIndex();
    if (idx > 0) {
      setCurrentStep(STEPS[idx - 1]);
    }
  };

  const handleSave = () => {
    if (!connectionType() || !adapterType()) return;

    const config: RemoteDebugConfig = {
      id: props.editConfig?.id || generateConfigId(),
      name: configName(),
      connection: { ...connectionConfig(), type: connectionType()! } as RemoteConnectionConfig,
      adapter: { ...adapterConfig(), type: adapterType()! } as RemoteDebugAdapterConfig,
      pathMappings: pathMappings(),
      request: "attach",
      createdAt: props.editConfig?.createdAt || Date.now(),
      lastUsedAt: Date.now(),
    };

    // Save to storage
    const existing = loadSavedConfigs();
    const updated = props.editConfig
      ? existing.map((c) => (c.id === config.id ? config : c))
      : [...existing, config];
    saveConfigs(updated);

    props.onSave(config);
    props.onClose();
  };

  if (!props.isOpen) return null;

  return (
    <div style={styles.overlay} onClick={props.onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <Icon name="globe" style={{ width: "18px", height: "18px" }} />
            <span>{props.editConfig ? "Edit Remote Debug" : "New Remote Debug Configuration"}</span>
          </div>
          <button style={styles.closeButton} onClick={props.onClose}>
            <Icon name="xmark" style={{ width: "16px", height: "16px" }} />
          </button>
        </div>

        {/* Step Indicator */}
        <div style={styles.stepIndicator}>
          <For each={STEPS}>
            {(step, index) => (
              <>
                <Show when={index() > 0}>
                  <div
                    style={{
                      ...styles.stepLine,
                      ...(index() <= currentStepIndex() ? styles.stepLineCompleted : {}),
                    }}
                  />
                </Show>
                <div
                  style={{
                    ...styles.stepDot,
                    ...(index() === currentStepIndex() ? styles.stepDotActive : {}),
                    ...(index() < currentStepIndex() ? styles.stepDotCompleted : {}),
                  }}
                  title={step}
                />
              </>
            )}
          </For>
        </div>

        {/* Content */}
        <div style={styles.content}>
          <Show when={currentStep() === "connection"}>
            <ConnectionStep
              connectionType={connectionType()}
              connectionConfig={connectionConfig()}
              onTypeChange={handleConnectionTypeChange}
              onConfigChange={setConnectionConfig}
            />
          </Show>
          <Show when={currentStep() === "adapter"}>
            <AdapterStep
              adapterType={adapterType()}
              adapterConfig={adapterConfig()}
              onTypeChange={handleAdapterTypeChange}
              onConfigChange={setAdapterConfig}
            />
          </Show>
          <Show when={currentStep() === "pathMappings"}>
            <PathMappingsStep
              mappings={pathMappings()}
              onMappingsChange={setPathMappings}
            />
          </Show>
          <Show when={currentStep() === "review"}>
            <ReviewStep
              config={{
                connection: { ...connectionConfig(), type: connectionType()! } as RemoteConnectionConfig,
                adapter: { ...adapterConfig(), type: adapterType()! } as RemoteDebugAdapterConfig,
                pathMappings: pathMappings(),
              }}
              configName={configName()}
              onNameChange={setConfigName}
            />
          </Show>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <div>
            <Show when={currentStepIndex() > 0}>
              <button
                style={{ ...styles.button, ...styles.buttonSecondary }}
                onClick={handleBack}
              >
                <Icon name="chevron-left" style={{ width: "14px", height: "14px" }} />
                Back
              </button>
            </Show>
          </div>
          <div style={{ display: "flex", gap: tokens.spacing.sm }}>
            <button
              style={{ ...styles.button, ...styles.buttonSecondary }}
              onClick={props.onClose}
            >
              Cancel
            </button>
            <Show
              when={currentStep() !== "review"}
              fallback={
                <button
                  style={{
                    ...styles.button,
                    ...styles.buttonPrimary,
                    opacity: canProceed() ? "1" : "0.5",
                    cursor: canProceed() ? "pointer" : "not-allowed",
                  }}
                  onClick={handleSave}
                  disabled={!canProceed()}
                >
                  <Icon name="check" style={{ width: "14px", height: "14px" }} />
                  Save Configuration
                </button>
              }
            >
              <button
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  opacity: canProceed() ? "1" : "0.5",
                  cursor: canProceed() ? "pointer" : "not-allowed",
                }}
                onClick={handleNext}
                disabled={!canProceed()}
              >
                Next
                <Icon name="chevron-right" style={{ width: "14px", height: "14px" }} />
              </button>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RemoteDebugWizard;

