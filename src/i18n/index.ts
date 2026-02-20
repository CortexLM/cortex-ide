import { createSignal } from "solid-js";
import en from "./translations/en.json";
import fr from "./translations/fr.json";
import zh from "./translations/zh.json";
import ja from "./translations/ja.json";
import es from "./translations/es.json";
import de from "./translations/de.json";
import { Locale, TranslationParams, RTL_LOCALES } from "./types";
import { createLogger } from "@/utils/logger";
export type { TranslationKey, NestedKeyOf, TranslationParams } from "./types";
export { SUPPORTED_LOCALES, RTL_LOCALES } from "./types";
export type { Locale } from "./types";

type TranslationKeys = typeof en;

const LOCALES: Record<Locale, TranslationKeys> = {
  en,
  fr,
  zh,
  ja,
  es,
  de,
};

const STORAGE_KEY = "cortex_locale";

const log = createLogger("i18n");

function getInitialLocale(): Locale {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in LOCALES) {
      return stored as Locale;
    }
  }
  if (typeof navigator !== "undefined") {
    const browserLang = navigator.language.split("-")[0];
    if (browserLang in LOCALES) {
      return browserLang as Locale;
    }
  }
  return "en";
}

const [currentLocale, setCurrentLocale] = createSignal<Locale>(getInitialLocale());

export function setLocale(locale: Locale): void {
  setCurrentLocale(locale);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, locale);
  }
  window.dispatchEvent(new CustomEvent("i18n:locale-changed", { detail: { locale } }));
}

export function isRTL(): boolean {
  return RTL_LOCALES.includes(currentLocale());
}

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, params: TranslationParams): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key]?.toString() ?? `{${key}}`;
  });
}

export function t(key: string, params?: TranslationParams): string {
  const locale = currentLocale();
  const translations = LOCALES[locale];
  let value = getNestedValue(translations as unknown as Record<string, unknown>, key);
  if (value === undefined && locale !== "en") {
    value = getNestedValue(LOCALES.en as unknown as Record<string, unknown>, key);
  }
  if (value === undefined) {
    log.warn(`Missing translation for key: ${key}`);
    return key;
  }
  if (params) {
    return interpolate(value, params);
  }
  return value;
}

export { currentLocale, LOCALES };
