/**
 * PluginViewContainer - Renders plugin-contributed sidebar views and panels
 *
 * Wraps the existing ContributedView and ContributedPanel components and
 * sources its data from the PluginUIContributions context so that views
 * registered at runtime are automatically rendered.
 */

import { Component, Show, For } from "solid-js";
import { ContributedView } from "@/components/extensions/ContributedView";
import { ContributedPanel } from "@/components/extensions/ContributedPanel";
import { usePluginUIContributions } from "@/context/extensions/PluginUIContributions";
import { EmptyState } from "@/components/ui";

// ============================================================================
// Sidebar View Container
// ============================================================================

interface PluginSidebarContainerProps {
  extensionId?: string;
  class?: string;
}

export const PluginSidebarContainer: Component<PluginSidebarContainerProps> = (
  props,
) => {
  const { getSidebarViews } = usePluginUIContributions();

  const views = () => getSidebarViews(props.extensionId);

  return (
    <div class={`flex flex-col overflow-hidden ${props.class ?? ""}`}>
      <Show
        when={views().length > 0}
        fallback={
          <EmptyState
            icon="layout"
            title="No plugin views"
            description="Extensions can contribute sidebar views that appear here."
          />
        }
      >
        <For each={views()}>
          {(view) => (
            <ContributedView
              viewId={view.viewId}
              extensionId={view.extensionId}
              title={view.title}
              icon={view.icon}
            />
          )}
        </For>
      </Show>
    </div>
  );
};

// ============================================================================
// Bottom Panel Container
// ============================================================================

interface PluginPanelContainerProps {
  extensionId?: string;
  class?: string;
  onClosePanel?: (panelId: string) => void;
}

export const PluginPanelContainer: Component<PluginPanelContainerProps> = (
  props,
) => {
  const { getPanelTabs } = usePluginUIContributions();

  const panels = () => getPanelTabs(props.extensionId);

  return (
    <Show when={panels().length > 0}>
      <div class={`flex flex-col ${props.class ?? ""}`}>
        <For each={panels()}>
          {(panel) => (
            <ContributedPanel
              panelId={panel.panelId}
              extensionId={panel.extensionId}
              title={panel.title}
              icon={panel.icon}
              onClose={
                props.onClosePanel
                  ? () => props.onClosePanel!(panel.panelId)
                  : undefined
              }
            />
          )}
        </For>
      </div>
    </Show>
  );
};
