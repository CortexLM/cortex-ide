import type { IconTheme } from "./types";
import { setiTheme } from "./themes-seti";
import { materialTheme, minimalTheme } from "./themes-other";

export const BUILTIN_THEMES: IconTheme[] = [setiTheme, materialTheme, minimalTheme];

export { setiTheme, materialTheme, minimalTheme };
