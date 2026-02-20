import { produce, reconcile, type SetStoreFunction } from "solid-js/store";
import type {
  ColorCustomizations,
  ColorCategory,
} from "./types";
import { DEFAULT_CUSTOMIZATIONS } from "./types";
import {
  darkColors,
  lightColors,
  darkEditorColors,
  lightEditorColors,
  darkSyntaxColors,
  lightSyntaxColors,
  darkTerminalColors,
  lightTerminalColors,
} from "./defaultColors";
import {
  isValidHexColor,
  saveCustomizationsToStorage,
} from "./themeHelpers";

// ============================================================================
// Theme Customization Handlers
// ============================================================================

export function createThemeCustomizations(
  customizations: ColorCustomizations,
  setCustomizations: SetStoreFunction<ColorCustomizations>,
  isDark: () => boolean,
) {
  // --------------------------------------------------------------------------
  // Default Colors
  // --------------------------------------------------------------------------

  const getDefaultColors = () => ({
    ui: isDark() ? darkColors : lightColors,
    editor: isDark() ? darkEditorColors : lightEditorColors,
    syntax: isDark() ? darkSyntaxColors : lightSyntaxColors,
    terminal: isDark() ? darkTerminalColors : lightTerminalColors,
  });

  // --------------------------------------------------------------------------
  // Set / Remove Individual Customizations
  // --------------------------------------------------------------------------

  const setColorCustomization = <C extends ColorCategory>(
    category: C,
    token: string,
    color: string,
  ) => {
    if (!isValidHexColor(color)) {
      console.warn(`[Theme] Invalid color format: ${color}. Expected hex color.`);
      return;
    }

    setCustomizations(produce((draft) => {
      (draft[category] as Record<string, string>)[token] = color;
    }));
    saveCustomizationsToStorage({
      ...customizations,
      [category]: { ...customizations[category], [token]: color },
    });

    window.dispatchEvent(new CustomEvent("theme:color-changed", {
      detail: { category, token, color },
    }));
  };

  const removeColorCustomization = <C extends ColorCategory>(
    category: C,
    token: string,
  ) => {
    const newCategoryCustomizations = { ...customizations[category] };
    delete (newCategoryCustomizations as Record<string, string>)[token];

    setCustomizations(category, reconcile(newCategoryCustomizations));
    saveCustomizationsToStorage({
      ...customizations,
      [category]: newCategoryCustomizations,
    });

    window.dispatchEvent(new CustomEvent("theme:color-changed", {
      detail: { category, token, color: null },
    }));
  };

  // --------------------------------------------------------------------------
  // Reset Customizations
  // --------------------------------------------------------------------------

  const resetCustomizations = () => {
    setCustomizations(reconcile(DEFAULT_CUSTOMIZATIONS));
    saveCustomizationsToStorage(DEFAULT_CUSTOMIZATIONS);
    window.dispatchEvent(new CustomEvent("theme:customizations-reset"));
  };

  const resetCategoryCustomizations = (category: ColorCategory) => {
    setCustomizations(category, reconcile({}));
    saveCustomizationsToStorage({
      ...customizations,
      [category]: {},
    });
    window.dispatchEvent(new CustomEvent("theme:category-reset", {
      detail: { category },
    }));
  };

  // --------------------------------------------------------------------------
  // Import / Export
  // --------------------------------------------------------------------------

  const exportCustomizations = (): string => {
    return JSON.stringify(customizations, null, 2);
  };

  const importCustomizations = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);

      if (typeof parsed !== "object" || parsed === null) {
        console.error("[Theme] Invalid import format: expected object");
        return false;
      }

      const validated: ColorCustomizations = {
        ui: {},
        editor: {},
        syntax: {},
        terminal: {},
      };

      for (const category of ["ui", "editor", "syntax", "terminal"] as const) {
        if (parsed[category] && typeof parsed[category] === "object") {
          for (const [token, color] of Object.entries(parsed[category])) {
            if (typeof color === "string" && isValidHexColor(color)) {
              (validated[category] as Record<string, string>)[token] = color;
            }
          }
        }
      }

      setCustomizations(reconcile(validated));
      saveCustomizationsToStorage(validated);
      window.dispatchEvent(new CustomEvent("theme:customizations-imported"));

      return true;
    } catch (e) {
      console.error("[Theme] Failed to import customizations:", e);
      return false;
    }
  };

  // --------------------------------------------------------------------------
  // Query Helpers
  // --------------------------------------------------------------------------

  const hasCustomization = (category: ColorCategory, token: string): boolean => {
    return token in customizations[category];
  };

  const customizationCount = (): number => {
    return (
      Object.keys(customizations.ui).length +
      Object.keys(customizations.editor).length +
      Object.keys(customizations.syntax).length +
      Object.keys(customizations.terminal).length
    );
  };

  return {
    getDefaultColors,
    setColorCustomization,
    removeColorCustomization,
    resetCustomizations,
    resetCategoryCustomizations,
    exportCustomizations,
    importCustomizations,
    hasCustomization,
    customizationCount,
  };
}
