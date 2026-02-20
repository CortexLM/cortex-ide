import { Show, For, createMemo } from "solid-js";
import { useWhichKey, type ContinuationBinding } from "@/context/WhichKeyContext";
import { Icon } from "./ui/Icon";

/**
 * WhichKey popup component that displays available keybinding continuations
 * when a prefix key sequence is pressed.
 */
export function WhichKey() {
  const whichKey = useWhichKey();

  // Get sorted category names
  const sortedCategories = createMemo(() => {
    const categories = whichKey.continuationsByCategory();
    return Array.from(categories.keys()).sort((a, b) => {
      // Put "General" first, then sort alphabetically
      if (a === "General") return -1;
      if (b === "General") return 1;
      return a.localeCompare(b);
    });
  });

  // Format the current prefix for display
  const prefixDisplay = createMemo(() => {
    const sequence = whichKey.pendingSequence();
    if (!sequence) return "";
    return sequence.keystrokes.map((ks) => whichKey.formatKeystroke(ks)).join(" ");
  });

  // Calculate total count of continuations
  const totalContinuations = createMemo(() => {
    const sequence = whichKey.pendingSequence();
    return sequence?.continuations.length ?? 0;
  });

  return (
    <Show when={whichKey.isVisible() && whichKey.hasPendingSequence()}>
      <div
        class="fixed inset-0 z-[100] flex items-end justify-center pb-8"
        onClick={() => whichKey.cancelSequence()}
      >
        {/* Backdrop - subtle to not be distracting */}
        <div class="absolute inset-0 bg-black/30" />

        {/* Panel */}
        <div
          class="relative max-w-[800px] min-w-[400px] rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
          style={{ background: "var(--surface-raised)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header showing current prefix */}
          <div
            class="flex items-center justify-between gap-4 px-4 py-2.5 border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <div class="flex items-center gap-3">
              <Icon
                name="terminal"
                class="w-4 h-4 shrink-0"
                style={{ color: "var(--text-weak)" }}
              />
              <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                Which Key
              </span>
              <kbd
                class="text-xs px-2 py-1 rounded font-mono"
                style={{
                  background: "var(--accent-alpha)",
                  color: "var(--accent)",
                  border: "1px solid var(--accent-alpha)",
                }}
              >
                {prefixDisplay()}
              </kbd>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                {totalContinuations()} binding{totalContinuations() !== 1 ? "s" : ""}
              </span>
              <kbd
                class="text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: "var(--background-base)",
                  color: "var(--text-weak)",
                }}
              >
                esc
              </kbd>
            </div>
          </div>

          {/* Content grid organized by category */}
          <div
            class="max-h-[320px] overflow-y-auto p-3"
            style={{ background: "var(--surface-base)" }}
          >
            <Show
              when={sortedCategories().length > 0}
              fallback={
                <div class="px-4 py-8 text-center">
                  <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                    No continuations available
                  </p>
                </div>
              }
            >
              <div class="grid gap-3" style={{ "grid-template-columns": "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <For each={sortedCategories()}>
                  {(category) => (
                    <CategorySection
                      category={category}
                      bindings={whichKey.continuationsByCategory().get(category) ?? []}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}

/** Section for a category of keybindings */
function CategorySection(props: { category: string; bindings: ContinuationBinding[] }) {
  const whichKey = useWhichKey();
  const settings = whichKey.settings();

  // Limit items per column based on settings
  const visibleBindings = createMemo(() => {
    return props.bindings.slice(0, settings.maxItemsPerColumn);
  });

  const hasMore = createMemo(() => {
    return props.bindings.length > settings.maxItemsPerColumn;
  });

  return (
    <div class="flex flex-col gap-1">
      {/* Category header */}
      <div
        class="text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded"
        style={{
          color: "var(--text-weak)",
          background: "var(--background-base)",
        }}
      >
        {props.category}
      </div>

      {/* Bindings list */}
      <div class="flex flex-col">
        <For each={visibleBindings()}>
          {(continuation) => (
            <BindingItem continuation={continuation} showDescription={settings.showDescriptions} />
          )}
        </For>

        {/* Show overflow indicator */}
        <Show when={hasMore()}>
          <div
            class="px-2 py-1 text-xs"
            style={{ color: "var(--text-weak)" }}
          >
            +{props.bindings.length - settings.maxItemsPerColumn} more...
          </div>
        </Show>
      </div>
    </div>
  );
}

/** Individual binding item */
function BindingItem(props: { continuation: ContinuationBinding; showDescription: boolean }) {
  const whichKey = useWhichKey();

  // Format the next keystroke
  const nextKeyDisplay = createMemo(() => {
    return whichKey.formatKeystroke(props.continuation.nextKeystroke);
  });

  // Check if there are more keys after the next one
  const hasMoreKeys = createMemo(() => {
    return props.continuation.remainingKeystrokes.length > 0;
  });

  // Format remaining keystrokes if any
  const remainingDisplay = createMemo(() => {
    if (!hasMoreKeys()) return "";
    return props.continuation.remainingKeystrokes
      .map((ks) => whichKey.formatKeystroke(ks))
      .join(" ");
  });

  return (
    <div
      class="flex items-center justify-between gap-2 px-2 py-1.5 rounded transition-colors hover:bg-[var(--surface-active)]"
    >
      <div class="flex items-center gap-2 min-w-0 flex-1">
        {/* Next key to press */}
        <kbd
          class="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
          style={{
            background: "var(--accent-alpha)",
            color: "var(--accent)",
            border: "1px solid var(--accent-alpha)",
          }}
        >
          {nextKeyDisplay()}
        </kbd>

        {/* Remaining keys indicator */}
        <Show when={hasMoreKeys()}>
          <span
            class="text-xs font-mono shrink-0"
            style={{ color: "var(--text-weak)" }}
          >
            {remainingDisplay()}
          </span>
        </Show>

        {/* Command label */}
        <span
          class="text-sm truncate"
          style={{ color: "var(--text-base)" }}
          title={props.continuation.binding.label}
        >
          {props.continuation.binding.label}
        </span>
      </div>

      {/* Arrow indicator for nested sequences */}
      <Show when={hasMoreKeys()}>
        <span
          class="text-xs shrink-0"
          style={{ color: "var(--text-weak)" }}
        >
          →
        </span>
      </Show>
    </div>
  );
}

/**
 * WhichKey settings panel for use in the settings dialog.
 * Allows users to configure WhichKey behavior.
 */
export function WhichKeySettings() {
  const whichKey = useWhichKey();
  const settings = whichKey.settings();

  return (
    <div class="space-y-4">
      <h3 class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
        Which Key Settings
      </h3>

      {/* Enable/Disable toggle */}
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm" style={{ color: "var(--text-base)" }}>
            Enable Which Key
          </div>
          <div class="text-xs" style={{ color: "var(--text-weak)" }}>
            Show available key continuations when pressing prefix keys
          </div>
        </div>
        <button
          class="relative w-10 h-5 rounded-full transition-colors"
          style={{
            background: settings.enabled ? "var(--accent)" : "var(--border-weak)",
          }}
          onClick={() => whichKey.updateSettings({ enabled: !settings.enabled })}
          aria-label="Toggle Which Key"
        >
          <span
            class="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
            style={{
              background: "white",
              transform: settings.enabled ? "translateX(22px)" : "translateX(2px)",
            }}
          />
        </button>
      </div>

      {/* Delay slider */}
      <div>
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm" style={{ color: "var(--text-base)" }}>
            Popup Delay
          </div>
          <span class="text-xs font-mono" style={{ color: "var(--text-weak)" }}>
            {settings.delay}ms
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="2000"
          step="100"
          value={settings.delay}
          onInput={(e) =>
            whichKey.updateSettings({ delay: parseInt(e.currentTarget.value, 10) })
          }
          class="w-full h-2 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--accent) ${(settings.delay / 2000) * 100}%, var(--border-weak) ${(settings.delay / 2000) * 100}%)`,
          }}
        />
        <div class="flex justify-between text-xs mt-1" style={{ color: "var(--text-weak)" }}>
          <span>Instant</span>
          <span>2 seconds</span>
        </div>
      </div>

      {/* Max items per column */}
      <div>
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm" style={{ color: "var(--text-base)" }}>
            Max Items Per Category
          </div>
          <span class="text-xs font-mono" style={{ color: "var(--text-weak)" }}>
            {settings.maxItemsPerColumn}
          </span>
        </div>
        <input
          type="range"
          min="5"
          max="25"
          step="1"
          value={settings.maxItemsPerColumn}
          onInput={(e) =>
            whichKey.updateSettings({
              maxItemsPerColumn: parseInt(e.currentTarget.value, 10),
            })
          }
          class="w-full h-2 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--accent) ${((settings.maxItemsPerColumn - 5) / 20) * 100}%, var(--border-weak) ${((settings.maxItemsPerColumn - 5) / 20) * 100}%)`,
          }}
        />
      </div>

      {/* Show descriptions toggle */}
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm" style={{ color: "var(--text-base)" }}>
            Show Descriptions
          </div>
          <div class="text-xs" style={{ color: "var(--text-weak)" }}>
            Display command descriptions in the popup
          </div>
        </div>
        <button
          class="relative w-10 h-5 rounded-full transition-colors"
          style={{
            background: settings.showDescriptions ? "var(--accent)" : "var(--border-weak)",
          }}
          onClick={() =>
            whichKey.updateSettings({ showDescriptions: !settings.showDescriptions })
          }
          aria-label="Toggle descriptions"
        >
          <span
            class="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
            style={{
              background: "white",
              transform: settings.showDescriptions ? "translateX(22px)" : "translateX(2px)",
            }}
          />
        </button>
      </div>
    </div>
  );
}
