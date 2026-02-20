import { BINDINGS_PART1 } from "./defaultBindings1";
import { BINDINGS_PART2 } from "./defaultBindings2";
import { BINDINGS_PART3 } from "./defaultBindings3";
import { BINDINGS_PART4 } from "./defaultBindings4";
import { BINDINGS_PART5 } from "./defaultBindings5";
import type { CommandBinding } from "./types";

export const DEFAULT_BINDINGS: Omit<CommandBinding, "customKeybinding">[] = [
  ...BINDINGS_PART1,
  ...BINDINGS_PART2,
  ...BINDINGS_PART3,
  ...BINDINGS_PART4,
  ...BINDINGS_PART5,
];
