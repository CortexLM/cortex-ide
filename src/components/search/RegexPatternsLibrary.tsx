import { Component, For, Show, createSignal, createMemo, JSX } from "solid-js";
import { useSearch } from "@/context/SearchContext";
import { CortexButton, CortexTooltip } from "@/components/cortex/primitives";

export interface RegexPattern {
  name: string;
  pattern: string;
  description: string;
  category: string;
}

const REGEX_PATTERNS: RegexPattern[] = [
  { name: "Email Address", pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}", description: "Matches email addresses", category: "Common" },
  { name: "URL", pattern: "https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+", description: "Matches HTTP/HTTPS URLs", category: "Common" },
  { name: "IP Address (IPv4)", pattern: "\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b", description: "Matches IPv4 addresses", category: "Common" },
  { name: "Phone Number", pattern: "\\+?\\d{1,4}[-.\\s]?\\(?\\d{1,3}\\)?[-.\\s]?\\d{1,4}[-.\\s]?\\d{1,9}", description: "Matches international phone numbers", category: "Common" },
  { name: "TODO/FIXME Comments", pattern: "(TODO|FIXME|HACK|XXX|BUG)\\b.*$", description: "Matches TODO-style comments", category: "Code" },
  { name: "Import Statement", pattern: "^\\s*(import|from)\\s+.+", description: "Matches import/from statements", category: "Code" },
  { name: "Function Definition", pattern: "(function|const|let|var)\\s+\\w+\\s*[=(]", description: "Matches function declarations", category: "Code" },
  { name: "Console Log", pattern: "console\\.(log|warn|error|info|debug)\\(", description: "Matches console.log statements", category: "Code" },
  { name: "CSS Color (Hex)", pattern: "#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b", description: "Matches hex color codes", category: "Styling" },
  { name: "CSS Class Name", pattern: "\\.([a-zA-Z_][a-zA-Z0-9_-]*)\\s*\\{", description: "Matches CSS class selectors", category: "Styling" },
  { name: "JSON Key", pattern: '"([^"]+)"\\s*:', description: "Matches JSON object keys", category: "Data" },
  { name: "Quoted String", pattern: "([\"'])(?:(?=(\\\\?))\\2.)*?\\1", description: "Matches single or double quoted strings", category: "Data" },
];

export interface RegexPatternsLibraryProps {
  class?: string;
  style?: JSX.CSSProperties;
}

export const RegexPatternsLibrary: Component<RegexPatternsLibraryProps> = (props) => {
  const search = useSearch();
  const [isOpen, setIsOpen] = createSignal(false);
  const [filterText, setFilterText] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal<string | null>(null);

  const categories = createMemo(() => {
    const cats = new Set(REGEX_PATTERNS.map((p) => p.category));
    return Array.from(cats).sort();
  });

  const filteredPatterns = createMemo(() => {
    let patterns = REGEX_PATTERNS;
    const cat = selectedCategory();
    if (cat) patterns = patterns.filter((p) => p.category === cat);
    const filter = filterText().toLowerCase();
    if (filter) {
      patterns = patterns.filter(
        (p) => p.name.toLowerCase().includes(filter) || p.description.toLowerCase().includes(filter)
      );
    }
    return patterns;
  });

  const handleSelectPattern = (pattern: RegexPattern) => {
    search.setSearchQuery({ pattern: pattern.pattern });
    search.setSearchOptions({ useRegex: true });
    setIsOpen(false);
  };

  return (
    <div style={{ position: "relative", display: "inline-flex", ...(props.style || {}) }} class={props.class}>
      <CortexTooltip content="Regex patterns library" position="bottom">
        <CortexButton variant="ghost" size="xs" onClick={() => setIsOpen((v) => !v)} icon="book-open" title="Regex Patterns" />
      </CortexTooltip>

      <Show when={isOpen()}>
        <div style={{ position: "fixed", inset: "0", "z-index": "999" }} onClick={() => setIsOpen(false)} />
        <div style={{
          position: "absolute", top: "100%", right: "0", "margin-top": "4px", width: "340px", "max-height": "420px",
          "background-color": "var(--bg-secondary, #1e1e2e)", border: "1px solid var(--border-primary, #313244)",
          "border-radius": "8px", "box-shadow": "0 8px 24px rgba(0, 0, 0, 0.4)", "z-index": "1000",
          display: "flex", "flex-direction": "column",
        }}>
          <div style={{ padding: "8px" }}>
            <input
              type="text"
              placeholder="Filter patterns..."
              value={filterText()}
              onInput={(e) => setFilterText(e.currentTarget.value)}
              style={{
                width: "100%", padding: "6px 8px", "font-size": "12px",
                "background-color": "var(--bg-primary, #11111b)", border: "1px solid var(--border-primary, #313244)",
                "border-radius": "4px", color: "var(--text-primary, #cdd6f4)", outline: "none", "box-sizing": "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "4px", padding: "0 8px 8px", "flex-wrap": "wrap" }}>
            <CortexButton variant={selectedCategory() === null ? "primary" : "ghost"} size="xs" onClick={() => setSelectedCategory(null)}>All</CortexButton>
            <For each={categories()}>
              {(cat) => (
                <CortexButton variant={selectedCategory() === cat ? "primary" : "ghost"} size="xs" onClick={() => setSelectedCategory(cat)}>{cat}</CortexButton>
              )}
            </For>
          </div>

          <div style={{ flex: "1", "overflow-y": "auto", padding: "0 4px 4px" }}>
            <For each={filteredPatterns()}>
              {(pattern) => (
                <div
                  style={{
                    display: "flex", "flex-direction": "column", gap: "2px", padding: "8px", margin: "0 4px 2px",
                    "border-radius": "6px", cursor: "pointer", transition: "background-color 0.15s",
                  }}
                  onClick={() => handleSelectPattern(pattern)}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover, #262637)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
                    <span style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-primary, #cdd6f4)" }}>{pattern.name}</span>
                    <span style={{
                      "font-size": "10px", color: "var(--text-tertiary, #6c7086)",
                      "background-color": "var(--bg-tertiary, #181825)", padding: "1px 6px", "border-radius": "4px",
                    }}>{pattern.category}</span>
                  </div>
                  <div style={{ "font-size": "11px", color: "var(--text-secondary, #a6adc8)" }}>{pattern.description}</div>
                  <code style={{
                    "font-size": "11px", "font-family": "var(--font-mono, monospace)", color: "var(--color-accent, #89b4fa)",
                    "background-color": "var(--bg-primary, #11111b)", padding: "2px 6px", "border-radius": "3px",
                    overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", "margin-top": "2px",
                  }}>{pattern.pattern}</code>
                </div>
              )}
            </For>
            <Show when={filteredPatterns().length === 0}>
              <div style={{ padding: "16px", "text-align": "center", color: "var(--text-secondary, #a6adc8)", "font-size": "13px" }}>
                No patterns match your filter
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default RegexPatternsLibrary;
