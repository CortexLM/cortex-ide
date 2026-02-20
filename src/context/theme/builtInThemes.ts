import { reconcile } from "solid-js/store";
import type { SetStoreFunction } from "solid-js/store";
import {
  convertWorkbenchColors,
  convertEditorColors,
  convertSyntaxColors,
  convertTerminalColors,
} from "@/utils/theme-converter";
import type {
  Theme, ThemeColors, EditorColors, SyntaxColors, TerminalColors,
  ColorCustomizations,
} from "./types";
import { saveCustomizationsToStorage } from "./themeHelpers";

export function resolveHcBaseType(t: Theme): "dark" | "light" {
  if (t === "high-contrast") return "dark";
  if (t === "high-contrast-light") return "light";
  return t === "dark" ? "dark" : "light";
}

export async function fetchHcTheme(variant: "high-contrast" | "high-contrast-light"): Promise<{ colors: Record<string, string>; tokenColors?: any[] }> {
  const path = `/themes/${variant}.json`;
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load HC theme from ${path}: ${res.status}`);
  return res.json();
}

export async function loadBuiltInTheme(name: string): Promise<{ name: string; type: string; colors: Record<string, string>; tokenColors?: any[] }> {
  const path = `/themes/${name}.json`;
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load built-in theme from ${path}: ${res.status}`);
  return res.json();
}

export function applyThemeColors(
  colors: Record<string, string>,
  tokenColors: any[] | undefined,
  baseType: "dark" | "light",
  setCustomizations: SetStoreFunction<ColorCustomizations>,
) {
  const ui = convertWorkbenchColors(colors, baseType) as unknown as Partial<ThemeColors>;
  const ed = convertEditorColors(colors, baseType) as unknown as Partial<EditorColors>;
  const syn = tokenColors
    ? convertSyntaxColors(tokenColors, baseType) as unknown as Partial<SyntaxColors>
    : {};
  const term = convertTerminalColors(colors, baseType) as unknown as Partial<TerminalColors>;
  const customizations = { ui, editor: ed, syntax: syn, terminal: term };
  setCustomizations(reconcile(customizations));
  saveCustomizationsToStorage(customizations);
}
