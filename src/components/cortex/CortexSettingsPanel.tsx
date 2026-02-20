import { createSignal, Show, Suspense, lazy, type JSX } from "solid-js";
import { tokens } from "@/design-system/tokens";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui";

const SettingsEditor = lazy(() =>
  import("@/components/settings/SettingsEditor").then((m) => ({
    default: m.SettingsEditor,
  }))
);

const JsonSettingsEditor = lazy(() =>
  import("@/components/settings/JsonSettingsEditor").then((m) => ({
    default: m.JsonSettingsEditor,
  }))
);

export const SETTINGS_VIRTUAL_PATH = "virtual:///Settings";

export interface CortexSettingsPanelProps {
  initialJsonView?: boolean;
  initialShowDefaults?: boolean;
  initialSection?: string;
}

export function CortexSettingsPanel(props: CortexSettingsPanelProps) {
  const [showJsonView, setShowJsonView] = createSignal(
    props.initialJsonView ?? false
  );

  const headerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "8px 16px",
    "border-bottom": `1px solid ${tokens.colors.border.default}`,
    background: tokens.colors.surface.panel,
    "flex-shrink": "0",
  });

  const titleStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
  });

  const toggleStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "4px",
    "border-radius": tokens.radius.md,
    border: `1px solid ${tokens.colors.border.default}`,
    background: tokens.colors.surface.input,
    padding: "2px",
  });

  const toggleBtnStyle = (active: boolean): JSX.CSSProperties => ({
    padding: "4px 12px",
    "border-radius": tokens.radius.sm,
    border: "none",
    background: active ? tokens.colors.interactive.active : "transparent",
    color: active ? tokens.colors.text.primary : tokens.colors.text.muted,
    cursor: "pointer",
    "font-size": "12px",
    "font-weight": active ? "500" : "400",
    transition: "all 150ms ease",
  });

  const contentStyle = (): JSX.CSSProperties => ({
    flex: "1",
    overflow: "hidden",
    display: "flex",
    "flex-direction": "column",
  });

  const loadingStyle = (): JSX.CSSProperties => ({
    flex: "1",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    color: tokens.colors.text.muted,
  });

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        background: tokens.colors.surface.canvas,
      }}
    >
      <div style={headerStyle()}>
        <div style={titleStyle()}>
          <Icon
            name="gear"
            style={{
              width: "16px",
              height: "16px",
              color: tokens.colors.text.muted,
            }}
          />
          <Text size="sm" weight="medium">
            Settings
          </Text>
        </div>

        <div style={toggleStyle()}>
          <button
            style={toggleBtnStyle(!showJsonView())}
            onClick={() => setShowJsonView(false)}
            title="GUI Settings Editor"
          >
            <Icon
              name="sliders"
              style={{ width: "14px", height: "14px" }}
            />
          </button>
          <button
            style={toggleBtnStyle(showJsonView())}
            onClick={() => setShowJsonView(true)}
            title="JSON Settings Editor"
          >
            <Icon
              name="code"
              style={{ width: "14px", height: "14px" }}
            />
          </button>
        </div>
      </div>

      <div style={contentStyle()}>
        <Suspense
          fallback={
            <div style={loadingStyle()}>
              <Text size="sm">Loading settings...</Text>
            </div>
          }
        >
          <Show
            when={!showJsonView()}
            fallback={<JsonSettingsEditor initialScope="user" />}
          >
            <SettingsEditor />
          </Show>
        </Suspense>
      </div>
    </div>
  );
}

export default CortexSettingsPanel;
