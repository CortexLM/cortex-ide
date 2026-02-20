import { createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import { useSettings, type ScreencastModeSettings } from "@/context/SettingsContext";

/** Represents a key press event for display */
interface KeyPress {
  id: number;
  keys: string[];
  timestamp: number;
  type: "key" | "mouse";
}

/** Fade out duration in milliseconds */
const FADE_OUT_DURATION = 400;

/** Maximum number of items to display */
const MAX_DISPLAY_ITEMS = 6;

/** Generate unique ID for key presses */
let keyPressId = 0;

/**
 * ScreencastMode Component
 * 
 * Displays pressed keys and mouse clicks on screen for presentations and screencasts.
 * Shows modifier keys (Ctrl, Alt, Shift, Meta) along with the main key.
 * Shows mouse clicks (left/right/middle).
 * Keys fade out after the configured duration (default 2 seconds).
 * Positioned in the bottom-right corner like VS Code.
 */
export function ScreencastMode() {
  const { effectiveSettings, updateSettings } = useSettings();
  const [keyPresses, setKeyPresses] = createSignal<KeyPress[]>([]);
  const [isEnabled, setIsEnabled] = createSignal(false);
  
  // Get settings from context
  const screencastSettings = () => effectiveSettings().screencastMode;
  const fontSize = () => screencastSettings()?.fontSize ?? 24;
  const duration = () => screencastSettings()?.duration ?? 2000;
  const showKeys = () => screencastSettings()?.showKeys ?? true;
  const showMouse = () => screencastSettings()?.showMouse ?? true;
  
  // Listen for screencast mode toggle events
  onMount(() => {
    const handleToggle = () => {
      const newState = !isEnabled();
      setIsEnabled(newState);
      // Update settings to persist
      const current = effectiveSettings().screencastMode || {
        enabled: false,
        showKeys: true,
        showMouse: true,
        showCommands: true,
        fontSize: 24,
        duration: 2000,
      };
      updateSettings("screencastMode", { ...current, enabled: newState });
    };
    
    const handleEnable = () => {
      setIsEnabled(true);
      const current = effectiveSettings().screencastMode || {
        enabled: false,
        showKeys: true,
        showMouse: true,
        showCommands: true,
        fontSize: 24,
        duration: 2000,
      };
      updateSettings("screencastMode", { ...current, enabled: true });
    };
    
    const handleDisable = () => {
      setIsEnabled(false);
      const current = effectiveSettings().screencastMode || {
        enabled: false,
        showKeys: true,
        showMouse: true,
        showCommands: true,
        fontSize: 24,
        duration: 2000,
      };
      updateSettings("screencastMode", { ...current, enabled: false });
    };
    
    // Listen for settings changes
    const handleSettingsChange = (e: CustomEvent<Partial<ScreencastModeSettings>>) => {
      if (e.detail) {
        const current = effectiveSettings().screencastMode || {
          enabled: false,
          showKeys: true,
          showMouse: true,
          showCommands: true,
          fontSize: 24,
          duration: 2000,
        };
        updateSettings("screencastMode", { ...current, ...e.detail });
      }
    };
    
    window.addEventListener("screencast:toggle", handleToggle);
    window.addEventListener("screencast:enable", handleEnable);
    window.addEventListener("screencast:disable", handleDisable);
    window.addEventListener("screencast:settings-changed", handleSettingsChange as EventListener);
    
    // Initialize from saved settings
    if (screencastSettings()?.enabled) {
      setIsEnabled(true);
    }
    
    onCleanup(() => {
      window.removeEventListener("screencast:toggle", handleToggle);
      window.removeEventListener("screencast:enable", handleEnable);
      window.removeEventListener("screencast:disable", handleDisable);
      window.removeEventListener("screencast:settings-changed", handleSettingsChange as EventListener);
    });
  });

  // Format key name for display
  const formatKeyName = (key: string): string => {
    const keyMap: Record<string, string> = {
      " ": "Space",
      "ArrowUp": "↑",
      "ArrowDown": "↓",
      "ArrowLeft": "←",
      "ArrowRight": "→",
      "Escape": "Esc",
      "Backspace": "⌫",
      "Delete": "Del",
      "Enter": "⏎",
      "Tab": "⇥",
      "CapsLock": "Caps",
      "Control": "Ctrl",
      "Meta": "Win",
      "PageUp": "PgUp",
      "PageDown": "PgDn",
      "Home": "Home",
      "End": "End",
      "Insert": "Ins",
      "F1": "F1",
      "F2": "F2",
      "F3": "F3",
      "F4": "F4",
      "F5": "F5",
      "F6": "F6",
      "F7": "F7",
      "F8": "F8",
      "F9": "F9",
      "F10": "F10",
      "F11": "F11",
      "F12": "F12",
    };
    
    return keyMap[key] || (key.length === 1 ? key.toUpperCase() : key);
  };

  // Build key combination string
  const buildKeyCombo = (e: KeyboardEvent): string[] => {
    const keys: string[] = [];
    
    if (e.ctrlKey && e.key !== "Control") keys.push("Ctrl");
    if (e.altKey && e.key !== "Alt") keys.push("Alt");
    if (e.shiftKey && e.key !== "Shift") keys.push("Shift");
    if (e.metaKey && e.key !== "Meta") keys.push("Win");
    
    // Don't show standalone modifier keys
    if (!["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
      keys.push(formatKeyName(e.key));
    }
    
    return keys;
  };

  // Get mouse button name
  const getMouseButtonName = (button: number): string => {
    switch (button) {
      case 0: return "Left Click";
      case 1: return "Middle Click";
      case 2: return "Right Click";
      case 3: return "Back";
      case 4: return "Forward";
      default: return `Mouse ${button}`;
    }
  };

  // Add a new display item
  const addDisplayItem = (keys: string[], type: "key" | "mouse") => {
    const newPress: KeyPress = {
      id: ++keyPressId,
      keys,
      timestamp: Date.now(),
      type,
    };
    
    setKeyPresses(prev => {
      const updated = [...prev, newPress];
      // Keep only the last MAX_DISPLAY_ITEMS
      return updated.slice(-MAX_DISPLAY_ITEMS);
    });
    
    // Schedule removal
    setTimeout(() => {
      setKeyPresses(prev => prev.filter(kp => kp.id !== newPress.id));
    }, duration());
  };

  // Handle key down events
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isEnabled() || !showKeys()) return;
    
    // Skip if only modifier keys are pressed
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
      return;
    }
    
    const keys = buildKeyCombo(e);
    if (keys.length === 0) return;
    
    addDisplayItem(keys, "key");
  };

  // Handle mouse click events
  const handleMouseDown = (e: MouseEvent) => {
    if (!isEnabled() || !showMouse()) return;
    
    const keys: string[] = [];
    
    // Add modifiers
    if (e.ctrlKey) keys.push("Ctrl");
    if (e.altKey) keys.push("Alt");
    if (e.shiftKey) keys.push("Shift");
    if (e.metaKey) keys.push("Win");
    
    keys.push(getMouseButtonName(e.button));
    
    addDisplayItem(keys, "mouse");
  };

  // Set up global key listener when enabled
  createEffect(() => {
    if (isEnabled()) {
      window.addEventListener("keydown", handleKeyDown, true);
      window.addEventListener("mousedown", handleMouseDown, true);
    } else {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("mousedown", handleMouseDown, true);
      setKeyPresses([]);
    }
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown, true);
    window.removeEventListener("mousedown", handleMouseDown, true);
  });

  // Check if a key press is fading out
  const isFadingOut = (press: KeyPress): boolean => {
    const elapsed = Date.now() - press.timestamp;
    return elapsed > duration() - FADE_OUT_DURATION;
  };

  // Animation polling for fade state
  const [, setTick] = createSignal(0);
  createEffect(() => {
    if (!isEnabled() || keyPresses().length === 0) return;
    
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 50);
    
    onCleanup(() => clearInterval(interval));
  });

  return (
    <Show when={isEnabled() && keyPresses().length > 0}>
      <div
        class="screencast-overlay"
        style={{
          position: "fixed",
          bottom: "80px",
          right: "24px",
          display: "flex",
          "flex-direction": "column",
          "align-items": "flex-end",
          gap: "8px",
          "z-index": "99999",
          "pointer-events": "none",
        }}
      >
        <For each={keyPresses()}>
          {(press) => {
            const fading = () => isFadingOut(press);
            
            return (
              <div
                class="screencast-key-display"
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "4px",
                  padding: "8px 16px",
                  "background-color": "rgba(30, 30, 30, 0.85)",
                  "backdrop-filter": "blur(8px)",
                  "border-radius": "var(--cortex-radius-md)",
                  "box-shadow": "0 2px 8px rgba(0, 0, 0, 0.4)",
                  opacity: fading() ? "0" : "1",
                  transform: fading() ? "translateY(10px) scale(0.95)" : "translateY(0) scale(1)",
                  transition: `opacity ${FADE_OUT_DURATION}ms ease-out, transform ${FADE_OUT_DURATION}ms ease-out`,
                }}
              >
                <For each={press.keys}>
                  {(key, index) => (
                    <>
                      <Show when={index() > 0}>
                        <span
                          style={{
                            "font-size": `${fontSize() * 0.6}px`,
                            color: "rgba(255, 255, 255, 0.4)",
                            "font-weight": "300",
                            margin: "0 2px",
                          }}
                        >
                          +
                        </span>
                      </Show>
                      <span
                        class="screencast-key"
                        style={{
                          display: "inline-flex",
                          "align-items": "center",
                          "justify-content": "center",
                          "min-width": press.type === "mouse" ? "auto" : `${fontSize() * 1.2}px`,
                          padding: press.type === "mouse" ? "4px 12px" : "4px 10px",
                          "background-color": press.type === "mouse" 
                            ? "rgba(100, 149, 237, 0.3)" 
                            : "rgba(255, 255, 255, 0.1)",
                          "border-radius": "var(--cortex-radius-sm)",
                          "font-family": "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                          "font-size": `${fontSize()}px`,
                          "font-weight": "500",
                          color: "var(--cortex-text-primary)",
                          "text-shadow": "0 1px 2px rgba(0, 0, 0, 0.3)",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                        }}
                      >
                        {key}
                      </span>
                    </>
                  )}
                </For>
              </div>
            );
          }}
        </For>
      </div>
    </Show>
  );
}

export default ScreencastMode;

