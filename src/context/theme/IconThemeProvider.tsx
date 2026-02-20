/**
 * FileIconThemeProvider - Wraps IconThemeProvider with convenience API.
 * Loads icon theme JSON (Seti format), maps file extensions/names to icon paths.
 */
import { type ParentProps } from "solid-js";
import {
  IconThemeProvider,
  useIconTheme,
  BUILTIN_THEMES,
} from "@/context/iconTheme/IconThemeProvider";
import type {
  IconDefinition,
  IconTheme,
  IconThemeState,
  IconThemeContextValue,
} from "@/context/iconTheme/types";

export { BUILTIN_THEMES };
export type { IconDefinition, IconTheme, IconThemeState, IconThemeContextValue };

export function getIconForFile(filename: string): IconDefinition {
  const ctx = useIconTheme();
  return ctx.getFileIcon(filename);
}

export function getIconForFolder(name: string, open: boolean): IconDefinition {
  const ctx = useIconTheme();
  return ctx.getFolderIcon(name, open);
}

export function FileIconThemeProvider(props: ParentProps) {
  return <IconThemeProvider>{props.children}</IconThemeProvider>;
}

export { useIconTheme };
