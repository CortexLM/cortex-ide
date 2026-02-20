import { createContext, useContext, ParentProps, createSignal, createMemo } from "solid-js";
import type { IconDefinition, IconTheme, IconThemeState, IconThemeContextValue } from "./types";
import { BUILTIN_THEMES, setiTheme } from "./themes";
import { createLogger } from "@/utils/logger";

const log = createLogger("IconTheme");

const STORAGE_KEY = "cortex-icon-theme";
const ASSOCIATIONS_STORAGE_KEY = "cortex-icon-file-associations";
const DEFAULT_THEME_ID = "seti";

function loadThemeIdFromStorage(): string {
  if (typeof localStorage === "undefined") {
    return DEFAULT_THEME_ID;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as IconThemeState;
      if (parsed.activeThemeId && typeof parsed.activeThemeId === "string") {
        return parsed.activeThemeId;
      }
    }
  } catch (e) {
    log.error("Failed to load theme from storage:", e);
  }
  return DEFAULT_THEME_ID;
}

function saveThemeToStorage(themeId: string): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    const state: IconThemeState = { activeThemeId: themeId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    log.error("Failed to save theme to storage:", e);
  }
}

function loadAssociationsFromStorage(): Record<string, IconDefinition> {
  if (typeof localStorage === "undefined") {
    return {};
  }
  try {
    const stored = localStorage.getItem(ASSOCIATIONS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, IconDefinition>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    log.error("Failed to load file associations from storage:", e);
  }
  return {};
}

function saveAssociationsToStorage(associations: Record<string, IconDefinition>): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(ASSOCIATIONS_STORAGE_KEY, JSON.stringify(associations));
  } catch (e) {
    log.error("Failed to save file associations to storage:", e);
  }
}

function isValidIconDefinition(value: unknown): value is IconDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as IconDefinition).icon === "string" &&
    typeof (value as IconDefinition).color === "string"
  );
}

function isValidIconTheme(value: unknown): value is IconTheme {
  if (typeof value !== "object" || value === null) return false;
  const theme = value as IconTheme;
  if (typeof theme.id !== "string" || theme.id.length === 0) return false;
  if (typeof theme.name !== "string" || theme.name.length === 0) return false;
  if (typeof theme.description !== "string") return false;
  if (typeof theme.icons !== "object" || theme.icons === null) return false;
  const { icons } = theme;
  if (!isValidIconDefinition(icons.file)) return false;
  if (!isValidIconDefinition(icons.folder)) return false;
  if (!isValidIconDefinition(icons.folderOpen)) return false;
  if (typeof icons.fileExtensions !== "object" || icons.fileExtensions === null) return false;
  if (typeof icons.fileNames !== "object" || icons.fileNames === null) return false;
  if (typeof icons.folderNames !== "object" || icons.folderNames === null) return false;
  if (typeof icons.folderNamesOpen !== "object" || icons.folderNamesOpen === null) return false;
  return true;
}

function matchesPattern(pattern: string, filename: string): boolean {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1).toLowerCase();
    return filename.toLowerCase().endsWith(suffix);
  }
  return pattern.toLowerCase() === filename.toLowerCase();
}

function resolveCustomAssociation(
  associations: Record<string, IconDefinition>,
  filename: string,
): IconDefinition | undefined {
  const lowerFilename = filename.toLowerCase();
  if (associations[filename]) return associations[filename];
  if (associations[lowerFilename]) return associations[lowerFilename];
  for (const pattern of Object.keys(associations)) {
    if (pattern.startsWith("*.") && matchesPattern(pattern, filename)) {
      return associations[pattern];
    }
  }
  return undefined;
}

const IconThemeContext = createContext<IconThemeContextValue>();

export function IconThemeProvider(props: ParentProps) {
  const [activeThemeId, setActiveThemeId] = createSignal<string>(loadThemeIdFromStorage());
  const [pluginThemes, setPluginThemes] = createSignal<IconTheme[]>([]);
  const [customAssocs, setCustomAssocs] = createSignal<Record<string, IconDefinition>>(
    loadAssociationsFromStorage(),
  );

  const themes = createMemo(() => [...BUILTIN_THEMES, ...pluginThemes()]);

  const activeTheme = createMemo(() => {
    const id = activeThemeId();
    const allThemes = themes();
    const theme = allThemes.find((t) => t.id === id);
    return theme ?? setiTheme;
  });

  const setIconTheme = (id: string) => {
    const allThemes = themes();
    const themeExists = allThemes.some((t) => t.id === id);
    if (!themeExists) {
      log.warn(`Theme "${id}" not found, ignoring`);
      return;
    }
    setActiveThemeId(id);
    saveThemeToStorage(id);
    window.dispatchEvent(
      new CustomEvent("icon-theme:changed", {
        detail: { themeId: id },
      }),
    );
  };

  const registerTheme = (theme: IconTheme) => {
    if (!isValidIconTheme(theme)) {
      log.warn("Invalid theme provided to registerTheme, ignoring");
      return;
    }
    if (BUILTIN_THEMES.some((t) => t.id === theme.id)) {
      log.warn(`Cannot override built-in theme "${theme.id}"`);
      return;
    }
    setPluginThemes((prev) => {
      const filtered = prev.filter((t) => t.id !== theme.id);
      return [...filtered, theme];
    });
    log.info(`Registered plugin theme "${theme.name}" (${theme.id})`);
  };

  const setFileAssociation = (pattern: string, icon: IconDefinition) => {
    if (typeof pattern !== "string" || pattern.length === 0) return;
    if (!isValidIconDefinition(icon)) return;
    setCustomAssocs((prev) => {
      const next = { ...prev, [pattern]: icon };
      saveAssociationsToStorage(next);
      return next;
    });
  };

  const removeFileAssociation = (pattern: string) => {
    if (typeof pattern !== "string" || pattern.length === 0) return;
    setCustomAssocs((prev) => {
      if (!(pattern in prev)) return prev;
      const next = { ...prev };
      delete next[pattern];
      saveAssociationsToStorage(next);
      return next;
    });
  };

  const getFileIcon = (filename: string): IconDefinition => {
    const associations = customAssocs();
    const customMatch = resolveCustomAssociation(associations, filename);
    if (customMatch) return customMatch;

    const theme = activeTheme();
    const lowerFilename = filename.toLowerCase();

    if (theme.icons.fileNames[filename]) {
      return theme.icons.fileNames[filename];
    }
    if (theme.icons.fileNames[lowerFilename]) {
      return theme.icons.fileNames[lowerFilename];
    }

    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex > 0 && lastDotIndex < filename.length - 1) {
      const extension = filename.slice(lastDotIndex + 1).toLowerCase();
      if (theme.icons.fileExtensions[extension]) {
        return theme.icons.fileExtensions[extension];
      }
    }

    if (filename.startsWith(".") && !filename.includes(".", 1)) {
      const configName = filename.toLowerCase();
      if (theme.icons.fileNames[configName]) {
        return theme.icons.fileNames[configName];
      }
    }

    return theme.icons.file;
  };

  const getFolderIcon = (name: string, open: boolean): IconDefinition => {
    const theme = activeTheme();
    const lowerName = name.toLowerCase();

    if (open) {
      if (theme.icons.folderNamesOpen[name]) {
        return theme.icons.folderNamesOpen[name];
      }
      if (theme.icons.folderNamesOpen[lowerName]) {
        return theme.icons.folderNamesOpen[lowerName];
      }
      if (theme.icons.folderNames[name]) {
        return { ...theme.icons.folderNames[name], icon: theme.icons.folderOpen.icon };
      }
      if (theme.icons.folderNames[lowerName]) {
        return { ...theme.icons.folderNames[lowerName], icon: theme.icons.folderOpen.icon };
      }
      return theme.icons.folderOpen;
    }

    if (theme.icons.folderNames[name]) {
      return theme.icons.folderNames[name];
    }
    if (theme.icons.folderNames[lowerName]) {
      return theme.icons.folderNames[lowerName];
    }
    return theme.icons.folder;
  };

  const loadThemeFromJSON = (json: string): IconTheme | null => {
    try {
      const parsed: unknown = JSON.parse(json);
      if (isValidIconTheme(parsed)) {
        return parsed;
      }
      log.warn("JSON does not conform to IconTheme schema");
      return null;
    } catch (e) {
      log.error("Failed to parse icon theme JSON:", e);
      return null;
    }
  };

  const value: IconThemeContextValue = {
    activeTheme,
    themes,
    setIconTheme,
    getFileIcon,
    getFolderIcon,
    registerTheme,
    setFileAssociation,
    removeFileAssociation,
    customAssociations: customAssocs,
    loadThemeFromJSON,
  };

  return <IconThemeContext.Provider value={value}>{props.children}</IconThemeContext.Provider>;
}

export function useIconTheme() {
  const ctx = useContext(IconThemeContext);
  if (!ctx) {
    throw new Error("useIconTheme must be used within IconThemeProvider");
  }
  return ctx;
}

export { BUILTIN_THEMES };
