import { createSignal, For, Show, createMemo, onMount } from "solid-js";
import { Icon } from "../ui/Icon";
import { Button, IconButton, Input, Textarea } from "@/components/ui";
import { useRemote, DevContainerConfig as DevContainerConfigType, DevContainerFeature, DevContainerTemplate } from "@/context/RemoteContext";

interface DevContainerConfigProps {
  configPath?: string;
  workspacePath?: string;
  onSave?: (config: DevContainerConfigType) => void;
  onClose?: () => void;
}

interface FeatureSelectorProps {
  features: DevContainerFeature[];
  selectedFeatures: Record<string, Record<string, string | number | boolean>>;
  onFeatureToggle: (featureId: string, enabled: boolean) => void;
  onFeatureOptionChange: (featureId: string, optionKey: string, value: string | number | boolean) => void;
  isLoading: boolean;
}

function FeatureSelector(props: FeatureSelectorProps) {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [expandedFeatures, setExpandedFeatures] = createSignal<Set<string>>(new Set());

  const filteredFeatures = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return props.features;
    return props.features.filter(
      (f) =>
        f.id.toLowerCase().includes(query) ||
        f.name.toLowerCase().includes(query) ||
        f.description?.toLowerCase().includes(query)
    );
  });

  const toggleExpand = (featureId: string) => {
    setExpandedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(featureId)) {
        next.delete(featureId);
      } else {
        next.add(featureId);
      }
      return next;
    });
  };

  const isSelected = (featureId: string) => featureId in props.selectedFeatures;
  const isExpanded = (featureId: string) => expandedFeatures().has(featureId);

  return (
    <div class="space-y-3">
      <Input
        type="text"
        value={searchQuery()}
        onInput={(e) => setSearchQuery(e.currentTarget.value)}
        placeholder="Search features..."
        icon={<Icon name="magnifying-glass" class="w-4 h-4" />}
      />

      <Show
        when={!props.isLoading}
        fallback={
          <div class="flex items-center justify-center py-8">
            <Icon name="rotate" class="w-5 h-5 animate-spin" style={{ color: "var(--text-weak)" }} />
          </div>
        }
      >
        <div class="space-y-2 max-h-[300px] overflow-y-auto">
          <For each={filteredFeatures()}>
            {(feature) => (
              <div
                class="rounded-lg transition-all"
                classList={{
                  "ring-2 ring-[var(--accent)]": isSelected(feature.id),
                }}
                style={{
                  "background-color": "var(--surface-raised)",
                  border: "1px solid var(--border-weak)",
                }}
              >
                <div class="flex items-start gap-3 p-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => props.onFeatureToggle(feature.id, !isSelected(feature.id))}
                    style={{
                      "margin-top": "2px",
                      width: "20px",
                      height: "20px",
                      padding: "0",
                      "min-width": "20px",
                      "border-radius": "var(--cortex-radius-sm)",
                      "flex-shrink": "0",
                      "background-color": isSelected(feature.id) ? "var(--accent)" : "transparent",
                      border: `1px solid ${isSelected(feature.id) ? "var(--accent)" : "var(--border-base)"}`,
                    }}
                  >
                    <Show when={isSelected(feature.id)}>
                      <Icon name="check" class="w-3 h-3" style={{ color: "white" }} />
                    </Show>
                  </Button>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                        {feature.name}
                      </span>
                      <Show when={feature.version}>
                        <span
                          class="px-1.5 py-0.5 text-xs rounded"
                          style={{
                            "background-color": "var(--surface-overlay)",
                            color: "var(--text-weak)",
                          }}
                        >
                          v{feature.version}
                        </span>
                      </Show>
                    </div>
                    <p class="text-xs mt-0.5" style={{ color: "var(--text-weak)" }}>
                      {feature.description || feature.id}
                    </p>

                    <Show when={isSelected(feature.id) && feature.options && Object.keys(feature.options).length > 0}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(feature.id)}
                        style={{ 
                          color: "var(--accent)", 
                          padding: "0",
                          height: "auto",
                          "margin-top": "8px",
                          gap: "4px",
                          "font-size": "12px",
                        }}
                      >
                        {isExpanded(feature.id) ? (
                          <Icon name="chevron-down" class="w-3 h-3" />
                        ) : (
                          <Icon name="chevron-right" class="w-3 h-3" />
                        )}
                        Options
                      </Button>

                      <Show when={isExpanded(feature.id)}>
                        <div class="mt-2 space-y-2 pl-4 border-l-2" style={{ "border-color": "var(--border-weak)" }}>
                          <For each={Object.entries(feature.options || {})}>
                            {([key, option]) => (
                              <div class="space-y-1">
                                <label class="block text-xs font-medium" style={{ color: "var(--text-weak)" }}>
                                  {key}
                                  <Show when={option.description}>
                                    <span class="font-normal ml-1" style={{ color: "var(--text-weaker)" }}>
                                      - {option.description}
                                    </span>
                                  </Show>
                                </label>
                                <Show
                                  when={option.type === "boolean"}
                                  fallback={
                                    <Show
                                      when={option.enum}
                                      fallback={
                                        <Input
                                          type={option.type === "number" ? "number" : "text"}
                                          value={String(props.selectedFeatures[feature.id]?.[key] ?? option.default ?? "")}
                                          onInput={(e) =>
                                            props.onFeatureOptionChange(
                                              feature.id,
                                              key,
                                              option.type === "number"
                                                ? parseFloat(e.currentTarget.value)
                                                : e.currentTarget.value
                                            )
                                          }
                                          placeholder={String(option.default ?? "")}
                                          style={{ "font-size": "12px" }}
                                        />
                                      }
                                    >
                                      <select
                                        value={String(props.selectedFeatures[feature.id]?.[key] ?? option.default ?? "")}
                                        onChange={(e) =>
                                          props.onFeatureOptionChange(feature.id, key, e.currentTarget.value)
                                        }
                                        class="w-full px-2 py-1 text-xs rounded"
                                        style={{
                                          "background-color": "var(--surface-base)",
                                          border: "1px solid var(--border-base)",
                                          color: "var(--text-base)",
                                        }}
                                      >
                                        <For each={option.enum}>
                                          {(value) => <option value={value}>{value}</option>}
                                        </For>
                                      </select>
                                    </Show>
                                  }
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      props.onFeatureOptionChange(
                                        feature.id,
                                        key,
                                        !(props.selectedFeatures[feature.id]?.[key] ?? option.default ?? false)
                                      )
                                    }
                                    style={{ padding: "0", height: "auto", gap: "8px" }}
                                  >
                                    <div
                                      class="w-4 h-4 rounded border flex items-center justify-center"
                                      style={{
                                        "background-color":
                                          (props.selectedFeatures[feature.id]?.[key] ?? option.default)
                                            ? "var(--accent)"
                                            : "transparent",
                                        "border-color":
                                          (props.selectedFeatures[feature.id]?.[key] ?? option.default)
                                            ? "var(--accent)"
                                            : "var(--border-base)",
                                      }}
                                    >
                                      <Show when={props.selectedFeatures[feature.id]?.[key] ?? option.default}>
                                        <Icon name="check" class="w-3 h-3" style={{ color: "white" }} />
                                      </Show>
                                    </div>
                                    <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                                      {String(option.default ?? "false")}
                                    </span>
                                  </Button>
                                </Show>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </Show>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

interface TemplateSelectorProps {
  templates: DevContainerTemplate[];
  selectedTemplate: string | null;
  onSelect: (templateId: string | null) => void;
  isLoading: boolean;
}

function TemplateSelector(props: TemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = createSignal("");

  const filteredTemplates = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return props.templates;
    return props.templates.filter(
      (t) =>
        t.id.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
    );
  });

  const templateCategories = createMemo(() => {
    const categories: Record<string, DevContainerTemplate[]> = {};
    filteredTemplates().forEach((t) => {
      const category = t.category || "Other";
      if (!categories[category]) categories[category] = [];
      categories[category].push(t);
    });
    return categories;
  });

  return (
    <div class="space-y-3">
      <Input
        type="text"
        value={searchQuery()}
        onInput={(e) => setSearchQuery(e.currentTarget.value)}
        placeholder="Search templates..."
        icon={<Icon name="magnifying-glass" class="w-4 h-4" />}
      />

      <Show
        when={!props.isLoading}
        fallback={
          <div class="flex items-center justify-center py-8">
            <Icon name="rotate" class="w-5 h-5 animate-spin" style={{ color: "var(--text-weak)" }} />
          </div>
        }
      >
        <div class="space-y-4 max-h-[400px] overflow-y-auto">
          <For each={Object.entries(templateCategories())}>
            {([category, templates]) => (
              <div class="space-y-2">
                <h4 class="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-weak)" }}>
                  {category}
                </h4>
                <div class="grid grid-cols-2 gap-2">
                  <For each={templates}>
                    {(template) => (
                      <Button
                        variant="ghost"
                        onClick={() => props.onSelect(props.selectedTemplate === template.id ? null : template.id)}
                        class="flex items-start gap-2 p-3 rounded-lg text-left transition-all"
                        classList={{
                          "ring-2 ring-[var(--accent)]": props.selectedTemplate === template.id,
                        }}
                        style={{
                          "background-color": "var(--surface-raised)",
                          border: "1px solid var(--border-weak)",
                          height: "auto",
                          padding: "12px",
                          "justify-content": "flex-start",
                          "align-items": "flex-start",
                        }}
                      >
                        <div
                          class="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                          style={{ "background-color": "var(--surface-overlay)" }}
                        >
                          <Show
                            when={template.icon}
                            fallback={<Icon name="layer-group" class="w-4 h-4" style={{ color: "var(--accent)" }} />}
                          >
                            <span class="text-base">{template.icon}</span>
                          </Show>
                        </div>
                        <div class="min-w-0">
                          <div class="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>
                            {template.name}
                          </div>
                          <div class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
                            {template.description || template.id}
                          </div>
                        </div>
                      </Button>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

type ConfigSection = "general" | "image" | "features" | "ports" | "mounts" | "commands" | "extensions";

export function DevContainerConfig(props: DevContainerConfigProps) {
  const remote = useRemote();
  const [activeSection, setActiveSection] = createSignal<ConfigSection>("general");
  const [isSaving, setIsSaving] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(true);
  const [hasChanges, setHasChanges] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const [configName, setConfigName] = createSignal("Dev Container");
  const [configImage, setConfigImage] = createSignal("");
  const [dockerfilePath, setDockerfilePath] = createSignal("");
  const [buildContext, setBuildContext] = createSignal(".");
  const [useDockerfile, setUseDockerfile] = createSignal(false);

  const [selectedFeatures, setSelectedFeatures] = createSignal<Record<string, Record<string, string | number | boolean>>>({});
  const [forwardPorts, setForwardPorts] = createSignal<number[]>([]);
  const [newPort, setNewPort] = createSignal("");
  const [mounts, setMounts] = createSignal<Array<{ source: string; target: string; type: string }>>([]);

  const [postCreateCommand, setPostCreateCommand] = createSignal("");
  const [postStartCommand, setPostStartCommand] = createSignal("");
  const [postAttachCommand, setPostAttachCommand] = createSignal("");

  const [extensions, setExtensions] = createSignal<string[]>([]);
  const [newExtension, setNewExtension] = createSignal("");

  const [remoteUser, setRemoteUser] = createSignal("vscode");
  const [workspaceFolder, setWorkspaceFolder] = createSignal("/workspaces/${localWorkspaceFolderBasename}");
  const [shutdownAction, setShutdownAction] = createSignal("stopContainer");

  const availableFeatures = () => remote.state.availableDevContainerFeatures;
  const availableTemplates = () => remote.state.availableDevContainerTemplates;

  const [showTemplateSelector, setShowTemplateSelector] = createSignal(false);
  const [selectedTemplate, setSelectedTemplate] = createSignal<string | null>(null);

  onMount(async () => {
    setIsLoading(true);
    try {
      await remote.loadDevContainerFeatures();
      await remote.loadDevContainerTemplates();

      if (props.configPath) {
        const config = await remote.loadDevContainerConfig(props.configPath);
        applyConfig(config);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  });

  const applyConfig = (config: DevContainerConfigType) => {
    setConfigName(config.name || "Dev Container");
    setConfigImage(config.image || "");
    setDockerfilePath(config.build?.dockerfile || "");
    setBuildContext(config.build?.context || ".");
    setUseDockerfile(!!config.build?.dockerfile);
    setForwardPorts(config.forwardPorts || []);
    setPostCreateCommand(config.postCreateCommand || "");
    setPostStartCommand(config.postStartCommand || "");
    setPostAttachCommand(config.postAttachCommand || "");
    setExtensions(config.customizations?.vscode?.extensions || []);
    setRemoteUser(config.remoteUser || "vscode");
    setWorkspaceFolder(config.workspaceFolder || "/workspaces/${localWorkspaceFolderBasename}");
    setShutdownAction(config.shutdownAction || "stopContainer");

    if (config.features) {
      const features: Record<string, Record<string, string | number | boolean>> = {};
      Object.entries(config.features).forEach(([id, options]) => {
        features[id] = typeof options === "object" ? options : {};
      });
      setSelectedFeatures(features);
    }

    if (config.mounts) {
      const mountsList = config.mounts.map((m) => {
        if (typeof m === "string") {
          const parts = m.split(",");
          const mount: { source: string; target: string; type: string } = { source: "", target: "", type: "bind" };
          parts.forEach((part) => {
            const [key, value] = part.split("=");
            if (key === "source") mount.source = value;
            if (key === "target") mount.target = value;
            if (key === "type") mount.type = value;
          });
          return mount;
        }
        return { source: m.source || "", target: m.target || "", type: m.type || "bind" };
      });
      setMounts(mountsList);
    }

    setHasChanges(false);
  };

  const markChanged = () => setHasChanges(true);

  const buildConfig = (): DevContainerConfigType => {
    const config: DevContainerConfigType = {
      name: configName(),
      path: props.configPath || ".devcontainer/devcontainer.json",
    };

    if (useDockerfile()) {
      config.build = {
        dockerfile: dockerfilePath(),
        context: buildContext(),
      };
    } else if (configImage()) {
      config.image = configImage();
    }

    if (Object.keys(selectedFeatures()).length > 0) {
      config.features = selectedFeatures();
    }

    if (forwardPorts().length > 0) {
      config.forwardPorts = forwardPorts();
    }

    if (mounts().length > 0) {
      config.mounts = mounts().map((m) => ({
        source: m.source,
        target: m.target,
        type: m.type as "bind" | "volume",
      }));
    }

    if (postCreateCommand()) config.postCreateCommand = postCreateCommand();
    if (postStartCommand()) config.postStartCommand = postStartCommand();
    if (postAttachCommand()) config.postAttachCommand = postAttachCommand();

    if (extensions().length > 0) {
      config.customizations = {
        vscode: { extensions: extensions() },
      };
    }

    config.remoteUser = remoteUser();
    config.workspaceFolder = workspaceFolder();
    config.shutdownAction = shutdownAction() as "none" | "stopContainer" | "stopCompose";

    return config;
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const config = buildConfig();
      await remote.saveDevContainerConfig(config, props.workspacePath || ".");
      setHasChanges(false);
      props.onSave?.(config);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleFeatureToggle = (featureId: string, enabled: boolean) => {
    setSelectedFeatures((prev) => {
      const next = { ...prev };
      if (enabled) {
        next[featureId] = {};
      } else {
        delete next[featureId];
      }
      return next;
    });
    markChanged();
  };

  const handleFeatureOptionChange = (featureId: string, optionKey: string, value: string | number | boolean) => {
    setSelectedFeatures((prev) => ({
      ...prev,
      [featureId]: {
        ...prev[featureId],
        [optionKey]: value,
      },
    }));
    markChanged();
  };

  const handleAddPort = () => {
    const port = parseInt(newPort(), 10);
    if (!isNaN(port) && port > 0 && port <= 65535 && !forwardPorts().includes(port)) {
      setForwardPorts([...forwardPorts(), port]);
      setNewPort("");
      markChanged();
    }
  };

  const handleRemovePort = (port: number) => {
    setForwardPorts(forwardPorts().filter((p) => p !== port));
    markChanged();
  };

  const handleAddMount = () => {
    setMounts([...mounts(), { source: "", target: "", type: "bind" }]);
    markChanged();
  };

  const handleUpdateMount = (index: number, field: string, value: string) => {
    setMounts(mounts().map((m, i) => (i === index ? { ...m, [field]: value } : m)));
    markChanged();
  };

  const handleRemoveMount = (index: number) => {
    setMounts(mounts().filter((_, i) => i !== index));
    markChanged();
  };

  const handleAddExtension = () => {
    const ext = newExtension().trim();
    if (ext && !extensions().includes(ext)) {
      setExtensions([...extensions(), ext]);
      setNewExtension("");
      markChanged();
    }
  };

  const handleRemoveExtension = (ext: string) => {
    setExtensions(extensions().filter((e) => e !== ext));
    markChanged();
  };

  const handleTemplateSelect = async (templateId: string | null) => {
    setSelectedTemplate(templateId);
    if (templateId) {
      const template = availableTemplates().find((t) => t.id === templateId);
      if (template?.config) {
        applyConfig(template.config);
        setHasChanges(true);
      }
    }
    setShowTemplateSelector(false);
  };

  const sections: Array<{ id: ConfigSection; label: string; iconName: string }> = [
    { id: "general", label: "General", iconName: "gear" },
    { id: "image", label: "Image", iconName: "box" },
    { id: "features", label: "Features", iconName: "box" },
    { id: "ports", label: "Ports", iconName: "globe" },
    { id: "mounts", label: "Mounts", iconName: "folder" },
    { id: "commands", label: "Commands", iconName: "terminal" },
    { id: "extensions", label: "Extensions", iconName: "code" },
  ];

  return (
    <div class="flex flex-col h-full">
      <div
        class="flex items-center justify-between px-4 py-3 border-b"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <div class="flex items-center gap-2">
          <Icon name="gear" class="w-4 h-4" style={{ color: "var(--accent)" }} />
          <h2 class="text-sm font-semibold" style={{ color: "var(--text-base)" }}>
            Dev Container Configuration
          </h2>
          <Show when={hasChanges()}>
            <span class="px-1.5 py-0.5 text-xs rounded" style={{ "background-color": "var(--warning)", color: "white" }}>
              Unsaved
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowTemplateSelector(true)}
            icon={<Icon name="layer-group" class="w-3.5 h-3.5" />}
          >
            Templates
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={isSaving() || !hasChanges()}
            loading={isSaving()}
            icon={!isSaving() ? <Icon name="floppy-disk" class="w-3.5 h-3.5" /> : undefined}
          >
            {isSaving() ? "Saving..." : "Save"}
          </Button>
          <Show when={props.onClose}>
            <IconButton
              size="sm"
              onClick={props.onClose}
              tooltip="Close"
            >
              <Icon name="xmark" class="w-4 h-4" />
            </IconButton>
          </Show>
        </div>
      </div>

      <div class="flex flex-1 min-h-0">
        <nav
          class="w-48 border-r py-2 flex-shrink-0"
          style={{ "border-color": "var(--border-weak)", "background-color": "var(--surface-base)" }}
        >
          <For each={sections}>
            {(section) => (
              <Button
                variant="ghost"
                onClick={() => setActiveSection(section.id)}
                style={{
                  width: "100%",
                  "justify-content": "flex-start",
                  "border-radius": "0",
                  padding: "8px 16px",
                  gap: "8px",
                  "font-size": "14px",
                  color: activeSection() === section.id ? "var(--text-base)" : "var(--text-weak)",
                  background: activeSection() === section.id ? "var(--surface-raised)" : "transparent",
                  "border-left": activeSection() === section.id ? "2px solid var(--accent)" : "2px solid transparent",
                }}
                icon={<Icon name={section.iconName} class="w-4 h-4" />}
              >
                {section.label}
              </Button>
            )}
          </For>
        </nav>

        <div class="flex-1 overflow-y-auto p-4">
          <Show when={error()}>
            <div
              class="mb-4 px-3 py-2 rounded text-sm"
              style={{
                "background-color": "rgba(239, 68, 68, 0.1)",
                color: "var(--error)",
              }}
            >
              {error()}
            </div>
          </Show>

          <Show when={isLoading()}>
            <div class="flex items-center justify-center py-12">
              <Icon name="rotate" class="w-6 h-6 animate-spin" style={{ color: "var(--text-weak)" }} />
            </div>
          </Show>

          <Show when={!isLoading()}>
            <Show when={activeSection() === "general"}>
              <div class="space-y-4">
                <Input
                  label="Name"
                  type="text"
                  value={configName()}
                  onInput={(e) => {
                    setConfigName(e.currentTarget.value);
                    markChanged();
                  }}
                  placeholder="My Dev Container"
                />

                <Input
                  label="Remote User"
                  type="text"
                  value={remoteUser()}
                  onInput={(e) => {
                    setRemoteUser(e.currentTarget.value);
                    markChanged();
                  }}
                  placeholder="vscode"
                />

                <Input
                  label="Workspace Folder"
                  type="text"
                  value={workspaceFolder()}
                  onInput={(e) => {
                    setWorkspaceFolder(e.currentTarget.value);
                    markChanged();
                  }}
                  placeholder="/workspaces/${localWorkspaceFolderBasename}"
                />

                <div class="space-y-1.5">
                  <label class="block text-xs font-medium" style={{ color: "var(--text-weak)" }}>
                    Shutdown Action
                  </label>
                  <select
                    value={shutdownAction()}
                    onChange={(e) => {
                      setShutdownAction(e.currentTarget.value);
                      markChanged();
                    }}
                    class="w-full px-3 py-2 text-sm rounded"
                    style={{
                      "background-color": "var(--surface-raised)",
                      border: "1px solid var(--border-base)",
                      color: "var(--text-base)",
                    }}
                  >
                    <option value="none">None</option>
                    <option value="stopContainer">Stop Container</option>
                    <option value="stopCompose">Stop Compose</option>
                  </select>
                </div>
              </div>
            </Show>

            <Show when={activeSection() === "image"}>
              <div class="space-y-4">
                <div class="flex items-center gap-4 mb-4">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setUseDockerfile(false);
                      markChanged();
                    }}
                    icon={<Icon name="box" class="w-4 h-4" />}
                    style={{
                      outline: !useDockerfile() ? "2px solid var(--accent)" : "none",
                      "outline-offset": "2px",
                    }}
                  >
                    Use Image
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setUseDockerfile(true);
                      markChanged();
                    }}
                    icon={<Icon name="microchip" class="w-4 h-4" />}
                    style={{
                      outline: useDockerfile() ? "2px solid var(--accent)" : "none",
                      "outline-offset": "2px",
                    }}
                  >
                    Use Dockerfile
                  </Button>
                </div>

                <Show when={!useDockerfile()}>
                  <Input
                    label="Image"
                    type="text"
                    value={configImage()}
                    onInput={(e) => {
                      setConfigImage(e.currentTarget.value);
                      markChanged();
                    }}
                    placeholder="mcr.microsoft.com/devcontainers/base:ubuntu"
                    hint="Docker image to use for the container"
                  />
                </Show>

                <Show when={useDockerfile()}>
                  <div class="space-y-4">
                    <Input
                      label="Dockerfile Path"
                      type="text"
                      value={dockerfilePath()}
                      onInput={(e) => {
                        setDockerfilePath(e.currentTarget.value);
                        markChanged();
                      }}
                      placeholder="Dockerfile"
                    />

                    <Input
                      label="Build Context"
                      type="text"
                      value={buildContext()}
                      onInput={(e) => {
                        setBuildContext(e.currentTarget.value);
                        markChanged();
                      }}
                      placeholder="."
                    />
                  </div>
                </Show>
              </div>
            </Show>

            <Show when={activeSection() === "features"}>
              <FeatureSelector
                features={availableFeatures()}
                selectedFeatures={selectedFeatures()}
                onFeatureToggle={handleFeatureToggle}
                onFeatureOptionChange={handleFeatureOptionChange}
                isLoading={isLoading()}
              />
            </Show>

            <Show when={activeSection() === "ports"}>
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <div style={{ flex: "1" }}>
                    <Input
                      type="number"
                      value={newPort()}
                      onInput={(e) => setNewPort(e.currentTarget.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddPort()}
                      placeholder="Port number"
                      min="1"
                      max="65535"
                    />
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleAddPort}
                    icon={<Icon name="plus" class="w-4 h-4" />}
                  >
                    Add
                  </Button>
                </div>

                <Show when={forwardPorts().length > 0}>
                  <div class="space-y-2">
                    <For each={forwardPorts()}>
                      {(port) => (
                        <div
                          class="flex items-center justify-between px-3 py-2 rounded"
                          style={{
                            "background-color": "var(--surface-raised)",
                            border: "1px solid var(--border-weak)",
                          }}
                        >
                          <div class="flex items-center gap-2">
                            <Icon name="globe" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                            <span class="text-sm font-mono" style={{ color: "var(--text-base)" }}>
                              {port}
                            </span>
                          </div>
                          <IconButton
                            size="sm"
                            onClick={() => handleRemovePort(port)}
                            tooltip="Remove port"
                            style={{ color: "var(--error)" }}
                          >
                            <Icon name="trash" class="w-4 h-4" />
                          </IconButton>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>

            <Show when={activeSection() === "mounts"}>
              <div class="space-y-4">
                <Button
                  variant="primary"
                  onClick={handleAddMount}
                  icon={<Icon name="plus" class="w-4 h-4" />}
                >
                  Add Mount
                </Button>

                <Show when={mounts().length > 0}>
                  <div class="space-y-3">
                    <For each={mounts()}>
                      {(mount, index) => (
                        <div
                          class="p-3 rounded space-y-3"
                          style={{
                            "background-color": "var(--surface-raised)",
                            border: "1px solid var(--border-weak)",
                          }}
                        >
                          <div class="flex items-center justify-between">
                            <span class="text-xs font-medium" style={{ color: "var(--text-weak)" }}>
                              Mount #{index() + 1}
                            </span>
                            <IconButton
                              size="sm"
                              onClick={() => handleRemoveMount(index())}
                              tooltip="Remove mount"
                              style={{ color: "var(--error)" }}
                            >
                              <Icon name="trash" class="w-3.5 h-3.5" />
                            </IconButton>
                          </div>
                          <div class="grid grid-cols-3 gap-2">
                            <div class="space-y-1">
                              <label class="block text-xs" style={{ color: "var(--text-weaker)" }}>
                                Type
                              </label>
                              <select
                                value={mount.type}
                                onChange={(e) => handleUpdateMount(index(), "type", e.currentTarget.value)}
                                class="w-full px-2 py-1.5 text-sm rounded"
                                style={{
                                  "background-color": "var(--surface-base)",
                                  border: "1px solid var(--border-base)",
                                  color: "var(--text-base)",
                                }}
                              >
                                <option value="bind">Bind</option>
                                <option value="volume">Volume</option>
                              </select>
                            </div>
                            <div class="space-y-1">
                              <Input
                                label="Source"
                                type="text"
                                value={mount.source}
                                onInput={(e) => handleUpdateMount(index(), "source", e.currentTarget.value)}
                                placeholder="/host/path"
                                style={{ "font-size": "12px" }}
                              />
                            </div>
                            <div class="space-y-1">
                              <Input
                                label="Target"
                                type="text"
                                value={mount.target}
                                onInput={(e) => handleUpdateMount(index(), "target", e.currentTarget.value)}
                                placeholder="/container/path"
                                style={{ "font-size": "12px" }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>

            <Show when={activeSection() === "commands"}>
              <div class="space-y-4">
                <Textarea
                  label="Post Create Command"
                  value={postCreateCommand()}
                  onInput={(e) => {
                    setPostCreateCommand(e.currentTarget.value);
                    markChanged();
                  }}
                  placeholder="npm install"
                  rows={3}
                  hint="Runs after the container is created for the first time"
                  style={{ "font-family": "monospace" }}
                />

                <Textarea
                  label="Post Start Command"
                  value={postStartCommand()}
                  onInput={(e) => {
                    setPostStartCommand(e.currentTarget.value);
                    markChanged();
                  }}
                  placeholder="npm run dev"
                  rows={3}
                  hint="Runs every time the container starts"
                  style={{ "font-family": "monospace" }}
                />

                <Textarea
                  label="Post Attach Command"
                  value={postAttachCommand()}
                  onInput={(e) => {
                    setPostAttachCommand(e.currentTarget.value);
                    markChanged();
                  }}
                  placeholder="echo 'Welcome!'"
                  rows={3}
                  hint="Runs every time a tool attaches to the container"
                  style={{ "font-family": "monospace" }}
                />
              </div>
            </Show>

            <Show when={activeSection() === "extensions"}>
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <div style={{ flex: "1" }}>
                    <Input
                      type="text"
                      value={newExtension()}
                      onInput={(e) => setNewExtension(e.currentTarget.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddExtension()}
                      placeholder="publisher.extension-name"
                    />
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleAddExtension}
                    icon={<Icon name="plus" class="w-4 h-4" />}
                  >
                    Add
                  </Button>
                </div>

                <Show when={extensions().length > 0}>
                  <div class="space-y-2">
                    <For each={extensions()}>
                      {(ext) => (
                        <div
                          class="flex items-center justify-between px-3 py-2 rounded"
                          style={{
                            "background-color": "var(--surface-raised)",
                            border: "1px solid var(--border-weak)",
                          }}
                        >
                          <div class="flex items-center gap-2">
                            <Icon name="code" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                            <span class="text-sm" style={{ color: "var(--text-base)" }}>
                              {ext}
                            </span>
                          </div>
                          <IconButton
                            size="sm"
                            onClick={() => handleRemoveExtension(ext)}
                            tooltip="Remove extension"
                            style={{ color: "var(--error)" }}
                          >
                            <Icon name="trash" class="w-4 h-4" />
                          </IconButton>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>
          </Show>
        </div>
      </div>

      <Show when={showTemplateSelector()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center"
          style={{ "background-color": "rgba(0, 0, 0, 0.5)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTemplateSelector(false);
            }
          }}
        >
          <div
            class="w-[600px] max-h-[80vh] rounded-lg shadow-xl overflow-hidden"
            style={{
              "background-color": "var(--surface-overlay)",
              border: "1px solid var(--border-base)",
            }}
          >
            <div
              class="flex items-center justify-between px-4 py-3 border-b"
              style={{ "border-color": "var(--border-weak)" }}
            >
              <h2 class="text-sm font-semibold" style={{ color: "var(--text-base)" }}>
                Select Template
              </h2>
              <IconButton
                size="sm"
                onClick={() => setShowTemplateSelector(false)}
                tooltip="Close"
              >
                <Icon name="xmark" class="w-4 h-4" />
              </IconButton>
            </div>
            <div class="p-4">
              <TemplateSelector
                templates={availableTemplates()}
                selectedTemplate={selectedTemplate()}
                onSelect={handleTemplateSelect}
                isLoading={isLoading()}
              />
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

