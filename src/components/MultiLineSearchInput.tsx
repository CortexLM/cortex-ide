import { createSignal, createEffect, JSX, Show, onMount } from "solid-js";

export interface MultiLineSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  singleLineMode?: boolean;  // Start as single line
  icon?: JSX.Element;
  error?: boolean;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: (e: FocusEvent) => void;
  ref?: (el: HTMLTextAreaElement | HTMLInputElement) => void;
  containerStyle?: JSX.CSSProperties;
}

/**
 * Multi-line search input component with expandable textarea
 * 
 * Features:
 * - Ctrl+Enter inserts newline (instead of submitting)
 * - Enter submits when single-line
 * - Shift+Enter always inserts newline
 * - Auto-expand height as content grows
 * - Show "\\n" indicator when has newlines but collapsed
 * - Click to expand to full textarea
 * - Max height with scroll
 * - Line count indicator when multi-line
 */
export function MultiLineSearchInput(props: MultiLineSearchInputProps) {
  const [isExpanded, setIsExpanded] = createSignal(false);
  let textareaRef: HTMLTextAreaElement | undefined;
  let inputRef: HTMLInputElement | undefined;
  
  // Check if the value contains newlines
  const hasNewlines = () => props.value.includes('\n');
  const lineCount = () => props.value.split('\n').length;
  
  // Auto-expand when value has newlines
  createEffect(() => {
    if (hasNewlines() && !isExpanded()) {
      setIsExpanded(true);
    }
  });
  
  // Adjust textarea height based on content
  const adjustTextareaHeight = () => {
    if (textareaRef && isExpanded()) {
      textareaRef.style.height = 'auto';
      const scrollHeight = textareaRef.scrollHeight;
      // Min height 36px, max height 120px
      const newHeight = Math.min(Math.max(36, scrollHeight), 120);
      textareaRef.style.height = `${newHeight}px`;
    }
  };
  
  createEffect(() => {
    void props.value;
    adjustTextareaHeight();
  });
  
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+Enter or Shift+Enter inserts newline
    if (e.key === 'Enter' && (e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      e.stopPropagation();
      
      const target = e.target as HTMLTextAreaElement | HTMLInputElement;
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;
      const newValue = props.value.slice(0, start) + '\n' + props.value.slice(end);
      props.onChange(newValue);
      
      // Set cursor position after newline
      setTimeout(() => {
        if (textareaRef) {
          textareaRef.selectionStart = textareaRef.selectionEnd = start + 1;
        }
      }, 0);
      
      // Expand to multi-line mode if not already
      if (!isExpanded()) {
        setIsExpanded(true);
      }
      return;
    }
    
    // Enter submits when in single-line mode or no modifier
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      // In single-line mode or expanded mode without modifier, submit
      if (!isExpanded() || !hasNewlines()) {
        e.preventDefault();
        props.onSubmit?.();
        return;
      }
      // In expanded mode with multi-line content, enter submits
      e.preventDefault();
      props.onSubmit?.();
    }
  };
  
  const handleFocus = () => {
    props.onFocus?.();
  };
  
  const handleBlur = (e: FocusEvent) => {
    // Collapse to single line if no newlines and not focused
    if (!hasNewlines()) {
      setIsExpanded(false);
    }
    props.onBlur?.(e);
  };
  
  const handleExpand = () => {
    setIsExpanded(true);
    setTimeout(() => {
      textareaRef?.focus();
      // Select all text when expanding
      if (textareaRef) {
        textareaRef.selectionStart = 0;
        textareaRef.selectionEnd = props.value.length;
      }
    }, 0);
  };
  
  // Pass ref to parent
  onMount(() => {
    if (props.ref) {
      props.ref(isExpanded() ? textareaRef! : inputRef!);
    }
  });
  
  createEffect(() => {
    if (props.ref) {
      props.ref(isExpanded() ? textareaRef! : inputRef!);
    }
  });
  
  // Display value for collapsed mode (show newline indicators)
  const displayValue = () => {
    if (isExpanded()) return props.value;
    return props.value.replace(/\n/g, '\\n');
  };
  
  return (
    <div
      style={{
        display: "flex",
        "align-items": isExpanded() ? "flex-start" : "center",
        gap: "8px",
        padding: isExpanded() ? "8px 12px" : "0 12px",
        height: isExpanded() ? "auto" : "36px",
        "min-height": "36px",
        "border-radius": "var(--cortex-radius-md)",
        background: "var(--background-base)",
        border: props.error ? "1px solid var(--status-error)" : "1px solid transparent",
        transition: "height 0.15s ease, min-height 0.15s ease",
        ...props.containerStyle,
      }}
    >
      {props.icon && (
        <div style={{ 
          "flex-shrink": "0", 
          "padding-top": isExpanded() ? "4px" : "0",
          color: "var(--text-weak)" 
        }}>
          {props.icon}
        </div>
      )}
      
      <Show
        when={isExpanded()}
        fallback={
          // Single-line input mode
          <div style={{ flex: "1", display: "flex", "align-items": "center", gap: "4px" }}>
            <input
              ref={(el) => {
                inputRef = el;
                if (props.ref && !isExpanded()) props.ref(el);
              }}
              type="text"
              placeholder={props.placeholder}
              disabled={props.disabled}
              style={{
                flex: "1",
                background: "transparent",
                outline: "none",
                border: "none",
                "font-size": "13px",
                "min-width": "0",
                color: "var(--text-base)",
              }}
              value={displayValue()}
              onInput={(e) => props.onChange(e.currentTarget.value.replace(/\\n/g, '\n'))}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
            
            {/* Expand button when has newlines in collapsed mode */}
            <Show when={hasNewlines()}>
              <button
                type="button"
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "4px",
                  padding: "2px 6px",
                  "font-size": "10px",
                  "border-radius": "var(--cortex-radius-sm)",
                  background: "var(--surface-active)",
                  color: "var(--text-weak)",
                  border: "none",
                  cursor: "pointer",
                  "white-space": "nowrap",
                }}
                onClick={handleExpand}
                title="Expand to multi-line (has newlines)"
              >
                {lineCount()} lines
              </button>
            </Show>
          </div>
        }
      >
        {/* Multi-line textarea mode */}
        <div style={{ flex: "1", display: "flex", "flex-direction": "column", gap: "4px" }}>
          <textarea
            ref={(el) => {
              textareaRef = el;
              if (props.ref && isExpanded()) props.ref(el);
              adjustTextareaHeight();
            }}
            placeholder={props.placeholder}
            disabled={props.disabled}
            style={{
              flex: "1",
              background: "transparent",
              outline: "none",
              border: "none",
              "font-size": "13px",
              "font-family": "'JetBrains Mono', monospace",
              "line-height": "1.4",
              resize: "none",
              "min-width": "0",
              color: "var(--text-base)",
              "min-height": "36px",
              "max-height": "120px",
              overflow: "auto",
            }}
            value={props.value}
            onInput={(e) => props.onChange(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
          
          {/* Footer with line count and collapse option */}
          <div 
            style={{ 
              display: "flex", 
              "align-items": "center", 
              "justify-content": "space-between",
              "font-size": "10px",
              color: "var(--text-weaker)",
            }}
          >
            <span>{lineCount()} line{lineCount() !== 1 ? 's' : ''}</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <span style={{ color: "var(--text-weaker)" }}>
                Ctrl+Enter: newline
              </span>
              <Show when={!hasNewlines()}>
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-weak)",
                    cursor: "pointer",
                    "font-size": "10px",
                    padding: "0",
                  }}
                  onClick={() => setIsExpanded(false)}
                >
                  Collapse
                </button>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default MultiLineSearchInput;

