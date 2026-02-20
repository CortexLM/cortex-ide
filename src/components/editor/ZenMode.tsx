import {
  Component,
  createSignal,
  createEffect,
  onMount,
  onCleanup,
  Show,
  JSX,
} from "solid-js";
import { useZenModeContext } from "@/context/ZenModeContext";
import { useSettings } from "@/context/SettingsContext";

export interface ZenModeProps {
  class?: string;
  style?: JSX.CSSProperties;
}

export interface ZenModeSettings {
  hideSidebar: boolean;
  hidePanel: boolean;
  hideStatusBar: boolean;
  hideActivityBar: boolean;
  hideMenuBar: boolean;
  hideTabs: boolean;
  centerLayout: boolean;
  fullScreen: boolean;
  maxWidth: string;
  silentNotifications: boolean;
}

const DEFAULT_ZEN_SETTINGS: ZenModeSettings = {
  hideSidebar: true,
  hidePanel: true,
  hideStatusBar: true,
  hideActivityBar: true,
  hideMenuBar: true,
  hideTabs: false,
  centerLayout: true,
  fullScreen: false,
  maxWidth: "900px",
  silentNotifications: true,
};

const ZEN_BODY_CLASSES = [
  "zen-mode-active",
  "zen-hide-sidebar",
  "zen-hide-panel",
  "zen-hide-statusbar",
  "zen-hide-activitybar",
  "zen-hide-menubar",
  "zen-hide-tabs",
  "zen-center-layout",
] as const;

/**
 * ZenMode - Full zen mode implementation for the editor.
 *
 * Hides all sidebars, panels, status bar, activity bar.
 * Centers the editor content.
 * Toggle with Ctrl+K Z keyboard shortcut.
 * Stores zen mode settings in context.
 */
export const ZenMode: Component<ZenModeProps> = (props) => {
  const zenMode = useZenModeContext();
  const { effectiveSettings } = useSettings();
  const [chordActive, setChordActive] = createSignal(false);
  let chordTimeout: ReturnType<typeof setTimeout> | null = null;

  const zenSettings = (): ZenModeSettings => {
    const s = effectiveSettings().zenMode;
    return {
      hideSidebar: s?.hideSidebar ?? DEFAULT_ZEN_SETTINGS.hideSidebar,
      hidePanel: s?.hidePanel ?? DEFAULT_ZEN_SETTINGS.hidePanel,
      hideStatusBar: s?.hideStatusBar ?? DEFAULT_ZEN_SETTINGS.hideStatusBar,
      hideActivityBar: s?.hideActivityBar ?? DEFAULT_ZEN_SETTINGS.hideActivityBar,
      hideMenuBar: s?.hideMenuBar ?? DEFAULT_ZEN_SETTINGS.hideMenuBar,
      hideTabs: s?.hideTabs ?? DEFAULT_ZEN_SETTINGS.hideTabs,
      centerLayout: s?.centerLayout ?? DEFAULT_ZEN_SETTINGS.centerLayout,
      fullScreen: s?.fullScreen ?? DEFAULT_ZEN_SETTINGS.fullScreen,
      maxWidth: s?.maxWidth ?? DEFAULT_ZEN_SETTINGS.maxWidth,
      silentNotifications:
        s?.silenceNotifications ?? DEFAULT_ZEN_SETTINGS.silentNotifications,
    };
  };

  const clearChord = () => {
    setChordActive(false);
    if (chordTimeout) {
      clearTimeout(chordTimeout);
      chordTimeout = null;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k" && !chordActive()) {
      e.preventDefault();
      setChordActive(true);
      if (chordTimeout) clearTimeout(chordTimeout);
      chordTimeout = setTimeout(() => setChordActive(false), 1500);
      return;
    }

    if (chordActive() && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      clearChord();
      zenMode.actions.toggle();
      return;
    }

    if (chordActive() && e.key !== "z" && e.key !== "Z") {
      clearChord();
    }
  };

  createEffect(() => {
    const active = zenMode.isActive();
    const settings = zenSettings();

    if (active) {
      if (settings.hideSidebar) {
        document.body.classList.add("zen-hide-sidebar");
      }
      if (settings.hidePanel) {
        document.body.classList.add("zen-hide-panel");
      }
      if (settings.hideStatusBar) {
        document.body.classList.add("zen-hide-statusbar");
      }
      if (settings.hideActivityBar) {
        document.body.classList.add("zen-hide-activitybar");
      }
      if (settings.hideMenuBar) {
        document.body.classList.add("zen-hide-menubar");
      }
      if (settings.hideTabs) {
        document.body.classList.add("zen-hide-tabs");
      }
      if (settings.centerLayout) {
        document.body.classList.add("zen-center-layout");
      }
      document.body.classList.add("zen-mode-active");
    } else {
      document.body.classList.remove(...ZEN_BODY_CLASSES);
    }
  });

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);

    if (!document.getElementById("zen-mode-styles")) {
      const style = document.createElement("style");
      style.id = "zen-mode-styles";
      style.textContent = `
        .zen-hide-sidebar [data-sidebar],
        .zen-hide-sidebar .sidebar-container { display: none !important; }
        .zen-hide-panel [data-panel],
        .zen-hide-panel .panel-container { display: none !important; }
        .zen-hide-statusbar [data-statusbar],
        .zen-hide-statusbar .statusbar-container { display: none !important; }
        .zen-hide-activitybar [data-activitybar],
        .zen-hide-activitybar .activitybar-container { display: none !important; }
        .zen-hide-menubar [data-menubar],
        .zen-hide-menubar .menubar-container { display: none !important; }
        .zen-hide-tabs [data-tabs],
        .zen-hide-tabs .tabs-container { display: none !important; }
        .zen-center-layout .editor-container {
          max-width: var(--zen-max-width, 900px);
          margin: 0 auto;
        }
      `;
      document.head.appendChild(style);
    }

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      if (chordTimeout) clearTimeout(chordTimeout);
      document.body.classList.remove(...ZEN_BODY_CLASSES);
    });
  });

  createEffect(() => {
    const settings = zenSettings();
    document.documentElement.style.setProperty(
      "--zen-max-width",
      settings.maxWidth,
    );
  });

  const containerStyle = (): JSX.CSSProperties => ({
    display: zenMode.isActive() ? "block" : "none",
    ...props.style,
  });

  return (
    <div class={props.class} style={containerStyle()}>
      <Show when={chordActive()}>
        <div
          style={{
            position: "fixed",
            bottom: "40px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "8px 16px",
            background:
              "var(--cortex-bg-secondary, rgba(30, 30, 30, 0.9))",
            color: "var(--cortex-text-primary, #fff)",
            "border-radius": "var(--cortex-radius-md, 8px)",
            "font-size": "13px",
            "z-index": "10000",
            "backdrop-filter": "blur(8px)",
            border:
              "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
          }}
        >
          Press <strong>Z</strong> to toggle Zen Mode
        </div>
      </Show>
    </div>
  );
};

export default ZenMode;
