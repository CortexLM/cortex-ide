import { createSignal, createEffect, Show, onMount, onCleanup } from "solid-js";
import { useCommands } from "@/context/CommandContext";
import { generateWrapPreview } from "@/utils/emmet";
import { Icon } from "./ui/Icon";

/**
 * EmmetWrapDialog - Modal dialog for wrapping selected content with an Emmet abbreviation.
 * Supports abbreviations like: div, div.class, div#id, span.class#id[attr=value]
 * Shows live preview of the wrapped result.
 */
export function EmmetWrapDialog() {
  const { showEmmetWrapDialog, setShowEmmetWrapDialog } = useCommands();
  const [abbreviation, setAbbreviation] = createSignal("");
  const [selectedText, setSelectedText] = createSignal("");
  const [preview, setPreview] = createSignal("");
  const [isVisible, setIsVisible] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;

  // Handle animation states and capture selected text when dialog opens
  createEffect(() => {
    if (showEmmetWrapDialog()) {
      setIsVisible(true);
      setAbbreviation("");
      
      // Request the current selection from the editor
      window.dispatchEvent(new CustomEvent("emmet:get-selection"));
      
      setTimeout(() => inputRef?.focus(), 10);
    } else {
      setIsVisible(false);
    }
  });

  // Update preview when abbreviation changes
  createEffect(() => {
    const abbr = abbreviation();
    const text = selectedText();
    if (abbr.trim()) {
      setPreview(generateWrapPreview(text, abbr));
    } else {
      setPreview(text);
    }
  });

  // Listen for selection response from editor
  onMount(() => {
    const handleSelectionResponse = (e: CustomEvent<{ text: string }>) => {
      setSelectedText(e.detail.text || "(no selection)");
    };

    window.addEventListener("emmet:selection-response", handleSelectionResponse as EventListener);
    
    onCleanup(() => {
      window.removeEventListener("emmet:selection-response", handleSelectionResponse as EventListener);
    });
  });

  // Global escape handler
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && showEmmetWrapDialog()) {
      e.preventDefault();
      setShowEmmetWrapDialog(false);
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleGlobalKeyDown);
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleWrap();
    }
  };

  const handleWrap = () => {
    const abbr = abbreviation().trim();
    if (abbr) {
      // Dispatch wrap event with the abbreviation
      window.dispatchEvent(new CustomEvent("emmet:wrap", { 
        detail: { abbreviation: abbr } 
      }));
    }
    setShowEmmetWrapDialog(false);
  };

  return (
    <Show when={showEmmetWrapDialog()}>
      {/* Backdrop - VS Code: rgba(0,0,0,0.4) with blur */}
      <div 
        class="modal-overlay dimmed"
        classList={{
          "dialog-backdrop-enter": isVisible(),
        }}
        onClick={() => setShowEmmetWrapDialog(false)}
        style={{ "padding-top": "15vh" }}
      >        
        {/* Dialog - VS Code specs */}
        <div 
          class="dialog dialog-standard mx-4"
          classList={{
            "dialog-enter": isVisible(),
          }}
          style={{ 
            "max-width": "480px",
            "width": "100%",
          }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="emmet-dialog-title"
        >
          {/* Header - VS Code: 35px height, 13px font, font-weight 600 */}
          <div class="dialog-header">
            <Icon name="code" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
            <span id="emmet-dialog-title" class="ml-2 dialog-header-title">
              Wrap with Abbreviation
            </span>
            <kbd 
              class="quick-input-keybinding-key text-[11px] font-mono"
            >
              ESC
            </kbd>
          </div>

          {/* Content - VS Code: 16px padding */}
          <div class="dialog-content space-y-4">
            {/* Abbreviation input */}
            <div>
              <label 
                class="block text-[12px] mb-1.5 font-medium"
                style={{ color: "var(--text-weak)" }}
              >
                Abbreviation
              </label>
              <input
                ref={inputRef}
                type="text"
                placeholder="e.g., div.wrapper, ul>li*3, section#main.container"
                class="w-full px-3 py-2 rounded text-[14px] outline-none border transition-colors"
                style={{ 
                  background: "var(--background-base)",
                  color: "var(--text-base)",
                  "border-color": "var(--border-default)",
                }}
                value={abbreviation()}
                onInput={(e) => setAbbreviation(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent-primary)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--border-default)"}
              />
              <p 
                class="text-[11px] mt-1.5"
                style={{ color: "var(--text-weaker)" }}
              >
                Examples: div, div.class, span#id, p.intro[data-type=text]
              </p>
            </div>

            {/* Preview section */}
            <div>
              <label 
                class="block text-[12px] mb-1.5 font-medium"
                style={{ color: "var(--text-weak)" }}
              >
                Preview
              </label>
              <div 
                class="p-3 rounded text-[13px] font-mono overflow-x-auto max-h-[120px] overflow-y-auto"
                style={{ 
                  background: "var(--background-base)",
                  color: "var(--text-base)",
                  "white-space": "pre-wrap",
                  "word-break": "break-word",
                }}
              >
                {preview() || "(enter an abbreviation to see preview)"}
              </div>
            </div>
          </div>

          {/* Footer - VS Code: border-top, 12px 16px padding, 8px gap */}
          <div class="dialog-footer">
            <button
              class="modal-button modal-button-secondary"
              onClick={() => setShowEmmetWrapDialog(false)}
            >
              Cancel
            </button>
            <button
              class="modal-button modal-button-primary"
              onClick={handleWrap}
            >
              Wrap
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
