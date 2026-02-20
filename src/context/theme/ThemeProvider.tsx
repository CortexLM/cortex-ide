import { createContext, useContext, ParentProps, createSignal, createEffect, createMemo, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import type { CortexTheme } from "@/utils/theme-converter";
import type {
  Theme, ThemeColors, EditorColors, SyntaxColors, TerminalColors,
  ColorCustomizations, ThemeContextValue, PluginThemeContribution,
} from "./types";
import {
  darkColors, lightColors,
  darkEditorColors, lightEditorColors,
  darkSyntaxColors, lightSyntaxColors,
  darkTerminalColors, lightTerminalColors,
} from "./defaultColors";
import { loadCustomizationsFromStorage } from "./themeHelpers";
import { applyCssVariables } from "./applyCssVariables";
import { createVSCodeThemeHandlers } from "./vscodeTheme";
import { createThemeCustomizations } from "./themeCustomizations";
import { resolveHcBaseType, fetchHcTheme, loadBuiltInTheme, applyThemeColors } from "./builtInThemes";
import { syncThemeToMonaco } from "./monacoThemeSync";
import { invoke } from "@tauri-apps/api/core";

export type { CortexTheme } from "@/utils/theme-converter";

const ThemeContext = createContext<ThemeContextValue>();

const TRANSITION_STYLES = `
  .theme-transitioning,
  .theme-transitioning * {
    transition: background-color 300ms ease-out,
                color 300ms ease-out,
                border-color 300ms ease-out,
                fill 300ms ease-out,
                stroke 300ms ease-out,
                box-shadow 300ms ease-out !important;
  }
`;

export function ThemeProvider(props: ParentProps) {
  const storedTheme = typeof localStorage !== "undefined"
    ? (localStorage.getItem("cortex-theme") as Theme | null)
    : null;
  const [theme, setThemeState] = createSignal<Theme>(storedTheme || "dark");
  const [previewTheme, setPreviewTheme] = createSignal<Theme | null>(null);
  const [_isTransitioning, setIsTransitioning] = createSignal(false);
  const [customizations, setCustomizations] = createStore<ColorCustomizations>(
    loadCustomizationsFromStorage()
  );
  const [activeVSCodeTheme, setActiveVSCodeTheme] = createSignal<CortexTheme | null>(null);
  const [systemIsDark, setSystemIsDark] = createSignal(
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : true
  );
  const [pluginThemes, setPluginThemes] = createSignal<PluginThemeContribution[]>([]);
  const [fileIconThemeId, setFileIconThemeIdState] = createSignal(
    typeof localStorage !== "undefined" ? (localStorage.getItem("cortex-file-icon-theme") || "seti") : "seti"
  );
  const [productIconThemeId, setProductIconThemeIdState] = createSignal(
    typeof localStorage !== "undefined" ? (localStorage.getItem("cortex-product-icon-theme") || "default-codicons") : "default-codicons"
  );

  const setFileIconThemeId = (id: string) => {
    setFileIconThemeIdState(id);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("cortex-file-icon-theme", id);
    }
  };

  const setProductIconThemeId = (id: string) => {
    setProductIconThemeIdState(id);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("cortex-product-icon-theme", id);
    }
  };

  const loadBackendTheme = async (path: string): Promise<void> => {
    try {
      const themeData = await invoke<any>("load_theme_file", { path });
      if (themeData && themeData.colors) {
        const baseType = themeData.themeType === "light" ? "light" : "dark";
        applyThemeColors(themeData.colors, themeData.tokenColors, baseType as "dark" | "light", setCustomizations);
        setThemeState(baseType as Theme);
      }
    } catch (e) {
      console.error("[ThemeProvider] Failed to load backend theme:", e);
    }
  };

  const listBackendThemes = async () => {
    try {
      return await invoke<any[]>("list_available_themes");
    } catch (e) {
      console.error("[ThemeProvider] Failed to list backend themes:", e);
      return [];
    }
  };

  const isPreviewActive = () => previewTheme() !== null;
  const effectiveTheme = createMemo(() => {
    const preview = previewTheme();
    return preview !== null ? preview : theme();
  });
  const isDark = () => {
    const t = effectiveTheme();
    if (t === "system") return systemIsDark();
    if (t === "high-contrast") return true;
    if (t === "high-contrast-light") return false;
    return t === "dark";
  };

  // ============================================================================
  // Theme Transition Helpers
  // ============================================================================

  const withTransition = (fn: () => void) => {
    setIsTransitioning(true);
    document.documentElement.classList.add("theme-transitioning");
    fn();
    requestAnimationFrame(() => {
      setTimeout(() => {
        setIsTransitioning(false);
        document.documentElement.classList.remove("theme-transitioning");
      }, 300);
    });
  };

  const startPreview = (themeToPreview: Theme) => {
    if (themeToPreview === theme() && !isPreviewActive()) return;
    withTransition(() => setPreviewTheme(themeToPreview));
    window.dispatchEvent(new CustomEvent("theme:preview-started", {
      detail: { theme: themeToPreview },
    }));
  };

  const stopPreview = () => {
    if (!isPreviewActive()) return;
    withTransition(() => setPreviewTheme(null));
    window.dispatchEvent(new CustomEvent("theme:preview-stopped"));
  };

  const applyPreviewedTheme = () => {
    const preview = previewTheme();
    if (preview === null) return;
    setPreviewTheme(null);
    setThemeState(preview);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("cortex-theme", preview);
    }
    window.dispatchEvent(new CustomEvent("theme:preview-applied", {
      detail: { theme: preview },
    }));
  };

  // ============================================================================
  // Color Customization Handlers
  // ============================================================================

  const customizationHandlers = createThemeCustomizations(
    customizations,
    setCustomizations,
    isDark,
  );

  // ============================================================================
  // Computed Color Values
  // ============================================================================

  const colors = createMemo(() => {
    const defaults = isDark() ? darkColors : lightColors;
    return { ...defaults, ...customizations.ui } as ThemeColors;
  });
  const editorColors = createMemo(() => {
    const defaults = isDark() ? darkEditorColors : lightEditorColors;
    return { ...defaults, ...customizations.editor } as EditorColors;
  });
  const syntaxColors = createMemo(() => {
    const defaults = isDark() ? darkSyntaxColors : lightSyntaxColors;
    return { ...defaults, ...customizations.syntax } as SyntaxColors;
  });
  const terminalColors = createMemo(() => {
    const defaults = isDark() ? darkTerminalColors : lightTerminalColors;
    return { ...defaults, ...customizations.terminal } as TerminalColors;
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("cortex-theme", t);
    }
  };

  // ============================================================================
  // Plugin Theme Support
  // ============================================================================

  const registerPluginTheme = (contribution: PluginThemeContribution) => {
    setPluginThemes((prev) => {
      const filtered = prev.filter((t) => t.id !== contribution.id);
      return [...filtered, contribution];
    });
  };

  const applyPluginTheme = (id: string) => {
    const found = pluginThemes().find((t) => t.id === id);
    if (!found) return;
    const baseType = (found.type === "light" || found.type === "hcLight") ? "light" : "dark";
    applyThemeColors(found.colors, found.tokenColors, baseType, setCustomizations);
    setThemeState(baseType);
  };

  // ============================================================================
  // Built-in Theme Support
  // ============================================================================

  const [builtInThemes] = createSignal([
    { id: "dark-plus", name: "Dark+", type: "dark" },
    { id: "light-plus", name: "Light+", type: "light" },
  ]);

  const applyBuiltInTheme = async (themeId: string): Promise<void> => {
    const entry = builtInThemes().find((t) => t.id === themeId);
    if (!entry) throw new Error(`Unknown built-in theme: ${themeId}`);
    const data = await loadBuiltInTheme(themeId);
    const baseType: "dark" | "light" = data.type === "light" ? "light" : "dark";
    applyThemeColors(data.colors, data.tokenColors, baseType, setCustomizations);
    setThemeState(baseType);
    window.dispatchEvent(new CustomEvent("theme:builtin-applied", {
      detail: { themeId, name: data.name },
    }));
  };

  const loadCortexThemeFromJSON = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== "object" || !parsed.colors || !parsed.type) {
        return false;
      }
      const baseType: "dark" | "light" = parsed.type === "light" ? "light" : "dark";
      applyThemeColors(parsed.colors, parsed.tokenColors, baseType, setCustomizations);
      setThemeState(baseType);
      return true;
    } catch {
      return false;
    }
  };

  // ============================================================================
  // VS Code Theme Handlers
  // ============================================================================

  const vsCodeHandlers = createVSCodeThemeHandlers({
    setCustomizations, setActiveVSCodeTheme, setThemeState, activeVSCodeTheme,
  });

  // ============================================================================
  // Side Effects
  // ============================================================================

  createEffect(() => {
    document.documentElement.classList.toggle("dark", isDark());
  });

  createEffect(() => {
    const styleId = "theme-transition-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = TRANSITION_STYLES;
      document.head.appendChild(style);
    }
  });

  createEffect(() => {
    const ui = colors();
    const ed = editorColors();
    const syn = syntaxColors();
    const term = terminalColors();
    requestAnimationFrame(() => {
      applyCssVariables(ui, ed, syn, term);
    });
  });

  createEffect(() => {
    if (effectiveTheme() !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mql.addEventListener("change", handler);
    setSystemIsDark(mql.matches);
    onCleanup(() => mql.removeEventListener("change", handler));
  });

  createEffect(() => {
    const t = effectiveTheme();
    if (t !== "high-contrast" && t !== "high-contrast-light") return;
    fetchHcTheme(t).then((data) => {
      const baseType = resolveHcBaseType(t);
      applyThemeColors(data.colors, data.tokenColors, baseType, setCustomizations);
    });
  });

  // ============================================================================
  // Monaco Theme Sync
  // ============================================================================

  // Designed for <100ms sync to keep editor theme transitions snappy
  const syncMonacoTheme = (monaco: typeof import("monaco-editor")): void => {
    queueMicrotask(() => {
      if (activeVSCodeTheme()) {
        vsCodeHandlers.applyVSCodeThemeToMonaco(monaco);
      } else {
        syncThemeToMonaco(monaco, isDark(), editorColors(), syntaxColors(), colors());
      }
    });
  };

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: ThemeContextValue = {
    theme, setTheme, isDark,
    previewTheme, isPreviewActive, startPreview, stopPreview,
    applyPreviewedTheme, effectiveTheme,
    colors, editorColors, syntaxColors, terminalColors,
    colorCustomizations: () => customizations,
    setColorCustomization: customizationHandlers.setColorCustomization,
    removeColorCustomization: customizationHandlers.removeColorCustomization,
    resetCustomizations: customizationHandlers.resetCustomizations,
    resetCategoryCustomizations: customizationHandlers.resetCategoryCustomizations,
    exportCustomizations: customizationHandlers.exportCustomizations,
    importCustomizations: customizationHandlers.importCustomizations,
    getDefaultColors: customizationHandlers.getDefaultColors,
    hasCustomization: customizationHandlers.hasCustomization,
    customizationCount: customizationHandlers.customizationCount,
    activeVSCodeTheme,
    applyVSCodeExtensionTheme: vsCodeHandlers.applyVSCodeExtensionTheme,
    applyVSCodeExtensionThemeFromJSON: vsCodeHandlers.applyVSCodeExtensionThemeFromJSON,
    clearVSCodeExtensionTheme: vsCodeHandlers.clearVSCodeExtensionTheme,
    applyVSCodeThemeToMonaco: vsCodeHandlers.applyVSCodeThemeToMonaco,
    syncMonacoTheme,
    registerPluginTheme,
    pluginThemes,
    applyPluginTheme,
    builtInThemes,
    applyBuiltInTheme,
    loadCortexThemeFromJSON,
    fileIconThemeId,
    setFileIconThemeId,
    productIconThemeId,
    setProductIconThemeId,
    loadBackendTheme,
    listBackendThemes,
  };

  return (
    <ThemeContext.Provider value={value}>
      {props.children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
