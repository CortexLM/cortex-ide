import {
  createContext,
  useContext,
  ParentProps,
  createMemo,
  Accessor,
  onMount,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { createStore } from "solid-js/store";
import {
  Locale,
  TranslationParams,
  SUPPORTED_LOCALES,
  RTL_LOCALES,
} from "@/i18n/types";
import {
  currentLocale,
  setLocale as setI18nLocale,
  t as translateFn,
  LOCALES,
} from "@/i18n";

export interface I18nState {
  locale: Locale;
  isRTL: boolean;
  direction: "ltr" | "rtl";
}

export interface I18nContextValue {
  state: I18nState;
  locale: Accessor<Locale>;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TranslationParams) => string;
  isRTL: Accessor<boolean>;
  direction: Accessor<"ltr" | "rtl">;
  supportedLocales: typeof SUPPORTED_LOCALES;
}

const I18nContext = createContext<I18nContextValue>();

export function I18nProvider(props: ParentProps) {
  const [state, setState] = createStore<I18nState>({
    locale: currentLocale(),
    isRTL: RTL_LOCALES.includes(currentLocale()),
    direction: RTL_LOCALES.includes(currentLocale()) ? "rtl" : "ltr",
  });

  const translate = createMemo(() => {
    void currentLocale();
    return (key: string, params?: TranslationParams) => translateFn(key, params);
  });

  const handleSetLocale = (locale: Locale) => {
    setI18nLocale(locale);
    const rtl = RTL_LOCALES.includes(locale);
    setState({
      locale,
      isRTL: rtl,
      direction: rtl ? "rtl" : "ltr",
    });
    if (typeof document !== "undefined") {
      document.documentElement.dir = rtl ? "rtl" : "ltr";
      document.documentElement.lang = locale;
    }
  };

  onMount(async () => {
    try {
      const detected = await invoke<string>("i18n_detect_locale");
      if (detected && detected in LOCALES) {
        handleSetLocale(detected as Locale);
      }
    } catch {
      // Backend locale detection not available, use frontend detection
    }
  });

  const isRTL: Accessor<boolean> = () => state.isRTL;
  const direction: Accessor<"ltr" | "rtl"> = () => state.direction;

  const contextValue: I18nContextValue = {
    state,
    locale: currentLocale,
    setLocale: handleSetLocale,
    t: (key: string, params?: TranslationParams) => translate()(key, params),
    isRTL,
    direction,
    supportedLocales: SUPPORTED_LOCALES,
  };

  return (
    <I18nContext.Provider value={contextValue}>
      {props.children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export { SUPPORTED_LOCALES, RTL_LOCALES };
export type { Locale, TranslationParams };
