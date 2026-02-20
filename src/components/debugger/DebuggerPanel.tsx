import { Show, For, createSignal, createMemo } from "solid-js";
import { useDebug, DebugSessionConfig } from "@/context/DebugContext";
import { BreakpointPanel } from "./BreakpointPanel";
import { VariablesPanel } from "./VariablesPanel";
import { CallStackPanel } from "./CallStackPanel";
import { WatchPanel } from "./WatchPanel";
import { DebugConsole } from "./DebugConsole";
import { DisassemblyView } from "./DisassemblyView";
import { MemoryInspector } from "./MemoryInspector";
import { LoadedScriptsView } from "./LoadedScriptsView";
import { DebugToolbar } from "./DebugToolbar";
import { LaunchConfigPicker } from "./LaunchConfigPicker";
import { Button, ListItem, Badge, Text } from "@/components/ui";
import { tokens } from "@/design-system/tokens";
import { Icon } from "../ui/Icon";

import { loadStylesheet } from "@/utils/lazyStyles";
loadStylesheet("debug");

type ViewId = "variables" | "watch" | "callStack" | "breakpoints";
type PanelId = "console" | "disassembly" | "memory" | "scripts";

const getPlatformClass = () => {
  const platform = navigator.platform.toUpperCase();
  if (platform.indexOf("MAC") >= 0) return "platform-mac";
  if (platform.indexOf("WIN") >= 0) return "platform-windows";
  return "platform-linux";
};

export function DebuggerPanel() {
  const debug = useDebug();
  const [showLaunchPicker, setShowLaunchPicker] = createSignal(false);
  const [activePanel, setActivePanel] = createSignal<PanelId>("console");
  const platformClass = getPlatformClass();

  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = createSignal<Set<ViewId>>(new Set());

  const toggleSection = (id: ViewId) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isCollapsed = (id: ViewId) => collapsedSections().has(id);

  const handleStartDebug = async (config: DebugSessionConfig) => {
    try {
      await debug.startSession(config);
      setShowLaunchPicker(false);
    } catch (e) {
      console.error("Failed to start debug session:", e);
    }
  };

  // Count breakpoints
  const breakpointCount = createMemo(() => {
    let count = 0;
    for (const bps of Object.values(debug.state.breakpoints)) {
      count += bps.length;
    }
    count += debug.state.functionBreakpoints.length;
    count += debug.state.dataBreakpoints.length;
    return count;
  });

  // Sidebar sections configuration
const sidebarSections: Array<{
    id: ViewId;
    label: string;
    icon: string;
    badge?: () => number | string | undefined;
    component: any;
  }> = [
    { 
      id: "variables", 
      label: "Variables", 
      icon: "box",
      component: VariablesPanel 
    },
    { 
      id: "watch", 
      label: "Watch", 
      icon: "eye",
      badge: () => debug.state.watchExpressions.length || undefined,
      component: WatchPanel 
    },
    { 
      id: "callStack", 
      label: "Call Stack", 
      icon: "layer-group",
      badge: () => debug.state.threads.length || undefined,
      component: CallStackPanel 
    },
    { 
      id: "breakpoints", 
      label: "Breakpoints", 
      icon: "circle-dot",
      badge: () => breakpointCount() || undefined,
      component: BreakpointPanel 
    },
  ];

// Bottom panel tabs
  const panelTabs: Array<{
    id: PanelId;
    label: string;
    icon: string;
  }> = [
    { id: "console", label: "Debug Console", icon: "terminal" },
    { id: "scripts", label: "Loaded Scripts", icon: "file" },
    { id: "disassembly", label: "Disassembly", icon: "microchip" },
    { id: "memory", label: "Memory", icon: "layer-group" },
  ];

  return (
    <div 
      class={`debug-pane h-full flex flex-col ${platformClass}`} 
      style={{ background: tokens.colors.surface.panel }}
    >
      {/* Header with Start Debug / Session Info */}
      <div
        class="shrink-0 flex items-center justify-between px-3 py-2 border-b"
        style={{ "border-color": tokens.colors.border.divider }}
      >
        <div class="flex items-center gap-2">
<Icon name="bug" class="w-4 h-4" style={{ color: tokens.colors.semantic.error }} />
          <Text variant="header">
            Run and Debug
          </Text>
        </div>

        <Show 
          when={debug.state.isDebugging}
          fallback={
            <Button
              variant="primary"
              size="sm"
              icon={<Icon name="play" class="w-3.5 h-3.5" />}
              onClick={() => setShowLaunchPicker(true)}
            >
              Start
            </Button>
          }
        >
          <div class="flex items-center gap-2">
            <Badge 
              variant={debug.state.isPaused ? "warning" : "success"}
              style={{ "text-transform": "uppercase" }}
            >
              {debug.state.isPaused ? "Paused" : "Running"}
            </Badge>
          </div>
        </Show>
      </div>

      {/* Debug Toolbar (when debugging) */}
      <Show when={debug.state.isDebugging}>
        <DebugToolbar />
      </Show>

      {/* Main Content Area */}
      <div class="flex-1 overflow-hidden flex flex-col">
        <Show
          when={debug.state.isDebugging}
          fallback={
            <WelcomeView onStart={() => setShowLaunchPicker(true)} />
          }
        >
          {/* Sidebar Sections */}
          <div class="flex-1 overflow-auto">
            <For each={sidebarSections}>
              {(section) => {
                const Component = section.component;
                const sectionIconName = section.icon;
                const badgeValue = section.badge?.();
                
                return (
                  <div class="border-b" style={{ "border-color": tokens.colors.border.divider }}>
                    {/* Section Header */}
                    <ListItem
                      onClick={() => toggleSection(section.id)}
                      icon={
                        <span class="w-4 h-4 flex items-center justify-center">
<Show 
                            when={isCollapsed(section.id)}
                            fallback={<Icon name="chevron-down" class="w-3 h-3" />}
                          >
                            <Icon name="chevron-right" class="w-3 h-3" />
                          </Show>
                        </span>
                      }
                      iconRight={<Icon name={sectionIconName} class="w-3.5 h-3.5" style={{ color: tokens.colors.text.muted }} />}
                      badge={badgeValue}
                      style={{ 
                        "font-size": "var(--jb-text-header-size)",
                        "font-weight": "var(--jb-text-header-weight)",
                        "text-transform": "uppercase",
                        "letter-spacing": "var(--jb-text-header-spacing)",
                      }}
                    >
                      <Text variant="header">{section.label}</Text>
                    </ListItem>
                    
                    {/* Section Content */}
                    <Show when={!isCollapsed(section.id)}>
                      <div class="max-h-[200px] overflow-auto">
                        <Component />
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>

          {/* Bottom Panel */}
          <div 
            class="shrink-0 border-t flex flex-col"
            style={{ 
              "border-color": tokens.colors.border.divider,
              height: "200px",
            }}
          >
            {/* Panel Tabs */}
            <div
              class="shrink-0 flex border-b overflow-x-auto no-scrollbar"
              style={{ "border-color": tokens.colors.border.divider }}
            >
              <For each={panelTabs}>
{(tab) => {
                  const isActive = activePanel() === tab.id;
                  return (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActivePanel(tab.id)}
                      icon={<Icon name={tab.icon} class="w-3.5 h-3.5" />}
                      style={{
                        color: isActive ? tokens.colors.text.primary : tokens.colors.text.muted,
                        "border-bottom": isActive
                          ? "2px solid var(--jb-border-focus)"
                          : "2px solid transparent",
                        "border-radius": "0",
                        "font-size": "var(--jb-text-body-size)",
                      }}
                    >
                      {tab.label}
                    </Button>
                  );
                }}
              </For>
            </div>

            {/* Panel Content */}
            <div class="flex-1 overflow-auto">
              <Show when={activePanel() === "console"}>
                <DebugConsole />
              </Show>
              <Show when={activePanel() === "scripts"}>
                <LoadedScriptsView />
              </Show>
              <Show when={activePanel() === "disassembly"}>
                <DisassemblyView />
              </Show>
              <Show when={activePanel() === "memory"}>
                <MemoryInspector />
              </Show>
            </div>
          </div>
        </Show>
      </div>

      {/* Launch Configuration Picker */}
      <Show when={showLaunchPicker()}>
        <LaunchConfigPicker
          onClose={() => setShowLaunchPicker(false)}
          onLaunch={handleStartDebug}
        />
      </Show>
    </div>
  );
}

// Welcome view when no debug session is active
function WelcomeView(props: { onStart: () => void }) {
  const debug = useDebug();
  const savedConfigs = () => debug.getSavedConfigurations();

  return (
    <div class="flex-1 flex flex-col p-4" style={{ background: tokens.colors.surface.panel }}>
      {/* Quick Actions */}
      <div class="mb-6">
        <Button
          variant="primary"
          onClick={props.onStart}
          icon={<Icon name="play" class="w-5 h-5" />}
          style={{ width: "100%", "justify-content": "center", padding: "12px 16px" }}
        >
          Start Debugging
        </Button>
        <Text 
          variant="muted" 
          align="center" 
          as="p" 
          style={{ "margin-top": tokens.spacing.md }}
        >
          Press <kbd 
            style={{ 
              padding: "2px 6px", 
              "border-radius": tokens.radius.sm, 
              "font-size": "var(--jb-text-muted-size)",
              background: "var(--jb-surface-active)",
            }}
          >F5</kbd> to start
        </Text>
      </div>

      {/* Recent/Saved Configurations */}
      <Show when={savedConfigs().length > 0}>
        <div>
          <Text variant="header" as="h3" style={{ "margin-bottom": tokens.spacing.md }}>
            Configurations
          </Text>
          <div class="space-y-1">
            <For each={savedConfigs().slice(0, 5)}>
              {(config) => (
                <ListItem
                  onClick={() => {
                    debug.startSession({
                      ...config,
                      id: `debug-${Date.now()}`,
                    });
                  }}
                  icon={<Icon name="bug" class="w-4 h-4" style={{ color: tokens.colors.semantic.error }} />}
                  label={config.name}
                  description={config.type}
                />
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Help Links */}
      <div class="mt-auto pt-4 border-t" style={{ "border-color": tokens.colors.border.divider }}>
        <div class="space-y-2">
          <ListItem
            onClick={props.onStart}
            icon={<Icon name="gear" class="w-4 h-4" />}
            label="Create launch.json"
            style={{ color: tokens.colors.text.muted }}
          />
          <a
            href="https://code.visualstudio.com/docs/editor/debugging"
            target="_blank"
            style={{ "text-decoration": "none" }}
          >
            <ListItem
              icon={<Icon name="code" class="w-4 h-4" />}
              label="Learn about debugging"
              style={{ color: tokens.colors.text.muted }}
            />
          </a>
        </div>
      </div>
    </div>
  );
}

export default DebuggerPanel;
