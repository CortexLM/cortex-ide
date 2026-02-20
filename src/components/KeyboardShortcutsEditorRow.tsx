import { For, Show } from "solid-js";
import { useCommands, type Command } from "@/context/CommandContext";
import { Icon } from "@/components/ui/Icon";
import { Text, IconButton } from "@/components/ui";

export const CATEGORY_ORDER = [
  "General", "Navigation", "Editor", "Search",
  "View", "Debug", "Git", "Terminal", "Extension", "Other",
];

export const CATEGORY_ICONS: Record<string, string> = {
  General: "grid", Navigation: "compass", Editor: "code",
  Search: "search", View: "layout", Debug: "bug",
  Git: "git-branch", Terminal: "terminal",
  Extension: "puzzle", Other: "dots-horizontal",
};

export function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    "Ctrl": "Ctrl", "Control": "Ctrl", "Shift": "⇧",
    "Alt": "Alt", "Meta": "⌘", "Cmd": "⌘",
    "Enter": "↵", "Return": "↵", "Escape": "Esc",
    "Tab": "⇥", "Space": "␣", "Backspace": "⌫",
    "Delete": "Del", "ArrowUp": "↑", "ArrowDown": "↓",
    "ArrowLeft": "←", "ArrowRight": "→",
    "Left": "←", "Right": "→", "Up": "↑", "Down": "↓",
  };
  return keyMap[key] || key;
}

interface KeyCapProps {
  keys: string;
}

export function KeyCap(props: KeyCapProps) {
  const parts = () => props.keys.split("+").map(k => k.trim());

  return (
    <div class="flex items-center gap-1">
      <For each={parts()}>
        {(key, index) => (
          <>
            <kbd
              class="inline-flex items-center justify-center px-2 py-0.5 text-xs font-mono rounded"
              style={{
                background: "var(--jb-surface-active)",
                border: "1px solid var(--jb-border-default)",
                color: "var(--jb-text-body-color)",
                "min-width": "24px",
                "box-shadow": "0 1px 2px rgba(0, 0, 0, 0.2)",
              }}
            >
              {formatKey(key)}
            </kbd>
            <Show when={index() < parts().length - 1}>
              <span style={{ color: "var(--jb-text-muted-color)" }}>+</span>
            </Show>
          </>
        )}
      </For>
    </div>
  );
}

interface ShortcutRowProps {
  command: Command;
  isAlternate: boolean;
  onRecord?: (commandId: string) => void;
  onReset?: (commandId: string) => void;
  hasConflict?: boolean;
}

export function ShortcutRow(props: ShortcutRowProps) {
  const { executeCommand } = useCommands();

  return (
    <div
      class="flex items-center gap-4 px-4 py-2.5 hover:bg-white/5 cursor-pointer transition-colors group"
      style={{
        background: props.isAlternate ? "rgba(255, 255, 255, 0.02)" : "transparent",
      }}
      onClick={() => executeCommand(props.command.id)}
    >
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <Text variant="body" truncate>{props.command.label}</Text>
          <Show when={props.command.isExtension}>
            <span
              class="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "var(--jb-border-focus)", color: "white" }}
            >
              Extension
            </span>
          </Show>
          <Show when={props.hasConflict}>
            <span
              class="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "var(--cortex-error, #BF616A)", color: "white" }}
              title="Keybinding conflict detected"
            >
              ⚠ Conflict
            </span>
          </Show>
        </div>
        <Text variant="muted" size="sm" truncate style={{ "margin-top": "2px" }}>
          {props.command.id}
        </Text>
      </div>
      <div class="flex items-center gap-2">
        <Show when={props.command.shortcut}>
          <KeyCap keys={props.command.shortcut!} />
        </Show>
        <Show when={!props.command.shortcut}>
          <span class="text-xs italic" style={{ color: "var(--jb-text-muted-color)" }}>
            No shortcut
          </span>
        </Show>
        <Show when={props.onRecord}>
          <IconButton
            icon="keyboard"
            size="sm"
            variant="ghost"
            title="Record new shortcut"
            class="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); props.onRecord?.(props.command.id); }}
          />
        </Show>
        <Show when={props.onReset && props.command.shortcut}>
          <IconButton
            icon="rotate-left"
            size="sm"
            variant="ghost"
            title="Reset to default"
            class="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); props.onReset?.(props.command.id); }}
          />
        </Show>
        <IconButton
          icon="play"
          size="sm"
          variant="ghost"
          title="Run command"
          class="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); executeCommand(props.command.id); }}
        />
      </div>
    </div>
  );
}

interface CategorySectionProps {
  category: string;
  commands: Command[];
  isExpanded: boolean;
  onToggle: () => void;
  onRecord?: (commandId: string) => void;
  onReset?: (commandId: string) => void;
  conflictIds?: Set<string>;
}

export function CategorySection(props: CategorySectionProps) {
  const withShortcuts = () => props.commands.filter(c => c.shortcut).length;

  return (
    <div class="border-b" style={{ "border-color": "var(--jb-border-default)" }}>
      <button
        class="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
        onClick={props.onToggle}
      >
        <Icon
          name={props.isExpanded ? "chevron-down" : "chevron-right"}
          class="w-4 h-4"
          style={{ color: "var(--jb-text-muted-color)" }}
        />
        <Icon
          name={CATEGORY_ICONS[props.category] || "folder"}
          class="w-4 h-4"
          style={{ color: "var(--jb-border-focus)" }}
        />
        <span
          class="flex-1 text-left text-sm font-medium"
          style={{ color: "var(--jb-text-body-color)" }}
        >
          {props.category}
        </span>
        <span
          class="text-xs px-2 py-0.5 rounded-full"
          style={{
            background: "var(--jb-surface-active)",
            color: "var(--jb-text-muted-color)",
          }}
        >
          {props.commands.length} commands • {withShortcuts()} with shortcuts
        </span>
      </button>
      <Show when={props.isExpanded}>
        <div class="pb-2">
          <For each={props.commands}>
            {(cmd, index) => (
              <ShortcutRow
                command={cmd}
                isAlternate={index() % 2 === 1}
                onRecord={props.onRecord}
                onReset={props.onReset}
                hasConflict={props.conflictIds?.has(cmd.id)}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
