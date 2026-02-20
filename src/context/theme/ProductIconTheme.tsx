import {
  createContext,
  useContext,
  createSignal,
  createMemo,
  createEffect,
  onCleanup,
} from "solid-js";
import type { ParentProps } from "solid-js";

// ============================================================================
// Types
// ============================================================================

export interface ProductIconDefinition {
  fontCharacter: string;
  fontColor?: string;
}

export interface ProductIconFont {
  id: string;
  src: { path: string; format: string }[];
  weight?: string;
  style?: string;
}

export interface ProductIconTheme {
  id: string;
  name: string;
  description: string;
  iconFont?: ProductIconFont[];
  iconDefinitions: Record<string, ProductIconDefinition>;
}

export interface ProductIconThemeContextValue {
  activeTheme: () => ProductIconTheme;
  themes: () => ProductIconTheme[];
  setProductIconTheme: (id: string) => void;
  registerTheme: (theme: ProductIconTheme) => void;
  getIcon: (iconId: string) => ProductIconDefinition | undefined;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "cortex-product-icon-theme";
const DEFAULT_THEME_ID = "codicon";
const FONT_STYLE_ID = "product-icon-font-styles";

// ============================================================================
// Default Codicon Theme
// ============================================================================

const CODICON_THEME: ProductIconTheme = {
  id: DEFAULT_THEME_ID,
  name: "Default (Codicons)",
  description: "The default VS Code-style product icons using the Codicons font",
  iconDefinitions: {
    "activity-bar-explorer": { fontCharacter: "\uEB60" },
    "activity-bar-search": { fontCharacter: "\uEB51" },
    "activity-bar-scm": { fontCharacter: "\uEB1F" },
    "activity-bar-debug": { fontCharacter: "\uEAFC" },
    "activity-bar-extensions": { fontCharacter: "\uEB07" },
    "activity-bar-accounts": { fontCharacter: "\uEB99" },
    "activity-bar-settings": { fontCharacter: "\uEB52" },
    "activity-bar-terminal": { fontCharacter: "\uEB63" },
    "activity-bar-ai": { fontCharacter: "\uEBCA" },
    "activity-bar-remote": { fontCharacter: "\uEB39" },
    "status-bar-error": { fontCharacter: "\uEA87" },
    "status-bar-warning": { fontCharacter: "\uEA6C" },
    "status-bar-info": { fontCharacter: "\uEA74" },
    "status-bar-sync": { fontCharacter: "\uEB4C" },
    "status-bar-bell": { fontCharacter: "\uEA79" },
    "status-bar-check": { fontCharacter: "\uEAB2" },
    "status-bar-feedback": { fontCharacter: "\uEB16" },
    "status-bar-git-branch": { fontCharacter: "\uEA68" },
    "title-bar-close": { fontCharacter: "\uEAB8" },
    "title-bar-maximize": { fontCharacter: "\uEB71" },
    "title-bar-minimize": { fontCharacter: "\uEB72" },
    "title-bar-restore": { fontCharacter: "\uEB73" },
    "command-palette-search": { fontCharacter: "\uEB51" },
    "command-palette-run": { fontCharacter: "\uEB91" },
    "command-palette-gear": { fontCharacter: "\uEB52" },
    "panel-close": { fontCharacter: "\uEAB8" },
    "panel-maximize": { fontCharacter: "\uEB71" },
    "panel-restore": { fontCharacter: "\uEB73" },
    "chevron-right": { fontCharacter: "\uEABF" },
    "chevron-down": { fontCharacter: "\uEABD" },
    "chevron-up": { fontCharacter: "\uEABC" },
    "arrow-left": { fontCharacter: "\uEA8F" },
    "arrow-right": { fontCharacter: "\uEA90" },
    "ellipsis": { fontCharacter: "\uEA7C" },
    "add": { fontCharacter: "\uEA60" },
    "close": { fontCharacter: "\uEAB8" },
    "refresh": { fontCharacter: "\uEB37" },
    "edit": { fontCharacter: "\uEA6F" },
    "save": { fontCharacter: "\uEB4A" },
    "trash": { fontCharacter: "\uEA81" },
    "copy": { fontCharacter: "\uEABE" },
    "pin": { fontCharacter: "\uEB2E" },
    "unpin": { fontCharacter: "\uEB2F" },
    "split-horizontal": { fontCharacter: "\uEB56" },
    "split-vertical": { fontCharacter: "\uEB57" },
    "debug-start": { fontCharacter: "\uEB91" },
    "debug-stop": { fontCharacter: "\uEAD5" },
    "debug-pause": { fontCharacter: "\uEAD0" },
    "debug-continue": { fontCharacter: "\uEACF" },
    "debug-step-over": { fontCharacter: "\uEAD4" },
    "debug-step-into": { fontCharacter: "\uEAD2" },
    "debug-step-out": { fontCharacter: "\uEAD3" },
    "debug-restart": { fontCharacter: "\uEAD1" },
    "notification-info": { fontCharacter: "\uEA74" },
    "notification-warning": { fontCharacter: "\uEA6C" },
    "notification-error": { fontCharacter: "\uEB45" },
  },
};

// ============================================================================
// Storage Helpers
// ============================================================================

function loadThemeIdFromStorage(): string {
  if (typeof localStorage === "undefined") {
    return DEFAULT_THEME_ID;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && typeof stored === "string") {
      return stored;
    }
  } catch {
    /* storage unavailable */
  }

  return DEFAULT_THEME_ID;
}

function saveThemeIdToStorage(themeId: string): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, themeId);
  } catch {
    /* storage unavailable */
  }
}

// ============================================================================
// Icon Font CSS Generation
// ============================================================================

function buildFontFaceCss(fonts: ProductIconFont[]): string {
  return fonts
    .map((font) => {
      const srcEntries = font.src
        .map((s) => `url("${s.path}") format("${s.format}")`)
        .join(", ");
      const weight = font.weight ?? "normal";
      const style = font.style ?? "normal";

      return [
        `@font-face {`,
        `  font-family: "${font.id}";`,
        `  font-display: block;`,
        `  src: ${srcEntries};`,
        `  font-weight: ${weight};`,
        `  font-style: ${style};`,
        `}`,
      ].join("\n");
    })
    .join("\n\n");
}

function applyFontStyles(css: string): void {
  let styleEl = document.getElementById(FONT_STYLE_ID) as HTMLStyleElement | null;

  if (!css) {
    if (styleEl) {
      styleEl.remove();
    }
    return;
  }

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = FONT_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = css;
}

// ============================================================================
// Context
// ============================================================================

const ProductIconThemeContext = createContext<ProductIconThemeContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function ProductIconThemeProvider(props: ParentProps) {
  const [activeThemeId, setActiveThemeId] = createSignal(loadThemeIdFromStorage());
  const [registeredThemes, setRegisteredThemes] = createSignal<ProductIconTheme[]>([]);

  const allThemes = createMemo(() => [CODICON_THEME, ...registeredThemes()]);

  const activeTheme = createMemo(() => {
    const id = activeThemeId();
    return allThemes().find((t) => t.id === id) ?? CODICON_THEME;
  });

  const themes = () => allThemes();

  const setProductIconTheme = (id: string) => {
    const exists = allThemes().some((t) => t.id === id);
    if (!exists) {
      return;
    }

    setActiveThemeId(id);
    saveThemeIdToStorage(id);

    window.dispatchEvent(
      new CustomEvent("product-icon-theme:changed", {
        detail: { themeId: id },
      }),
    );
  };

  const registerTheme = (theme: ProductIconTheme) => {
    if (
      !theme.id ||
      !theme.name ||
      typeof theme.iconDefinitions !== "object" ||
      theme.iconDefinitions === null
    ) {
      return;
    }

    setRegisteredThemes((prev) => {
      if (prev.some((t) => t.id === theme.id)) {
        return prev.map((t) => (t.id === theme.id ? theme : t));
      }
      return [...prev, theme];
    });
  };

  const getIcon = (iconId: string): ProductIconDefinition | undefined => {
    return activeTheme().iconDefinitions[iconId];
  };

  createEffect(() => {
    const theme = activeTheme();
    const fonts = theme.iconFont;

    if (fonts && fonts.length > 0) {
      applyFontStyles(buildFontFaceCss(fonts));
    } else {
      applyFontStyles("");
    }
  });

  onCleanup(() => {
    const styleEl = document.getElementById(FONT_STYLE_ID);
    if (styleEl) {
      styleEl.remove();
    }
  });

  const value: ProductIconThemeContextValue = {
    activeTheme,
    themes,
    setProductIconTheme,
    registerTheme,
    getIcon,
  };

  return (
    <ProductIconThemeContext.Provider value={value}>
      {props.children}
    </ProductIconThemeContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================
export function useProductIconTheme(): ProductIconThemeContextValue {
  const ctx = useContext(ProductIconThemeContext);
  if (!ctx) {
    throw new Error("useProductIconTheme must be used within ProductIconThemeProvider");
  }
  return ctx;
}
