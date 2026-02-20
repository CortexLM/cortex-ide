export type Locale = "en" | "fr" | "zh" | "ja" | "es" | "de";

export interface TranslationParams {
  [key: string]: string | number;
}

export const RTL_LOCALES: Locale[] = [];

export const SUPPORTED_LOCALES: { code: Locale; name: string; nativeName: string }[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "de", name: "German", nativeName: "Deutsch" },
];

export type TranslationKeys = typeof import("./translations/en.json");

export type NestedKeyOf<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? NestedKeyOf<T[K], `${Prefix}${K}.`>
          : `${Prefix}${K}`
        : never;
    }[keyof T]
  : never;

export type TranslationKey = NestedKeyOf<TranslationKeys>;
