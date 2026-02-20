import { createSignal, createEffect, Show, For, onMount, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { useLanguageSelector, type LanguageInfo } from "@/context/LanguageSelectorContext";
import { useEditor } from "@/context/EditorContext";

// ============================================================================
// Types
// ============================================================================

interface LanguageSelectorProps {
  fileId?: string;
  onClose?: () => void;
}

// ============================================================================
// Language Icon Component
// ============================================================================

function LanguageIcon(props: { languageId: string; class?: string }) {
  const iconClass = () => props.class || "w-4 h-4";

  // Return appropriate icon based on language
  const getIcon = () => {
    const id = props.languageId.toLowerCase();

    // Use specific icons for common languages
    switch (id) {
      case "typescript":
      case "tsx":
        return (
          <svg viewBox="0 0 24 24" class={iconClass()} fill="currentColor">
            <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z" />
          </svg>
        );
      case "javascript":
      case "jsx":
        return (
          <svg viewBox="0 0 24 24" class={iconClass()} fill="currentColor">
            <path d="M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.404-.601-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z" />
          </svg>
        );
      case "python":
        return (
          <svg viewBox="0 0 24 24" class={iconClass()} fill="currentColor">
            <path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.9S0 5.789 0 11.969c0 6.18 3.403 5.96 3.403 5.96h2.03v-2.867s-.109-3.42 3.35-3.42h5.766s3.24.052 3.24-3.148V3.202S18.28 0 11.913 0zM8.708 1.85c.578 0 1.046.47 1.046 1.052 0 .58-.468 1.051-1.046 1.051-.578 0-1.046-.47-1.046-1.051 0-.581.468-1.052 1.046-1.052z" />
            <path d="M12.087 24c6.093 0 5.713-2.656 5.713-2.656l-.007-2.752h-5.814v-.826h8.121s3.9.445 3.9-5.735c0-6.18-3.403-5.96-3.403-5.96h-2.03v2.867s.109 3.42-3.35 3.42H9.45s-3.24-.052-3.24 3.148v5.292S5.72 24 12.087 24zm3.206-1.85c-.578 0-1.046-.47-1.046-1.052 0-.58.468-1.051 1.046-1.051.578 0 1.046.47 1.046 1.051 0 .581-.468 1.052-1.046 1.052z" />
          </svg>
        );
      case "rust":
        return (
          <svg viewBox="0 0 24 24" class={iconClass()} fill="currentColor">
            <path d="M23.835 11.703l-1.008-.623-.028-.228.741-.855a.35.35 0 00-.107-.514l-.993-.557-.057-.224.572-.964a.35.35 0 00-.192-.494l-1.09-.373-.084-.213.387-1.047a.35.35 0 00-.27-.461l-1.138-.172-.109-.196.19-1.095a.35.35 0 00-.343-.411l-1.144.033-.131-.173-.015-1.108a.35.35 0 00-.406-.342l-1.106.236-.148-.144-.219-1.083a.35.35 0 00-.457-.258l-1.025.432-.161-.11-.413-1.018a.35.35 0 00-.495-.164l-.906.615-.168-.071-.593-.915a.35.35 0 00-.517-.061l-.753.779-.17-.031-.75-.778a.35.35 0 00-.517.061l-.593.915-.168.07-.906-.614a.35.35 0 00-.495.164l-.413 1.018-.161.11-1.025-.432a.35.35 0 00-.457.258l-.219 1.083-.148.144-1.106-.236a.35.35 0 00-.406.342l-.015 1.108-.131.173-1.144-.033a.35.35 0 00-.343.411l.19 1.095-.109.196-1.138.172a.35.35 0 00-.27.461l.387 1.047-.084.213-1.09.373a.35.35 0 00-.192.494l.572.964-.057.224-.993.557a.35.35 0 00-.107.514l.741.855-.028.228-1.008.623a.35.35 0 000 .594l1.008.623.028.228-.741.855a.35.35 0 00.107.514l.993.557.057.224-.572.964a.35.35 0 00.192.494l1.09.373.084.213-.387 1.047a.35.35 0 00.27.461l1.138.172.109.196-.19 1.095a.35.35 0 00.343.411l1.144-.033.131.173.015 1.108a.35.35 0 00.406.342l1.106-.236.148.144.219 1.083a.35.35 0 00.457.258l1.025-.432.161.11.413 1.018a.35.35 0 00.495.164l.906-.615.168.071.593.915a.35.35 0 00.517.061l.753-.779.17.031.75.778a.35.35 0 00.517-.061l.593-.915.168-.07.906.614a.35.35 0 00.495-.164l.413-1.018.161-.11 1.025.432a.35.35 0 00.457-.258l.219-1.083.148-.144 1.106.236a.35.35 0 00.406-.342l.015-1.108.131-.173 1.144.033a.35.35 0 00.343-.411l-.19-1.095.109-.196 1.138-.172a.35.35 0 00.27-.461l-.387-1.047.084-.213 1.09-.373a.35.35 0 00.192-.494l-.572-.964.057-.224.993-.557a.35.35 0 00.107-.514l-.741-.855.028-.228 1.008-.623a.35.35 0 000-.594zM12 4.21a7.79 7.79 0 110 15.58 7.79 7.79 0 010-15.58z" />
          </svg>
        );
      case "go":
        return (
          <svg viewBox="0 0 24 24" class={iconClass()} fill="currentColor">
            <path d="M1.811 10.231c-.047 0-.058-.023-.035-.059l.246-.315c.023-.035.081-.058.128-.058h4.172c.046 0 .058.035.035.07l-.199.303c-.023.036-.082.07-.117.07zM.047 11.306c-.047 0-.059-.023-.035-.058l.245-.316c.023-.035.082-.058.129-.058h5.328c.047 0 .07.035.058.07l-.093.28c-.012.047-.058.07-.105.07zm2.828 1.075c-.047 0-.059-.035-.035-.07l.163-.292c.023-.035.07-.07.117-.07h2.337c.047 0 .07.035.07.082l-.023.28c0 .047-.047.082-.082.082zm12.129-2.36c-.736.187-1.239.327-1.963.514-.176.046-.187.058-.34-.117-.176-.199-.303-.327-.548-.444-.737-.362-1.45-.257-2.115.175-.795.514-1.204 1.274-1.192 2.22.011.935.654 1.706 1.577 1.835.795.105 1.46-.175 1.987-.771.105-.13.198-.27.315-.434H10.47c-.245 0-.304-.152-.222-.35.152-.362.432-.97.596-1.274a.315.315 0 01.292-.187h4.253c-.023.316-.023.631-.07.947a4.983 4.983 0 01-.958 2.29c-.841 1.11-1.94 1.8-3.33 1.986-1.145.152-2.209-.07-3.143-.77-.865-.655-1.356-1.52-1.484-2.595-.152-1.274.222-2.419.993-3.424.83-1.086 1.928-1.776 3.272-2.02 1.098-.2 2.15-.07 3.096.571.62.41 1.063.97 1.356 1.648.07.105.023.164-.117.199z" />
          </svg>
        );
      case "html":
        return (
          <svg viewBox="0 0 24 24" class={iconClass()} fill="currentColor">
            <path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z" />
          </svg>
        );
      case "css":
      case "scss":
      case "less":
        return (
          <svg viewBox="0 0 24 24" class={iconClass()} fill="currentColor">
            <path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.565-2.438L1.5 0zm17.09 4.413L5.41 4.41l.213 2.622 10.125.002-.255 2.716h-6.64l.24 2.573h6.182l-.366 3.523-2.91.804-2.956-.81-.188-2.11h-2.61l.29 3.855L12 19.288l5.373-1.53L18.59 4.413z" />
          </svg>
        );
      case "json":
      case "jsonc":
        return (
          <svg viewBox="0 0 24 24" class={iconClass()} fill="currentColor">
            <path d="M12.043 23.968c.479-.004.953-.029 1.426-.094a11.805 11.805 0 003.146-.863 12.404 12.404 0 003.793-2.542 11.977 11.977 0 002.44-3.427 11.794 11.794 0 001.02-3.476c.149-1.16.135-2.346-.045-3.499a11.96 11.96 0 00-.793-2.788 11.197 11.197 0 00-.854-1.617c-1.168-1.837-2.861-3.314-4.81-4.28a12.834 12.834 0 00-2.172-.87h-.005c.119.063.24.132.345.201.553.352 1.009.774 1.377 1.263.373.494.653 1.036.844 1.615.192.583.283 1.19.279 1.796-.012.627-.114 1.256-.312 1.854-.205.606-.505 1.178-.896 1.701-.397.528-.884.993-1.448 1.373-.571.38-1.21.674-1.878.871-.671.197-1.375.295-2.074.295a7.62 7.62 0 01-2.007-.265 7.388 7.388 0 01-1.894-.768A7.577 7.577 0 014.59 8.422a8.091 8.091 0 01-.965-1.672 8.333 8.333 0 01-.531-1.862 8.313 8.313 0 01.004-2.036c.074-.495.19-.983.349-1.458.044-.129.093-.259.145-.385.018-.042.038-.086.058-.127.008-.017.02-.033.024-.051-.003.012-.007.027-.008.037a11.947 11.947 0 00-2.163 5.596 12.039 12.039 0 00.484 5.374 11.831 11.831 0 002.593 4.407 12.087 12.087 0 004.154 3.122 12.084 12.084 0 004.918 1.142h.047l-.035.001z" />
          </svg>
        );
      case "markdown":
      case "md":
        return (
          <svg viewBox="0 0 24 24" class={iconClass()} fill="currentColor">
            <path d="M22.27 19.385H1.73A1.73 1.73 0 010 17.655V6.345a1.73 1.73 0 011.73-1.73h20.54A1.73 1.73 0 0124 6.345v11.31a1.73 1.73 0 01-1.73 1.73zM5.769 15.923v-4.5l2.308 2.885 2.307-2.885v4.5h2.308V8.077h-2.308l-2.307 2.885-2.308-2.885H3.46v7.846zM21.232 12h-2.309V8.077h-2.307V12h-2.308l3.462 4.615z" />
          </svg>
        );
      default:
        return <Icon name="code" class={iconClass()} />;
    }
  };

  return <span style={{ color: "var(--text-weak)" }}>{getIcon()}</span>;
}

// ============================================================================
// Language Category
// ============================================================================

type LanguageCategory = "popular" | "web" | "systems" | "scripting" | "data" | "other";

function getLanguageCategory(id: string): LanguageCategory {
  const webLanguages = ["html", "css", "scss", "less", "javascript", "typescript", "jsx", "tsx", "vue", "svelte", "astro", "php"];
  const systemsLanguages = ["c", "cpp", "rust", "go", "swift", "objective-c", "java", "kotlin", "csharp", "fsharp", "scala"];
  const scriptingLanguages = ["python", "ruby", "perl", "lua", "shell", "bash", "powershell", "bat"];
  const dataLanguages = ["json", "jsonc", "yaml", "xml", "toml", "ini", "sql", "graphql"];
  const popularLanguages = ["javascript", "typescript", "python", "rust", "go", "html", "css", "json", "markdown"];

  if (popularLanguages.includes(id)) return "popular";
  if (webLanguages.includes(id)) return "web";
  if (systemsLanguages.includes(id)) return "systems";
  if (scriptingLanguages.includes(id)) return "scripting";
  if (dataLanguages.includes(id)) return "data";
  return "other";
}

function getCategoryLabel(category: LanguageCategory): string {
  switch (category) {
    case "popular": return "Popular";
    case "web": return "Web";
    case "systems": return "Systems";
    case "scripting": return "Scripting";
    case "data": return "Data & Config";
    case "other": return "Other";
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function LanguageSelector(props: LanguageSelectorProps) {
  const languageSelector = useLanguageSelector();
  const { state: editorState } = useEditor();
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [showCategories] = createSignal(true);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  const currentFileId = () => props.fileId || languageSelector.state.currentFileId;

  const currentFile = createMemo(() => {
    const fileId = currentFileId();
    if (!fileId) return null;
    return editorState.openFiles.find((f) => f.id === fileId);
  });

  const currentLanguage = createMemo(() => {
    const file = currentFile();
    if (!file) return "plaintext";
    
    // Check for override first
    const override = languageSelector.getFileLanguage(file.id);
    if (override && override !== "plaintext") return override;
    
    return file.language || "plaintext";
  });

  const filteredLanguages = createMemo(() => {
    const query = searchQuery();
    return languageSelector.searchLanguages(query);
  });

  const groupedLanguages = createMemo(() => {
    if (searchQuery()) {
      return null; // Don't group when searching
    }
    
    const languages = filteredLanguages();
    const groups: Record<LanguageCategory, LanguageInfo[]> = {
      popular: [],
      web: [],
      systems: [],
      scripting: [],
      data: [],
      other: [],
    };

    languages.forEach((lang) => {
      const category = getLanguageCategory(lang.id);
      groups[category].push(lang);
    });

    return groups;
  });

  const flatLanguages = createMemo(() => {
    if (searchQuery()) {
      return filteredLanguages();
    }

    if (!showCategories()) {
      return filteredLanguages();
    }

    const groups = groupedLanguages();
    if (!groups) return filteredLanguages();

    const result: LanguageInfo[] = [];
    const categories: LanguageCategory[] = ["popular", "web", "systems", "scripting", "data", "other"];
    
    categories.forEach((cat) => {
      result.push(...groups[cat]);
    });

    return result;
  });

  // Reset selection when languages change
  createEffect(() => {
    flatLanguages();
    setSelectedIndex(0);
  });

  // Auto-focus input
  onMount(() => {
    inputRef?.focus();
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    const languages = flatLanguages();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, languages.length - 1));
        scrollToSelected();
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        scrollToSelected();
        break;
      case "Enter":
        e.preventDefault();
        if (languages[selectedIndex()]) {
          selectLanguage(languages[selectedIndex()]);
        }
        break;
      case "Escape":
        e.preventDefault();
        handleClose();
        break;
    }
  };

  const scrollToSelected = () => {
    if (listRef) {
      const selected = listRef.querySelector(`[data-index="${selectedIndex()}"]`);
      selected?.scrollIntoView({ block: "nearest" });
    }
  };

  const selectLanguage = (lang: LanguageInfo) => {
    const fileId = currentFileId();
    if (fileId) {
      languageSelector.setFileLanguage(fileId, lang.id);
    }
    handleClose();
  };

  const handleClose = () => {
    languageSelector.closeSelector();
    props.onClose?.();
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        class="w-[480px] max-h-[60vh] flex flex-col rounded-lg shadow-2xl overflow-hidden"
        style={{
          background: "var(--surface-base)",
          border: "1px solid var(--border-base)",
        }}
      >
        {/* Header */}
        <div
          class="flex items-center gap-3 px-4 py-3 border-b shrink-0"
          style={{ "border-color": "var(--border-base)" }}
        >
          <Icon name="code" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
          <span class="font-medium" style={{ color: "var(--text-strong)" }}>
            Select Language Mode
          </span>
          <div class="flex-1" />
          <button
            onClick={handleClose}
            class="p-1.5 rounded hover:bg-[var(--surface-hover)]"
          >
            <Icon name="xmark" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          </button>
        </div>

        {/* Current File Info */}
        <Show when={currentFile()}>
          <div
            class="flex items-center gap-2 px-4 py-2 border-b shrink-0"
            style={{
              "border-color": "var(--border-base)",
              background: "var(--surface-raised)",
            }}
          >
            <Icon name="file" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
            <span class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
              {currentFile()?.name}
            </span>
            <span class="text-xs" style={{ color: "var(--text-weaker)" }}>•</span>
            <span class="text-xs" style={{ color: "var(--accent)" }}>
              {languageSelector.getLanguageDisplayName(currentLanguage())}
            </span>
          </div>
        </Show>

        {/* Search Input */}
        <div
          class="flex items-center gap-2 px-4 py-3 border-b shrink-0"
          style={{ "border-color": "var(--border-base)" }}
        >
          <Icon name="magnifying-glass" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          <input
            ref={inputRef}
            type="text"
            class="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--text-base)" }}
            placeholder="Search languages..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
          <Show when={searchQuery()}>
            <button
              onClick={() => setSearchQuery("")}
              class="p-1 rounded hover:bg-[var(--surface-hover)]"
            >
              <Icon name="xmark" class="w-3 h-3" style={{ color: "var(--text-weak)" }} />
            </button>
          </Show>
        </div>

        {/* Language List */}
        <div ref={listRef} class="flex-1 overflow-auto">
          <Show
            when={flatLanguages().length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center py-12 gap-3">
                <Icon name="code" class="w-8 h-8" style={{ color: "var(--text-weak)" }} />
                <span style={{ color: "var(--text-weak)" }}>
                  No languages found matching "{searchQuery()}"
                </span>
              </div>
            }
          >
            <Show
              when={!searchQuery() && showCategories() && groupedLanguages()}
              fallback={
                <For each={flatLanguages()}>
                  {(lang, index) => (
                    <LanguageItem
                      language={lang}
                      isSelected={selectedIndex() === index()}
                      isCurrent={lang.id === currentLanguage()}
                      dataIndex={index()}
                      onClick={() => selectLanguage(lang)}
                      onHover={() => setSelectedIndex(index())}
                    />
                  )}
                </For>
              }
            >
              {(groups) => {
                let currentIndex = 0;
                const categories: LanguageCategory[] = ["popular", "web", "systems", "scripting", "data", "other"];
                
                return (
                  <For each={categories}>
                    {(category) => {
                      const categoryLangs = groups()[category];
                      if (!categoryLangs || categoryLangs.length === 0) return null;

                      const startIndex = currentIndex;
                      currentIndex += categoryLangs.length;

                      return (
                        <div>
                          <div
                            class="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider sticky top-0"
                            style={{
                              color: "var(--text-weaker)",
                              background: "var(--surface-base)",
                            }}
                          >
                            {getCategoryLabel(category)}
                          </div>
                          <For each={categoryLangs}>
                            {(lang, i) => {
                              const absoluteIndex = startIndex + i();
                              return (
                                <LanguageItem
                                  language={lang}
                                  isSelected={selectedIndex() === absoluteIndex}
                                  isCurrent={lang.id === currentLanguage()}
                                  dataIndex={absoluteIndex}
                                  onClick={() => selectLanguage(lang)}
                                  onHover={() => setSelectedIndex(absoluteIndex)}
                                />
                              );
                            }}
                          </For>
                        </div>
                      );
                    }}
                  </For>
                );
              }}
            </Show>
          </Show>
        </div>

        {/* Footer */}
        <div
          class="flex items-center justify-between px-4 py-2 border-t shrink-0"
          style={{
            "border-color": "var(--border-base)",
            background: "var(--surface-raised)",
          }}
        >
          <div class="flex items-center gap-3 text-xs" style={{ color: "var(--text-weak)" }}>
            <span>
              <kbd class="px-1.5 py-0.5 rounded" style={{ background: "var(--surface-base)" }}>
                ↑↓
              </kbd>{" "}
              Navigate
            </span>
            <span>
              <kbd class="px-1.5 py-0.5 rounded" style={{ background: "var(--surface-base)" }}>
                Enter
              </kbd>{" "}
              Select
            </span>
            <span>
              <kbd class="px-1.5 py-0.5 rounded" style={{ background: "var(--surface-base)" }}>
                Esc
              </kbd>{" "}
              Close
            </span>
          </div>
          <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
            {flatLanguages().length} languages
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Language Item
// ============================================================================

interface LanguageItemProps {
  language: LanguageInfo;
  isSelected: boolean;
  isCurrent: boolean;
  dataIndex: number;
  onClick: () => void;
  onHover: () => void;
}

function LanguageItem(props: LanguageItemProps) {
  return (
    <button
      data-index={props.dataIndex}
      class="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors"
      style={{
        background: props.isSelected ? "var(--surface-hover)" : "transparent",
      }}
      onClick={props.onClick}
      onMouseEnter={props.onHover}
    >
      <div class="w-6 h-6 flex items-center justify-center shrink-0">
        <LanguageIcon languageId={props.language.id} class="w-4 h-4" />
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="font-medium truncate text-sm"
            style={{ color: props.isCurrent ? "var(--accent)" : "var(--text-strong)" }}
          >
            {props.language.name}
          </span>
          <Show when={props.isCurrent}>
            <span
              class="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: "var(--accent)", color: "white" }}
            >
              CURRENT
            </span>
          </Show>
        </div>
        <Show when={props.language.extensions.length > 0}>
          <div class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
            {props.language.extensions.slice(0, 5).join(", ")}
            {props.language.extensions.length > 5 && "..."}
          </div>
        </Show>
      </div>

      <Show when={props.isCurrent}>
        <Icon name="check" class="w-4 h-4 shrink-0" style={{ color: "var(--success)" }} />
      </Show>
      <Show when={!props.isCurrent && props.isSelected}>
        <Icon name="chevron-right" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
      </Show>
    </button>
  );
}

// ============================================================================
// Compact Language Button (for StatusBar)
// ============================================================================

export interface LanguageStatusProps {
  fileId?: string;
  language?: string;
  onClick?: () => void;
}

export function LanguageStatus(props: LanguageStatusProps) {
  const languageSelector = useLanguageSelector();
  const { state: editorState } = useEditor();

  const currentLanguage = createMemo(() => {
    const fileId = props.fileId || editorState.activeFileId;
    if (!fileId) return props.language || "Plain Text";

    // Check for override
    const override = languageSelector.state.fileLanguageOverrides[fileId];
    if (override) {
      return languageSelector.getLanguageDisplayName(override);
    }

    // Use provided language or detect
    if (props.language) {
      return languageSelector.getLanguageDisplayName(props.language);
    }

    return "Plain Text";
  });

  const handleClick = () => {
    if (props.onClick) {
      props.onClick();
      return;
    }

    const fileId = props.fileId || editorState.activeFileId;
    if (fileId) {
      languageSelector.openSelector(fileId);
    }
  };

  return (
    <button
      class="flex items-center gap-1.5 hover:text-white transition-colors"
      onClick={handleClick}
      title="Select Language Mode"
    >
      <span>{currentLanguage()}</span>
    </button>
  );
}

// ============================================================================
// Modal Wrapper
// ============================================================================

export function LanguageSelectorModal() {
  const languageSelector = useLanguageSelector();

  return (
    <Show when={languageSelector.state.showSelector}>
      <LanguageSelector />
    </Show>
  );
}
