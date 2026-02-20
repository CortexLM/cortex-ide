import { createContext, useContext, createSignal, onMount, ParentProps } from "solid-js";

export type ColorThemeId = "01" | "02" | "03" | "04" | "05";

interface CortexColorThemeContextValue {
  colorTheme: () => ColorThemeId;
  setColorTheme: (id: ColorThemeId) => void;
  accentColor: () => string;
  setAccentColor: (color: string) => void;
  customCss: () => string;
  setCustomCss: (css: string) => void;
}

const STORAGE_KEY = "cortex-color-theme";
const ACCENT_STORAGE_KEY = "cortex-accent-color";
const CUSTOM_CSS_STORAGE_KEY = "cortex-custom-css";
const DEFAULT_ACCENT = "#B2FF22";
const MAX_CUSTOM_CSS_LENGTH = 10_000;
const VALID_THEME_IDS: readonly ColorThemeId[] = ["01", "02", "03", "04", "05"];

function isValidThemeId(value: string | null): value is ColorThemeId {
  return value !== null && (VALID_THEME_IDS as readonly string[]).includes(value);
}

const VALID_COLOR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

function isValidHexColor(color: string): boolean {
  return VALID_COLOR_RE.test(color);
}

/**
 * Sanitize user-provided CSS to block dangerous patterns.
 * Strips @import, url(), expression(), and javascript: to prevent data exfiltration or injection.
 */
function sanitizeCss(css: string): string {
  return css
    .replace(/@import\b[^;]*/gi, "/* blocked @import */")
    .replace(/url\s*\([^)]*\)/gi, "/* blocked url() */")
    .replace(/expression\s*\([^)]*\)/gi, "/* blocked expression() */")
    .replace(/javascript\s*:/gi, "/* blocked javascript: */");
}

const CortexColorThemeContext = createContext<CortexColorThemeContextValue>();

export function CortexColorThemeProvider(props: ParentProps) {
  const raw = typeof localStorage !== "undefined"
    ? localStorage.getItem(STORAGE_KEY)
    : null;
  const stored = isValidThemeId(raw) ? raw : null;
  const [colorTheme, setColorThemeSignal] = createSignal<ColorThemeId>(stored || "01");

  const rawAccent = typeof localStorage !== "undefined"
    ? localStorage.getItem(ACCENT_STORAGE_KEY)
    : null;
  const storedAccent = rawAccent && isValidHexColor(rawAccent) ? rawAccent : null;
  const [accentColor, setAccentColorSignal] = createSignal(storedAccent || DEFAULT_ACCENT);

  const rawCss = typeof localStorage !== "undefined"
    ? localStorage.getItem(CUSTOM_CSS_STORAGE_KEY)
    : null;
  const [customCss, setCustomCssSignal] = createSignal(rawCss ? sanitizeCss(rawCss) : "");

  const applyTheme = (id: ColorThemeId) => {
    if (id === "01") {
      delete document.documentElement.dataset.cortexTheme;
    } else {
      document.documentElement.dataset.cortexTheme = id;
    }
  };

  const applyAccent = (color: string) => {
    document.documentElement.style.setProperty("--cortex-accent-primary", color);
  };

  let customStyleEl: HTMLStyleElement | null = null;

  const applyCustomCss = (css: string) => {
    if (!customStyleEl) {
      customStyleEl = document.createElement("style");
      customStyleEl.id = "cortex-custom-css";
      document.head.appendChild(customStyleEl);
    }
    customStyleEl.textContent = css;
  };

  const setColorTheme = (id: ColorThemeId) => {
    setColorThemeSignal(id);
    applyTheme(id);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  };

  const setAccentColor = (color: string) => {
    if (!isValidHexColor(color)) return;
    setAccentColorSignal(color);
    applyAccent(color);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(ACCENT_STORAGE_KEY, color);
    }
  };

  const setCustomCss = (css: string) => {
    const trimmed = css.slice(0, MAX_CUSTOM_CSS_LENGTH);
    const safe = sanitizeCss(trimmed);
    setCustomCssSignal(safe);
    applyCustomCss(safe);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CUSTOM_CSS_STORAGE_KEY, safe);
    }
  };

  onMount(() => {
    applyTheme(colorTheme());
    applyAccent(accentColor());
    const css = customCss();
    if (css) applyCustomCss(css);
  });

  return (
    <CortexColorThemeContext.Provider value={{
      colorTheme, setColorTheme,
      accentColor, setAccentColor,
      customCss, setCustomCss,
    }}>
      {props.children}
    </CortexColorThemeContext.Provider>
  );
}

export function useColorTheme() {
  const ctx = useContext(CortexColorThemeContext);
  if (!ctx) throw new Error("useColorTheme must be used within CortexColorThemeProvider");
  return ctx;
}
