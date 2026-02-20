import {
  createSignal,
  createMemo,
  createEffect,
  For,
  Show,
  JSX,
  onCleanup,
  Component,
  onMount,
} from "solid-js";
import { Icon } from "../ui/Icon";
import { useTheme } from "@/context/ThemeContext";

// Component metadata type
interface ComponentMeta {
  id: string;
  name: string;
  category: string;
  description?: string;
  status?: "stable" | "beta" | "deprecated" | "wip";
  component: Component<Record<string, unknown>>;
  props?: PropDefinition[];
  defaultProps?: Record<string, unknown>;
}

// Prop definition for editable props
interface PropDefinition {
  name: string;
  type: "string" | "number" | "boolean" | "select" | "color" | "object";
  default?: unknown;
  options?: string[]; // For select type
  description?: string;
  min?: number; // For number type
  max?: number; // For number type
}

// Viewport preset
interface ViewportPreset {
  name: string;
  width: number;
  height: number;
  icon: string;
}

// Component registry - imports will be dynamically populated
const componentRegistry: ComponentMeta[] = [];

// Function to register components for preview
export function registerComponent(meta: ComponentMeta): void {
  const exists = componentRegistry.findIndex((c) => c.id === meta.id);
  if (exists >= 0) {
    componentRegistry[exists] = meta;
  } else {
    componentRegistry.push(meta);
  }
}

// Viewport presets
const viewportPresets: ViewportPreset[] = [
  { name: "Auto", width: 0, height: 0, icon: "maximize" },
  { name: "Mobile", width: 375, height: 667, icon: "mobile" },
  { name: "Tablet", width: 768, height: 1024, icon: "tablet" },
  { name: "Desktop", width: 1280, height: 800, icon: "desktop" },
];

// Sample components for demonstration
const SampleButton: Component<{
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  children?: JSX.Element;
}> = (props) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors";
  const variants = {
    primary: "bg-[var(--cortex-info)] text-white hover:bg-[var(--cortex-info)]",
    secondary: "bg-[var(--ui-panel-bg-lighter)] text-white hover:bg-[var(--cortex-bg-hover)]",
    ghost: "bg-transparent hover:bg-[var(--ui-panel-bg-lighter)]",
  };
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  };

  return (
    <button
      class={`${baseStyles} ${variants[props.variant || "primary"]} ${sizes[props.size || "md"]}`}
      disabled={props.disabled}
      style={{ opacity: props.disabled ? "0.5" : "1", cursor: props.disabled ? "not-allowed" : "pointer" }}
    >
      {props.children || "Button"}
    </button>
  );
};

const SampleInput: Component<{
  placeholder?: string;
  type?: "text" | "password" | "email";
  disabled?: boolean;
  error?: boolean;
}> = (props) => {
  return (
    <input
      type={props.type || "text"}
      placeholder={props.placeholder || "Enter text..."}
      disabled={props.disabled}
      class="h-10 px-3 rounded-md text-sm transition-colors outline-none"
      style={{
        background: "var(--ui-panel-bg)",
        border: `1px solid ${props.error ? "var(--cortex-error)" : "var(--ui-panel-bg-lighter)"}`,
        color: "var(--cortex-text-primary)",
        opacity: props.disabled ? "0.5" : "1",
      }}
    />
  );
};

const SampleCard: Component<{
  title?: string;
  description?: string;
  elevated?: boolean;
}> = (props) => {
  return (
    <div
      class="p-4 rounded-lg"
      style={{
        background: "var(--ui-panel-bg)",
        border: "1px solid var(--ui-panel-bg-lighter)",
        "box-shadow": props.elevated ? "0 8px 24px rgba(0,0,0,0.3)" : "none",
      }}
    >
      <h3 class="text-sm font-semibold" style={{ color: "var(--cortex-text-primary)" }}>
        {props.title || "Card Title"}
      </h3>
      <p class="mt-1 text-xs" style={{ color: "var(--cortex-text-inactive)" }}>
        {props.description || "Card description goes here."}
      </p>
    </div>
  );
};

const SampleBadge: Component<{
  variant?: "default" | "success" | "warning" | "error" | "info";
  children?: JSX.Element;
}> = (props) => {
  const colors = {
    default: { bg: "var(--ui-panel-bg-lighter)", text: "var(--cortex-text-primary)" },
    success: { bg: "rgba(34, 197, 94, 0.15)", text: "var(--cortex-success)" },
    warning: { bg: "rgba(245, 158, 11, 0.15)", text: "var(--cortex-warning)" },
    error: { bg: "rgba(239, 68, 68, 0.15)", text: "var(--cortex-error)" },
    info: { bg: "rgba(59, 130, 246, 0.15)", text: "var(--cortex-info)" },
  };
  const variant = props.variant || "default";

  return (
    <span
      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: colors[variant].bg, color: colors[variant].text }}
    >
      {props.children || "Badge"}
    </span>
  );
};

const SampleAlert: Component<{
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  message?: string;
}> = (props) => {
  const colors = {
    info: { bg: "rgba(59, 130, 246, 0.1)", border: "var(--cortex-info)", text: "var(--cortex-info)" },
    success: { bg: "rgba(34, 197, 94, 0.1)", border: "var(--cortex-success)", text: "var(--cortex-success)" },
    warning: { bg: "rgba(245, 158, 11, 0.1)", border: "var(--cortex-warning)", text: "var(--cortex-warning)" },
    error: { bg: "rgba(239, 68, 68, 0.1)", border: "var(--cortex-error)", text: "var(--cortex-error)" },
  };
  const variant = props.variant || "info";

  return (
    <div
      class="p-3 rounded-lg"
      style={{
        background: colors[variant].bg,
        "border-left": `3px solid ${colors[variant].border}`,
      }}
    >
      <div class="font-medium text-sm" style={{ color: colors[variant].text }}>
        {props.title || "Alert Title"}
      </div>
      <div class="mt-1 text-xs" style={{ color: "var(--cortex-text-inactive)" }}>
        {props.message || "This is an alert message."}
      </div>
    </div>
  );
};

const SampleAvatar: Component<{
  size?: "sm" | "md" | "lg";
  initials?: string;
  status?: "online" | "offline" | "away";
}> = (props) => {
  const sizes = { sm: 32, md: 40, lg: 56 };
  const size = sizes[props.size || "md"];
  const statusColors = { online: "var(--cortex-success)", offline: "var(--cortex-text-inactive)", away: "var(--cortex-warning)" };

  return (
    <div class="relative inline-flex">
      <div
        class="flex items-center justify-center rounded-full font-medium"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: "linear-gradient(135deg, var(--cortex-info), var(--cortex-info))",
          color: "var(--cortex-text-primary)",
          "font-size": `${size / 2.5}px`,
        }}
      >
        {props.initials || "AB"}
      </div>
      <Show when={props.status}>
        <div
          class="absolute rounded-full border-2"
          style={{
            width: `${size / 4}px`,
            height: `${size / 4}px`,
            background: statusColors[props.status!],
            "border-color": "var(--cortex-bg-secondary)",
            bottom: "0",
            right: "0",
          }}
        />
      </Show>
    </div>
  );
};

const SampleSwitch: Component<{
  checked?: boolean;
  disabled?: boolean;
  label?: string;
}> = (props) => {
  const [isChecked, setIsChecked] = createSignal(props.checked || false);

  return (
    <label
      class="inline-flex items-center gap-2 cursor-pointer"
      style={{ opacity: props.disabled ? "0.5" : "1" }}
    >
      <div
        class="relative w-10 h-5 rounded-full transition-colors"
        style={{ background: isChecked() ? "var(--cortex-info)" : "var(--cortex-bg-hover)" }}
        onClick={() => !props.disabled && setIsChecked(!isChecked())}
      >
        <div
          class="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
          style={{
            background: "var(--cortex-bg-primary)",
            transform: isChecked() ? "translateX(22px)" : "translateX(2px)",
          }}
        />
      </div>
      <Show when={props.label}>
        <span class="text-sm" style={{ color: "var(--cortex-text-primary)" }}>
          {props.label}
        </span>
      </Show>
    </label>
  );
};

const SampleTooltip: Component<{
  text?: string;
  position?: "top" | "bottom" | "left" | "right";
}> = (props) => {
  const [isVisible, setIsVisible] = createSignal(false);

  return (
    <div class="relative inline-flex">
      <button
        class="px-3 py-1.5 text-sm rounded bg-[var(--ui-panel-bg-lighter)] text-white"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        Hover me
      </button>
      <Show when={isVisible()}>
        <div
          class="absolute z-50 px-2 py-1 text-xs rounded whitespace-nowrap"
          style={{
            background: "var(--ui-panel-bg)",
            border: "1px solid var(--cortex-bg-hover)",
            color: "var(--cortex-text-primary)",
            bottom: props.position === "top" ? "calc(100% + 8px)" : undefined,
            top: props.position === "bottom" ? "calc(100% + 8px)" : undefined,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          {props.text || "Tooltip text"}
        </div>
      </Show>
    </div>
  );
};

const SampleProgress: Component<{
  value?: number;
  variant?: "default" | "success" | "warning" | "error";
  showLabel?: boolean;
}> = (props) => {
  const value = Math.min(100, Math.max(0, props.value || 50));
  const colors = {
    default: "var(--cortex-info)",
    success: "var(--cortex-success)",
    warning: "var(--cortex-warning)",
    error: "var(--cortex-error)",
  };

  return (
    <div class="w-full">
      <div
        class="h-2 w-full rounded-full overflow-hidden"
        style={{ background: "var(--ui-panel-bg-lighter)" }}
      >
        <div
          class="h-full rounded-full transition-all duration-300"
          style={{
            width: `${value}%`,
            background: colors[props.variant || "default"],
          }}
        />
      </div>
      <Show when={props.showLabel}>
        <div class="mt-1 text-xs text-right" style={{ color: "var(--cortex-text-inactive)" }}>
          {value}%
        </div>
      </Show>
    </div>
  );
};

const SampleSkeleton: Component<{
  variant?: "text" | "circular" | "rectangular";
  width?: number;
  height?: number;
}> = (props) => {
  const variant = props.variant || "text";
  const styles: JSX.CSSProperties = {
    background: "linear-gradient(90deg, var(--ui-panel-bg-lighter) 25%, var(--cortex-bg-hover) 50%, var(--ui-panel-bg-lighter) 75%)",
    "background-size": "200% 100%",
    animation: "shimmer 1.5s infinite",
  };

  if (variant === "text") {
    return (
      <div
        class="h-4 rounded"
        style={{ ...styles, width: `${props.width || 200}px` }}
      />
    );
  }
  if (variant === "circular") {
    const size = props.width || 40;
    return (
      <div
        class="rounded-full"
        style={{ ...styles, width: `${size}px`, height: `${size}px` }}
      />
    );
  }
  return (
    <div
      class="rounded"
      style={{
        ...styles,
        width: `${props.width || 200}px`,
        height: `${props.height || 100}px`,
      }}
    />
  );
};

// Register sample components
const sampleComponents: ComponentMeta[] = [
  {
    id: "button",
    name: "Button",
    category: "Inputs",
    description: "Interactive button component with multiple variants and sizes",
    status: "stable",
    component: SampleButton as Component<Record<string, unknown>>,
    props: [
      { name: "variant", type: "select", options: ["primary", "secondary", "ghost"], default: "primary" },
      { name: "size", type: "select", options: ["sm", "md", "lg"], default: "md" },
      { name: "disabled", type: "boolean", default: false },
    ],
    defaultProps: { variant: "primary", size: "md", disabled: false },
  },
  {
    id: "input",
    name: "Input",
    category: "Inputs",
    description: "Text input field with validation states",
    status: "stable",
    component: SampleInput as Component<Record<string, unknown>>,
    props: [
      { name: "placeholder", type: "string", default: "Enter text..." },
      { name: "type", type: "select", options: ["text", "password", "email"], default: "text" },
      { name: "disabled", type: "boolean", default: false },
      { name: "error", type: "boolean", default: false },
    ],
    defaultProps: { placeholder: "Enter text...", type: "text", disabled: false, error: false },
  },
  {
    id: "card",
    name: "Card",
    category: "Layout",
    description: "Container component for grouping related content",
    status: "stable",
    component: SampleCard as Component<Record<string, unknown>>,
    props: [
      { name: "title", type: "string", default: "Card Title" },
      { name: "description", type: "string", default: "Card description goes here." },
      { name: "elevated", type: "boolean", default: false },
    ],
    defaultProps: { title: "Card Title", description: "Card description goes here.", elevated: false },
  },
  {
    id: "badge",
    name: "Badge",
    category: "Data Display",
    description: "Small status descriptor for UI elements",
    status: "stable",
    component: SampleBadge as Component<Record<string, unknown>>,
    props: [
      { name: "variant", type: "select", options: ["default", "success", "warning", "error", "info"], default: "default" },
    ],
    defaultProps: { variant: "default" },
  },
  {
    id: "alert",
    name: "Alert",
    category: "Feedback",
    description: "Contextual feedback messages for user actions",
    status: "stable",
    component: SampleAlert as Component<Record<string, unknown>>,
    props: [
      { name: "variant", type: "select", options: ["info", "success", "warning", "error"], default: "info" },
      { name: "title", type: "string", default: "Alert Title" },
      { name: "message", type: "string", default: "This is an alert message." },
    ],
    defaultProps: { variant: "info", title: "Alert Title", message: "This is an alert message." },
  },
  {
    id: "avatar",
    name: "Avatar",
    category: "Data Display",
    description: "User avatar with status indicator",
    status: "stable",
    component: SampleAvatar as Component<Record<string, unknown>>,
    props: [
      { name: "size", type: "select", options: ["sm", "md", "lg"], default: "md" },
      { name: "initials", type: "string", default: "AB" },
      { name: "status", type: "select", options: ["online", "offline", "away"], default: "online" },
    ],
    defaultProps: { size: "md", initials: "AB", status: "online" },
  },
  {
    id: "switch",
    name: "Switch",
    category: "Inputs",
    description: "Toggle switch for boolean settings",
    status: "stable",
    component: SampleSwitch as Component<Record<string, unknown>>,
    props: [
      { name: "checked", type: "boolean", default: false },
      { name: "disabled", type: "boolean", default: false },
      { name: "label", type: "string", default: "Toggle me" },
    ],
    defaultProps: { checked: false, disabled: false, label: "Toggle me" },
  },
  {
    id: "tooltip",
    name: "Tooltip",
    category: "Overlay",
    description: "Informative text shown on hover",
    status: "stable",
    component: SampleTooltip as Component<Record<string, unknown>>,
    props: [
      { name: "text", type: "string", default: "Tooltip text" },
      { name: "position", type: "select", options: ["top", "bottom"], default: "top" },
    ],
    defaultProps: { text: "Tooltip text", position: "top" },
  },
  {
    id: "progress",
    name: "Progress",
    category: "Feedback",
    description: "Progress indicator bar",
    status: "stable",
    component: SampleProgress as Component<Record<string, unknown>>,
    props: [
      { name: "value", type: "number", default: 50, min: 0, max: 100 },
      { name: "variant", type: "select", options: ["default", "success", "warning", "error"], default: "default" },
      { name: "showLabel", type: "boolean", default: true },
    ],
    defaultProps: { value: 50, variant: "default", showLabel: true },
  },
  {
    id: "skeleton",
    name: "Skeleton",
    category: "Feedback",
    description: "Loading placeholder animation",
    status: "stable",
    component: SampleSkeleton as Component<Record<string, unknown>>,
    props: [
      { name: "variant", type: "select", options: ["text", "circular", "rectangular"], default: "text" },
      { name: "width", type: "number", default: 200, min: 20, max: 400 },
      { name: "height", type: "number", default: 100, min: 20, max: 400 },
    ],
    defaultProps: { variant: "text", width: 200, height: 100 },
  },
];

// Initialize sample components
sampleComponents.forEach(registerComponent);

// Get unique categories from registry
function getCategories(): string[] {
  const categories = new Set(componentRegistry.map((c) => c.category));
  return Array.from(categories).sort();
}

// Component Preview Panel
export function ComponentPreview() {
  const { theme, setTheme, isDark } = useTheme();
  const [isOpen, setIsOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedComponent, setSelectedComponent] = createSignal<ComponentMeta | null>(null);
  const [selectedViewport, setSelectedViewport] = createSignal<ViewportPreset>(viewportPresets[0]);
  const [expandedCategories, setExpandedCategories] = createSignal<Set<string>>(new Set(getCategories()));
  const [componentProps, setComponentProps] = createSignal<Record<string, unknown>>({});
  const [resetKey, setResetKey] = createSignal(0);
  const [copiedCode, setCopiedCode] = createSignal(false);
  const [showCode, setShowCode] = createSignal(false);

  // Filter components based on search
  const filteredComponents = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return componentRegistry;
    return componentRegistry.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.category.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query)
    );
  });

  // Group components by category
  const componentsByCategory = createMemo(() => {
    const groups: Record<string, ComponentMeta[]> = {};
    filteredComponents().forEach((c) => {
      if (!groups[c.category]) groups[c.category] = [];
      groups[c.category].push(c);
    });
    return groups;
  });

  // Initialize props when selecting a component
  createEffect(() => {
    const comp = selectedComponent();
    if (comp && comp.defaultProps) {
      setComponentProps({ ...comp.defaultProps });
    } else {
      setComponentProps({});
    }
  });

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Update a single prop
  const updateProp = (name: string, value: unknown) => {
    setComponentProps((prev) => ({ ...prev, [name]: value }));
  };

  // Reset component to default props
  const resetProps = () => {
    const comp = selectedComponent();
    if (comp?.defaultProps) {
      setComponentProps({ ...comp.defaultProps });
      setResetKey((k) => k + 1);
    }
  };

  // Generate code snippet
  const generateCodeSnippet = (): string => {
    const comp = selectedComponent();
    if (!comp) return "";
    const props = componentProps();
    const propsStr = Object.entries(props)
      .filter(([_, v]) => v !== undefined && v !== "")
      .map(([k, v]) => {
        if (typeof v === "boolean") return v ? k : "";
        if (typeof v === "string") return `${k}="${v}"`;
        return `${k}={${JSON.stringify(v)}}`;
      })
      .filter(Boolean)
      .join(" ");
    return `<${comp.name}${propsStr ? " " + propsStr : ""} />`;
  };

  // Copy code to clipboard
  const copyCode = async () => {
    const code = generateCodeSnippet();
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  // Export snapshot (captures preview as image)
  const exportSnapshot = async () => {
    const preview = document.getElementById("component-preview-canvas");
    if (!preview) return;

    try {
      // Use html2canvas-like approach with SVG serialization
      const canvas = document.createElement("canvas");
      const rect = preview.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Fill background
      ctx.fillStyle = isDark() ? "var(--cortex-bg-secondary)" : "var(--cortex-text-primary)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw component info
      ctx.scale(2, 2);
      ctx.fillStyle = isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)";
      ctx.font = "14px system-ui";
      ctx.fillText(selectedComponent()?.name || "Component", 20, 30);
      ctx.fillStyle = isDark() ? "var(--cortex-text-inactive)" : "var(--cortex-text-inactive)";
      ctx.font = "12px system-ui";
      ctx.fillText(new Date().toISOString(), 20, 50);

      // Download
      const link = document.createElement("a");
      link.download = `${selectedComponent()?.id || "component"}-preview.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("Failed to export snapshot:", e);
    }
  };

  // Keyboard shortcut to open/close
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === "D") {
      e.preventDefault();
      setIsOpen(!isOpen());
    }
    if (e.key === "Escape" && isOpen()) {
      setIsOpen(false);
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    // Listen for custom event to open
    const openHandler = () => setIsOpen(true);
    window.addEventListener("dev:open-component-preview", openHandler);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("dev:open-component-preview", openHandler);
    });
  });

  // Status badge colors
  const statusColors: Record<string, { bg: string; text: string }> = {
    stable: { bg: "rgba(34, 197, 94, 0.15)", text: "var(--cortex-success)" },
    beta: { bg: "rgba(59, 130, 246, 0.15)", text: "var(--cortex-info)" },
    deprecated: { bg: "rgba(239, 68, 68, 0.15)", text: "var(--cortex-error)" },
    wip: { bg: "rgba(245, 158, 11, 0.15)", text: "var(--cortex-warning)" },
  };

  return (
    <>
      {/* Global styles for skeleton animation */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <Show when={isOpen()}>
        {/* Backdrop */}
        <div
          class="fixed inset-0 z-[9999] flex"
          style={{ background: "rgba(0, 0, 0, 0.8)" }}
        >
          {/* Main container */}
          <div
            class="flex-1 flex overflow-hidden m-4 rounded-xl"
            style={{
              background: isDark() ? "var(--cortex-bg-secondary)" : "var(--cortex-text-primary)",
              border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
            }}
          >
            {/* Left sidebar - Component list */}
            <div
              class="w-72 flex flex-col border-r shrink-0"
              style={{ "border-color": isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)" }}
            >
              {/* Header */}
              <div
                class="h-14 flex items-center justify-between px-4 border-b shrink-0"
                style={{ "border-color": isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)" }}
              >
                <span class="font-semibold" style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}>
                  Component Preview
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  class="p-1.5 rounded hover:bg-opacity-10 hover:bg-white transition-colors"
                  style={{ color: isDark() ? "var(--cortex-text-inactive)" : "var(--cortex-text-inactive)" }}
                >
                  <Icon name="xmark" class="w-[18px] h-[18px]" />
                </button>
              </div>

              {/* Search */}
              <div class="p-3 border-b" style={{ "border-color": isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)" }}>
                <div
                  class="flex items-center gap-2 px-3 h-9 rounded-lg"
                  style={{
                    background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
                    border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
                  }}
                >
                  <Icon name="magnifying-glass" class="w-3.5 h-3.5" style={{ color: "var(--cortex-text-inactive)" }} />
                  <input
                    type="text"
                    placeholder="Search components..."
                    value={searchQuery()}
                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                    class="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
                  />
                </div>
              </div>

              {/* Component list */}
              <div class="flex-1 overflow-y-auto p-2">
                <For each={Object.entries(componentsByCategory())}>
                  {([category, components]) => (
                    <div class="mb-2">
                      {/* Category header */}
                      <button
                        onClick={() => toggleCategory(category)}
                        class="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium uppercase tracking-wider rounded hover:bg-opacity-5 hover:bg-white transition-colors"
                        style={{ color: "var(--cortex-text-inactive)" }}
                      >
                        <Show
                          when={expandedCategories().has(category)}
                          fallback={<Icon name="chevron-right" class="w-3 h-3" />}
                        >
                          <Icon name="chevron-down" class="w-3 h-3" />
                        </Show>
                        {category}
                        <span class="ml-auto text-[10px] opacity-60">
                          {components.length}
                        </span>
                      </button>

                      {/* Components in category */}
                      <Show when={expandedCategories().has(category)}>
                        <div class="mt-1 space-y-0.5">
                          <For each={components}>
                            {(comp) => (
                              <button
                                onClick={() => setSelectedComponent(comp)}
                                class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left"
                                style={{
                                  background:
                                    selectedComponent()?.id === comp.id
                                      ? isDark()
                                        ? "var(--ui-panel-bg)"
                                        : "var(--cortex-text-primary)"
                                      : "transparent",
                                  color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)",
                                }}
                              >
                                <span class="flex-1 truncate">{comp.name}</span>
                                <Show when={comp.status && comp.status !== "stable"}>
                                  <span
                                    class="px-1.5 py-0.5 text-[10px] rounded font-medium"
                                    style={{
                                      background: statusColors[comp.status!]?.bg,
                                      color: statusColors[comp.status!]?.text,
                                    }}
                                  >
                                    {comp.status}
                                  </span>
                                </Show>
                              </button>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>

                <Show when={filteredComponents().length === 0}>
                  <div class="p-4 text-center text-sm" style={{ color: "var(--cortex-text-inactive)" }}>
                    No components found
                  </div>
                </Show>
              </div>

              {/* Footer stats */}
              <div
                class="px-4 py-3 text-xs border-t"
                style={{
                  color: "var(--cortex-text-inactive)",
                  "border-color": isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)",
                }}
              >
                {componentRegistry.length} components • {getCategories().length} categories
              </div>
            </div>

            {/* Main preview area */}
            <div class="flex-1 flex flex-col min-w-0">
              {/* Toolbar */}
              <div
                class="h-14 flex items-center justify-between px-4 border-b shrink-0"
                style={{ "border-color": isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)" }}
              >
                <div class="flex items-center gap-2">
                  {/* Viewport selector */}
                  <div
                    class="flex items-center rounded-lg overflow-hidden"
                    style={{
                      background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
                      border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
                    }}
                  >
                    <For each={viewportPresets}>
                      {(preset) => (
                        <button
                          onClick={() => setSelectedViewport(preset)}
                          class="p-2 transition-colors"
                          style={{
                            background:
                              selectedViewport().name === preset.name
                                ? isDark()
                                  ? "var(--ui-panel-bg-lighter)"
                                  : "var(--cortex-text-primary)"
                                : "transparent",
                            color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)",
                          }}
                          title={preset.name}
                        >
                          <Icon name={preset.icon} class="w-4 h-4" />
                        </button>
                      )}
                    </For>
                  </div>

                  <Show when={selectedViewport().width > 0}>
                    <span class="text-xs" style={{ color: "var(--cortex-text-inactive)" }}>
                      {selectedViewport().width} × {selectedViewport().height}
                    </span>
                  </Show>
                </div>

                <div class="flex items-center gap-2">
                  {/* Theme toggle */}
                  <div
                    class="flex items-center rounded-lg overflow-hidden"
                    style={{
                      background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
                      border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
                    }}
                  >
                    <button
                      onClick={() => setTheme("light")}
                      class="p-2 transition-colors"
                      style={{
                        background: theme() === "light" ? (isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)") : "transparent",
                        color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)",
                      }}
                      title="Light theme"
                    >
                      <Icon name="sun" class="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      class="p-2 transition-colors"
                      style={{
                        background: theme() === "dark" ? (isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)") : "transparent",
                        color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)",
                      }}
                      title="Dark theme"
                    >
                      <Icon name="moon" class="w-4 h-4" />
                    </button>
                  </div>

                  {/* Reset button */}
                  <button
                    onClick={resetProps}
                    class="p-2 rounded-lg transition-colors"
                    style={{
                      background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
                      border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
                      color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)",
                    }}
                    title="Reset to defaults"
                  >
                    <Icon name="rotate" class="w-4 h-4" />
                  </button>

                  {/* Export snapshot */}
                  <button
                    onClick={exportSnapshot}
                    class="p-2 rounded-lg transition-colors"
                    style={{
                      background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
                      border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
                      color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)",
                    }}
                    title="Export snapshot"
                  >
                    <Icon name="camera" class="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Preview content */}
              <div class="flex-1 flex overflow-hidden">
                {/* Preview canvas */}
                <div class="flex-1 overflow-auto p-6">
                  <Show
                    when={selectedComponent()}
                    fallback={
                      <div
                        class="h-full flex flex-col items-center justify-center"
                        style={{ color: "var(--cortex-text-inactive)" }}
                      >
                        <Icon name="eye" class="w-12 h-12 opacity-30 mb-4" />
                        <div class="text-lg font-medium mb-2">Select a component</div>
                        <div class="text-sm">Choose a component from the sidebar to preview</div>
                      </div>
                    }
                  >
                    {(comp) => (
                      <div class="space-y-6">
                        {/* Component info */}
                        <div>
                          <div class="flex items-center gap-3 mb-2">
                            <h2
                              class="text-xl font-semibold"
                              style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
                            >
                              {comp().name}
                            </h2>
                            <Show when={comp().status}>
                              <span
                                class="px-2 py-0.5 text-xs rounded font-medium"
                                style={{
                                  background: statusColors[comp().status!]?.bg,
                                  color: statusColors[comp().status!]?.text,
                                }}
                              >
                                {comp().status}
                              </span>
                            </Show>
                          </div>
                          <Show when={comp().description}>
                            <p class="text-sm" style={{ color: "var(--cortex-text-inactive)" }}>
                              {comp().description}
                            </p>
                          </Show>
                        </div>

                        {/* Preview frame */}
                        <div
                          id="component-preview-canvas"
                          class="rounded-xl overflow-hidden"
                          style={{
                            background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
                            border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
                            width:
                              selectedViewport().width > 0
                                ? `${selectedViewport().width}px`
                                : "100%",
                            "min-height":
                              selectedViewport().height > 0
                                ? `${selectedViewport().height}px`
                                : "200px",
                            margin: selectedViewport().width > 0 ? "0 auto" : undefined,
                          }}
                        >
                          <div
                            class="p-8 flex items-center justify-center"
                            style={{ "min-height": "inherit" }}
                          >
                            {/* Render component with current props */}
                            <div data-reset-key={resetKey()}>
                              {(() => {
                                const Component = comp().component;
                                return <Component {...componentProps()} />;
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Code snippet */}
                        <div>
                          <button
                            onClick={() => setShowCode(!showCode())}
                            class="flex items-center gap-2 text-sm font-medium mb-2"
                            style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
                          >
                            <Icon name="code" class="w-3.5 h-3.5" />
                            Code
                            <Show when={showCode()} fallback={<Icon name="chevron-right" class="w-3.5 h-3.5" />}>
                              <Icon name="chevron-down" class="w-3.5 h-3.5" />
                            </Show>
                          </button>
                          <Show when={showCode()}>
                            <div
                              class="relative rounded-lg overflow-hidden"
                              style={{
                                background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
                                border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
                              }}
                            >
                              <pre
                                class="p-4 text-sm font-mono overflow-x-auto"
                                style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
                              >
                                {generateCodeSnippet()}
                              </pre>
                              <button
                                onClick={copyCode}
                                class="absolute top-2 right-2 p-2 rounded transition-colors"
                                style={{
                                  background: isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)",
                                  color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)",
                                }}
                                title="Copy code"
                              >
                                <Show when={copiedCode()} fallback={<Icon name="copy" class="w-3.5 h-3.5" />}>
                                  <Icon name="check" class="w-3.5 h-3.5" style={{ color: "var(--cortex-success)" }} />
                                </Show>
                              </button>
                            </div>
                          </Show>
                        </div>
                      </div>
                    )}
                  </Show>
                </div>

                {/* Props panel */}
                <Show when={selectedComponent()?.props?.length}>
                  <div
                    class="w-72 border-l overflow-y-auto shrink-0"
                    style={{ "border-color": isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)" }}
                  >
                    <div
                      class="px-4 py-3 border-b font-medium text-sm"
                      style={{
                        "border-color": isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)",
                        color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)",
                      }}
                    >
                      Props
                    </div>
                    <div class="p-4 space-y-4">
                      <For each={selectedComponent()?.props}>
                        {(prop) => (
                          <div>
                            <label
                              class="block text-xs font-medium mb-1.5"
                              style={{ color: "var(--cortex-text-inactive)" }}
                            >
                              {prop.name}
                              <Show when={prop.description}>
                                <span class="ml-1 opacity-60">• {prop.description}</span>
                              </Show>
                            </label>

                            {/* Boolean prop */}
                            <Show when={prop.type === "boolean"}>
                              <label class="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={componentProps()[prop.name] as boolean}
                                  onChange={(e) => updateProp(prop.name, e.currentTarget.checked)}
                                  class="w-4 h-4 rounded"
                                />
                                <span
                                  class="text-sm"
                                  style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
                                >
                                  {componentProps()[prop.name] ? "true" : "false"}
                                </span>
                              </label>
                            </Show>

                            {/* String prop */}
                            <Show when={prop.type === "string"}>
                              <input
                                type="text"
                                value={(componentProps()[prop.name] as string) || ""}
                                onInput={(e) => updateProp(prop.name, e.currentTarget.value)}
                                class="w-full h-8 px-2 text-sm rounded outline-none"
                                style={{
                                  background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
                                  border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
                                  color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)",
                                }}
                              />
                            </Show>

                            {/* Number prop */}
                            <Show when={prop.type === "number"}>
                              <div class="flex items-center gap-2">
                                <input
                                  type="range"
                                  min={prop.min ?? 0}
                                  max={prop.max ?? 100}
                                  value={(componentProps()[prop.name] as number) || 0}
                                  onInput={(e) =>
                                    updateProp(prop.name, parseInt(e.currentTarget.value))
                                  }
                                  class="flex-1"
                                />
                                <span
                                  class="text-sm w-10 text-right"
                                  style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
                                >
                                  {componentProps()[prop.name] as number}
                                </span>
                              </div>
                            </Show>

                            {/* Select prop */}
                            <Show when={prop.type === "select"}>
                              <select
                                value={(componentProps()[prop.name] as string) || ""}
                                onChange={(e) => updateProp(prop.name, e.currentTarget.value)}
                                class="w-full h-8 px-2 text-sm rounded outline-none cursor-pointer"
                                style={{
                                  background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
                                  border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
                                  color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)",
                                }}
                              >
                                <For each={prop.options}>
                                  {(opt) => <option value={opt}>{opt}</option>}
                                </For>
                              </select>
                            </Show>

                            {/* Color prop */}
                            <Show when={prop.type === "color"}>
                              <input
                                type="color"
                                value={(componentProps()[prop.name] as string) || "var(--cortex-accent-text)"}
                                onChange={(e) => updateProp(prop.name, e.currentTarget.value)}
                                class="w-full h-8 rounded cursor-pointer"
                              />
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}

// Export utility to open component preview from anywhere
export function openComponentPreview(): void {
  window.dispatchEvent(new CustomEvent("dev:open-component-preview"));
}

// Export types and registry function
export type { ComponentMeta, PropDefinition };

