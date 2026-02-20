import {
  createContext,
  useContext,
  ParentProps,
  Accessor,
  createSignal,
} from "solid-js";
import {
  ZenModeState,
  ZenModeActions,
  EnhancedZenModeSettings,
  useZenMode as useZenModeHook,
  ZenModeProvider as ZenModeProviderComponent,
  zenModeActive,
  zenModeFullscreen,
  zenModeSavedState,
  enterZenMode,
  exitZenMode,
  enterFullscreen,
  exitFullscreen,
  updateZenModeSettings,
  DEFAULT_ZEN_MODE_SETTINGS,
  getZenModeTransitionStyle,
  zenModeClasses,
} from "@/components/ZenMode";

export interface PreviousLayoutState {
  sidebarVisible: boolean;
  panelVisible: boolean;
  statusBarVisible: boolean;
  activityBarVisible: boolean;
  menuBarVisible: boolean;
  tabsVisible: boolean;
}

const DEFAULT_PREVIOUS_LAYOUT: PreviousLayoutState = {
  sidebarVisible: true,
  panelVisible: true,
  statusBarVisible: true,
  activityBarVisible: true,
  menuBarVisible: true,
  tabsVisible: true,
};

export interface ZenModeContextValue {
  state: Accessor<ZenModeState>;
  actions: ZenModeActions;
  isActive: Accessor<boolean>;
  isFullscreen: Accessor<boolean>;
  isZenMode: Accessor<boolean>;
  previousLayoutState: Accessor<PreviousLayoutState>;
  setPreviousLayoutState: (state: PreviousLayoutState) => void;
}

const ZenModeContext = createContext<ZenModeContextValue>();

export function ZenModeContextProvider(props: ParentProps) {
  const { state, actions } = useZenModeHook();
  const [previousLayoutState, setPreviousLayoutState] =
    createSignal<PreviousLayoutState>(DEFAULT_PREVIOUS_LAYOUT);

  const isZenMode = () => zenModeActive();

  const contextValue: ZenModeContextValue = {
    state,
    actions,
    isActive: zenModeActive,
    isFullscreen: zenModeFullscreen,
    isZenMode,
    previousLayoutState,
    setPreviousLayoutState,
  };

  return (
    <ZenModeProviderComponent>
      <ZenModeContext.Provider value={contextValue}>
        {props.children}
      </ZenModeContext.Provider>
    </ZenModeProviderComponent>
  );
}

export function useZenModeContext(): ZenModeContextValue {
  const ctx = useContext(ZenModeContext);
  if (!ctx) {
    throw new Error(
      "useZenModeContext must be used within ZenModeContextProvider",
    );
  }
  return ctx;
}

export {
  zenModeActive,
  zenModeFullscreen,
  zenModeSavedState,
  enterZenMode,
  exitZenMode,
  enterFullscreen,
  exitFullscreen,
  updateZenModeSettings,
  DEFAULT_ZEN_MODE_SETTINGS,
  getZenModeTransitionStyle,
  zenModeClasses,
};

export type {
  ZenModeState,
  ZenModeActions,
  EnhancedZenModeSettings,
  PreviousLayoutState as ZenModePreviousLayoutState,
};
