import {
  loadAndConvertVSCodeTheme as loadTheme,
  convertVSCodeTheme,
  convertWorkbenchColors,
  convertEditorColors,
  convertSyntaxColors,
  convertTerminalColors,
  type CortexTheme,
  type VSCodeThemeJSON,
} from "@/utils/theme-converter";
import { applyThemeToMonaco } from "@/utils/monaco-theme";
import type {
  Theme,
  ThemeColors,
  EditorColors,
  SyntaxColors,
  TerminalColors,
  ColorCustomizations,
} from "./types";
import { DEFAULT_CUSTOMIZATIONS } from "./types";
import { saveCustomizationsToStorage } from "./themeHelpers";

import { reconcile } from "solid-js/store";
import type { SetStoreFunction } from "solid-js/store";
import type { Setter } from "solid-js";

interface VSCodeThemeDeps {
  setCustomizations: SetStoreFunction<ColorCustomizations>;
  setActiveVSCodeTheme: Setter<CortexTheme | null>;
  setThemeState: Setter<Theme>;
  activeVSCodeTheme: () => CortexTheme | null;
}

function applyCortexThemeColors(
  ct: CortexTheme,
  setCustomizations: SetStoreFunction<ColorCustomizations>,
): void {
  const wb = convertWorkbenchColors(ct.colors, ct.type);
  const ed = convertEditorColors(ct.colors, ct.type);
  const syn = convertSyntaxColors(ct.tokenColors, ct.type);
  const term = convertTerminalColors(ct.colors, ct.type);

  const customizations = {
    ui: wb as unknown as Partial<ThemeColors>,
    editor: ed as unknown as Partial<EditorColors>,
    syntax: syn as unknown as Partial<SyntaxColors>,
    terminal: term as unknown as Partial<TerminalColors>,
  };

  setCustomizations(reconcile(customizations));
  saveCustomizationsToStorage(customizations);
}

export function createVSCodeThemeHandlers(deps: VSCodeThemeDeps) {
  const {
    setCustomizations,
    setActiveVSCodeTheme,
    setThemeState,
    activeVSCodeTheme,
  } = deps;

  const applyCortexTheme = (ct: CortexTheme): void => {
    applyCortexThemeColors(ct, setCustomizations);
  };

  const applyVSCodeExtensionTheme = async (themePath: string): Promise<void> => {
    try {
      const cortexTheme = await loadTheme(themePath);
      setActiveVSCodeTheme(cortexTheme);
      applyCortexTheme(cortexTheme);

      if (cortexTheme.type === "light") {
        setThemeState("light");
      } else {
        setThemeState("dark");
      }

      window.dispatchEvent(new CustomEvent("theme:vscode-extension-applied", {
        detail: { theme: cortexTheme, path: themePath },
      }));
    } catch (error) {
      console.error("[Theme] Failed to load VS Code extension theme:", error);
      throw error;
    }
  };

  const clearVSCodeExtensionTheme = (): void => {
    setActiveVSCodeTheme(null);
    setCustomizations(reconcile(DEFAULT_CUSTOMIZATIONS));
    saveCustomizationsToStorage(DEFAULT_CUSTOMIZATIONS);
    window.dispatchEvent(new CustomEvent("theme:vscode-extension-cleared"));
  };

  const applyVSCodeExtensionThemeFromJSON = (json: VSCodeThemeJSON, name?: string): void => {
    const cortexTheme = convertVSCodeTheme(json, name);
    setActiveVSCodeTheme(cortexTheme);
    applyCortexTheme(cortexTheme);

    if (cortexTheme.type === "light") {
      setThemeState("light");
    } else {
      setThemeState("dark");
    }

    window.dispatchEvent(new CustomEvent("theme:vscode-extension-applied", {
      detail: { theme: cortexTheme },
    }));
  };

  const applyVSCodeThemeToMonaco = (monaco: typeof import("monaco-editor")): void => {
    const ct = activeVSCodeTheme();
    if (ct) {
      applyThemeToMonaco(monaco, ct);
    }
  };

  return {
    applyCortexTheme,
    applyVSCodeExtensionTheme,
    clearVSCodeExtensionTheme,
    applyVSCodeExtensionThemeFromJSON,
    applyVSCodeThemeToMonaco,
  };
}
