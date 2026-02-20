import { createContext, useContext, ParentComponent, onMount, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types
// ============================================================================

export interface LanguageInfo {
  id: string;
  name: string;
  aliases: string[];
  extensions: string[];
  mimeTypes: string[];
}

export interface LanguageAssociation {
  pattern: string;
  languageId: string;
}

export interface LanguageSelectorSettings {
  customAssociations: LanguageAssociation[];
}

// ============================================================================
// Monaco Language Registry - Comprehensive list of supported languages
// ============================================================================

const MONACO_LANGUAGES: LanguageInfo[] = [
  { id: "abap", name: "ABAP", aliases: ["ABAP"], extensions: [".abap"], mimeTypes: [] },
  { id: "apex", name: "Apex", aliases: ["Apex"], extensions: [".cls", ".apex"], mimeTypes: [] },
  { id: "azcli", name: "Azure CLI", aliases: ["azcli"], extensions: [".azcli"], mimeTypes: [] },
  { id: "bat", name: "Batch", aliases: ["Batch", "batch"], extensions: [".bat", ".cmd"], mimeTypes: [] },
  { id: "bicep", name: "Bicep", aliases: ["Bicep"], extensions: [".bicep"], mimeTypes: [] },
  { id: "c", name: "C", aliases: ["C", "c"], extensions: [".c", ".h"], mimeTypes: ["text/x-c"] },
  { id: "cameligo", name: "Cameligo", aliases: ["Cameligo"], extensions: [".mligo"], mimeTypes: [] },
  { id: "clojure", name: "Clojure", aliases: ["Clojure", "clojure"], extensions: [".clj", ".cljs", ".cljc", ".edn"], mimeTypes: [] },
  { id: "coffeescript", name: "CoffeeScript", aliases: ["CoffeeScript", "coffeescript", "coffee"], extensions: [".coffee"], mimeTypes: ["text/coffeescript"] },
  { id: "cpp", name: "C++", aliases: ["C++", "Cpp", "cpp"], extensions: [".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx", ".h++", ".ipp"], mimeTypes: ["text/x-c++src"] },
  { id: "csharp", name: "C#", aliases: ["C#", "CSharp", "csharp", "cs"], extensions: [".cs", ".csx"], mimeTypes: ["text/x-csharp"] },
  { id: "csp", name: "CSP", aliases: ["CSP"], extensions: [], mimeTypes: [] },
  { id: "css", name: "CSS", aliases: ["CSS", "css"], extensions: [".css"], mimeTypes: ["text/css"] },
  { id: "cypher", name: "Cypher", aliases: ["Cypher"], extensions: [".cypher", ".cyp"], mimeTypes: [] },
  { id: "dart", name: "Dart", aliases: ["Dart", "dart"], extensions: [".dart"], mimeTypes: [] },
  { id: "dockerfile", name: "Dockerfile", aliases: ["Dockerfile", "dockerfile"], extensions: [".dockerfile"], mimeTypes: [] },
  { id: "ecl", name: "ECL", aliases: ["ECL"], extensions: [".ecl"], mimeTypes: [] },
  { id: "elixir", name: "Elixir", aliases: ["Elixir", "elixir"], extensions: [".ex", ".exs"], mimeTypes: [] },
  { id: "flow9", name: "Flow9", aliases: ["Flow9"], extensions: [".flow"], mimeTypes: [] },
  { id: "freemarker2", name: "FreeMarker", aliases: ["FreeMarker"], extensions: [".ftl", ".ftlh", ".ftlx"], mimeTypes: [] },
  { id: "fsharp", name: "F#", aliases: ["F#", "FSharp", "fsharp"], extensions: [".fs", ".fsi", ".fsx", ".fsscript"], mimeTypes: [] },
  { id: "go", name: "Go", aliases: ["Go", "go"], extensions: [".go"], mimeTypes: ["text/x-go"] },
  { id: "graphql", name: "GraphQL", aliases: ["GraphQL", "graphql"], extensions: [".graphql", ".gql"], mimeTypes: [] },
  { id: "handlebars", name: "Handlebars", aliases: ["Handlebars", "handlebars", "hbs"], extensions: [".handlebars", ".hbs"], mimeTypes: [] },
  { id: "hcl", name: "HCL", aliases: ["HCL", "Terraform"], extensions: [".hcl", ".tf", ".tfvars"], mimeTypes: [] },
  { id: "html", name: "HTML", aliases: ["HTML", "htm", "html"], extensions: [".html", ".htm", ".shtml", ".xhtml", ".mdoc", ".jshtm", ".volt"], mimeTypes: ["text/html"] },
  { id: "ini", name: "Ini", aliases: ["Ini", "ini"], extensions: [".ini", ".properties", ".gitconfig"], mimeTypes: [] },
  { id: "java", name: "Java", aliases: ["Java", "java"], extensions: [".java", ".jav"], mimeTypes: ["text/x-java"] },
  { id: "javascript", name: "JavaScript", aliases: ["JavaScript", "javascript", "js"], extensions: [".js", ".mjs", ".cjs", ".es6", ".pac"], mimeTypes: ["text/javascript", "application/javascript"] },
  { id: "json", name: "JSON", aliases: ["JSON", "json"], extensions: [".json", ".bowerrc", ".jshintrc", ".jscsrc", ".eslintrc", ".babelrc", ".webmanifest"], mimeTypes: ["application/json"] },
  { id: "julia", name: "Julia", aliases: ["Julia", "julia"], extensions: [".jl"], mimeTypes: [] },
  { id: "kotlin", name: "Kotlin", aliases: ["Kotlin", "kotlin"], extensions: [".kt", ".kts"], mimeTypes: [] },
  { id: "less", name: "Less", aliases: ["Less", "less"], extensions: [".less"], mimeTypes: ["text/x-less"] },
  { id: "lexon", name: "Lexon", aliases: ["Lexon"], extensions: [".lex"], mimeTypes: [] },
  { id: "liquid", name: "Liquid", aliases: ["Liquid"], extensions: [".liquid"], mimeTypes: [] },
  { id: "lua", name: "Lua", aliases: ["Lua", "lua"], extensions: [".lua"], mimeTypes: ["text/x-lua"] },
  { id: "m3", name: "Modula-3", aliases: ["Modula-3"], extensions: [".m3", ".i3", ".mg", ".ig"], mimeTypes: [] },
  { id: "markdown", name: "Markdown", aliases: ["Markdown", "markdown", "md"], extensions: [".md", ".markdown", ".mdown", ".mkdn", ".mkd", ".mdwn", ".mdtxt", ".mdtext"], mimeTypes: ["text/markdown"] },
  { id: "mdx", name: "MDX", aliases: ["MDX", "mdx"], extensions: [".mdx"], mimeTypes: [] },
  { id: "mips", name: "MIPS", aliases: ["MIPS"], extensions: [".s"], mimeTypes: [] },
  { id: "msdax", name: "DAX", aliases: ["DAX"], extensions: [".dax", ".msdax"], mimeTypes: [] },
  { id: "mysql", name: "MySQL", aliases: ["MySQL", "mysql"], extensions: [], mimeTypes: [] },
  { id: "objective-c", name: "Objective-C", aliases: ["Objective-C", "objc"], extensions: [".m"], mimeTypes: [] },
  { id: "pascal", name: "Pascal", aliases: ["Pascal", "pascal"], extensions: [".pas", ".p", ".pp"], mimeTypes: [] },
  { id: "pascaligo", name: "Pascaligo", aliases: ["Pascaligo"], extensions: [".ligo"], mimeTypes: [] },
  { id: "perl", name: "Perl", aliases: ["Perl", "perl"], extensions: [".pl", ".pm"], mimeTypes: [] },
  { id: "pgsql", name: "PostgreSQL", aliases: ["PostgreSQL", "postgres", "pg", "pgsql"], extensions: [], mimeTypes: [] },
  { id: "php", name: "PHP", aliases: ["PHP", "php"], extensions: [".php", ".php4", ".php5", ".phtml", ".ctp"], mimeTypes: ["text/x-php"] },
  { id: "pla", name: "PLA", aliases: ["PLA"], extensions: [".pla"], mimeTypes: [] },
  { id: "plaintext", name: "Plain Text", aliases: ["Plain Text", "text", "plaintext"], extensions: [".txt"], mimeTypes: ["text/plain"] },
  { id: "postiats", name: "ATS", aliases: ["ATS"], extensions: [".dats", ".sats", ".hats"], mimeTypes: [] },
  { id: "powerquery", name: "Power Query", aliases: ["Power Query", "PQ"], extensions: [".pq", ".pqm"], mimeTypes: [] },
  { id: "powershell", name: "PowerShell", aliases: ["PowerShell", "powershell", "ps", "ps1"], extensions: [".ps1", ".psm1", ".psd1"], mimeTypes: [] },
  { id: "proto", name: "Protocol Buffers", aliases: ["Protocol Buffers", "protobuf"], extensions: [".proto"], mimeTypes: [] },
  { id: "pug", name: "Pug", aliases: ["Pug", "Jade", "jade"], extensions: [".pug", ".jade"], mimeTypes: [] },
  { id: "python", name: "Python", aliases: ["Python", "python", "py"], extensions: [".py", ".pyw", ".pyi", ".pyx", ".pxd"], mimeTypes: ["text/x-python"] },
  { id: "qsharp", name: "Q#", aliases: ["Q#", "qsharp"], extensions: [".qs"], mimeTypes: [] },
  { id: "r", name: "R", aliases: ["R", "r"], extensions: [".r", ".rhistory", ".rmd", ".rprofile", ".rt"], mimeTypes: [] },
  { id: "razor", name: "Razor", aliases: ["Razor", "razor"], extensions: [".cshtml"], mimeTypes: [] },
  { id: "redis", name: "Redis", aliases: ["Redis", "redis"], extensions: [".redis"], mimeTypes: [] },
  { id: "redshift", name: "Redshift", aliases: ["Redshift"], extensions: [], mimeTypes: [] },
  { id: "restructuredtext", name: "reStructuredText", aliases: ["reStructuredText", "rst"], extensions: [".rst"], mimeTypes: [] },
  { id: "ruby", name: "Ruby", aliases: ["Ruby", "ruby", "rb"], extensions: [".rb", ".rbx", ".rjs", ".gemspec", ".rake", ".ru"], mimeTypes: ["text/x-ruby"] },
  { id: "rust", name: "Rust", aliases: ["Rust", "rust", "rs"], extensions: [".rs"], mimeTypes: ["text/x-rust"] },
  { id: "sb", name: "Small Basic", aliases: ["Small Basic"], extensions: [".sb"], mimeTypes: [] },
  { id: "scala", name: "Scala", aliases: ["Scala", "scala"], extensions: [".scala", ".sc", ".sbt"], mimeTypes: [] },
  { id: "scheme", name: "Scheme", aliases: ["Scheme", "scheme"], extensions: [".scm", ".ss", ".sch", ".rkt"], mimeTypes: [] },
  { id: "scss", name: "SCSS", aliases: ["SCSS", "scss"], extensions: [".scss"], mimeTypes: ["text/x-scss"] },
  { id: "shell", name: "Shell Script", aliases: ["Shell Script", "shellscript", "bash", "sh", "zsh"], extensions: [".sh", ".bash", ".bashrc", ".bash_aliases", ".bash_profile", ".bash_login", ".ebuild", ".profile", ".bash_logout", ".xprofile", ".xsession", ".xsessionrc", ".zsh", ".zshrc", ".zprofile", ".zlogin", ".zlogout", ".zshenv", ".zsh-theme", ".ksh"], mimeTypes: ["text/x-sh"] },
  { id: "sol", name: "Solidity", aliases: ["Solidity", "sol"], extensions: [".sol"], mimeTypes: [] },
  { id: "sparql", name: "SPARQL", aliases: ["SPARQL"], extensions: [".rq"], mimeTypes: [] },
  { id: "sql", name: "SQL", aliases: ["SQL", "sql"], extensions: [".sql"], mimeTypes: [] },
  { id: "st", name: "Structured Text", aliases: ["Structured Text", "IEC 61131-3"], extensions: [".st", ".iecst", ".iecplc", ".lc3lib"], mimeTypes: [] },
  { id: "swift", name: "Swift", aliases: ["Swift", "swift"], extensions: [".swift"], mimeTypes: [] },
  { id: "systemverilog", name: "SystemVerilog", aliases: ["SystemVerilog", "SV"], extensions: [".sv", ".svh"], mimeTypes: [] },
  { id: "tcl", name: "Tcl", aliases: ["Tcl", "tcl"], extensions: [".tcl"], mimeTypes: [] },
  { id: "twig", name: "Twig", aliases: ["Twig"], extensions: [".twig"], mimeTypes: [] },
  { id: "typescript", name: "TypeScript", aliases: ["TypeScript", "typescript", "ts"], extensions: [".ts", ".mts", ".cts"], mimeTypes: ["text/typescript"] },
  { id: "typespec", name: "TypeSpec", aliases: ["TypeSpec"], extensions: [".tsp"], mimeTypes: [] },
  { id: "vb", name: "Visual Basic", aliases: ["Visual Basic", "vb"], extensions: [".vb"], mimeTypes: [] },
  { id: "verilog", name: "Verilog", aliases: ["Verilog"], extensions: [".v", ".vh"], mimeTypes: [] },
  { id: "wgsl", name: "WGSL", aliases: ["WGSL"], extensions: [".wgsl"], mimeTypes: [] },
  { id: "xml", name: "XML", aliases: ["XML", "xml"], extensions: [".xml", ".xsd", ".xsl", ".xslt", ".svg", ".dtd"], mimeTypes: ["text/xml", "application/xml"] },
  { id: "yaml", name: "YAML", aliases: ["YAML", "yaml", "yml"], extensions: [".yaml", ".yml"], mimeTypes: ["text/yaml"] },
  // Additional common languages used in development
  { id: "tsx", name: "TypeScript React", aliases: ["TypeScript React", "TypeScript JSX", "tsx"], extensions: [".tsx"], mimeTypes: [] },
  { id: "jsx", name: "JavaScript React", aliases: ["JavaScript React", "JavaScript JSX", "jsx"], extensions: [".jsx"], mimeTypes: [] },
  { id: "jsonc", name: "JSON with Comments", aliases: ["JSON with Comments", "jsonc"], extensions: [".jsonc", ".code-workspace", ".code-snippets"], mimeTypes: [] },
  { id: "toml", name: "TOML", aliases: ["TOML", "toml"], extensions: [".toml"], mimeTypes: [] },
  { id: "vue", name: "Vue", aliases: ["Vue", "vue"], extensions: [".vue"], mimeTypes: [] },
  { id: "svelte", name: "Svelte", aliases: ["Svelte", "svelte"], extensions: [".svelte"], mimeTypes: [] },
  { id: "astro", name: "Astro", aliases: ["Astro", "astro"], extensions: [".astro"], mimeTypes: [] },
];

// Special filename mappings (case-insensitive)
const FILENAME_LANGUAGE_MAP: Record<string, string> = {
  "dockerfile": "dockerfile",
  "makefile": "shell",
  "gnumakefile": "shell",
  "cmakelists.txt": "cmake",
  "gemfile": "ruby",
  "rakefile": "ruby",
  "vagrantfile": "ruby",
  "podfile": "ruby",
  ".gitignore": "ini",
  ".gitattributes": "ini",
  ".editorconfig": "ini",
  ".dockerignore": "ini",
  ".env": "ini",
  ".env.local": "ini",
  ".env.development": "ini",
  ".env.production": "ini",
  ".env.test": "ini",
  ".babelrc": "json",
  ".eslintrc": "json",
  ".prettierrc": "json",
  "tsconfig.json": "jsonc",
  "jsconfig.json": "jsonc",
  ".vscode/settings.json": "jsonc",
  ".vscode/launch.json": "jsonc",
  ".vscode/tasks.json": "jsonc",
  "package.json": "json",
  "package-lock.json": "json",
  "yarn.lock": "yaml",
  "pnpm-lock.yaml": "yaml",
  "cargo.toml": "toml",
  "cargo.lock": "toml",
  "pyproject.toml": "toml",
  "poetry.lock": "toml",
  "go.mod": "go",
  "go.sum": "plaintext",
};

// ============================================================================
// State
// ============================================================================

interface LanguageSelectorState {
  isLoading: boolean;
  error: string | null;
  languages: LanguageInfo[];
  fileLanguageOverrides: Record<string, string>;
  settings: LanguageSelectorSettings;
  showSelector: boolean;
  currentFileId: string | null;
  /** File associations from SettingsContext (files.associations) */
  settingsAssociations: Record<string, string>;
}

interface LanguageSelectorContextValue {
  state: LanguageSelectorState;

  // Language detection
  detectLanguage: (filename: string, content?: string) => string;
  detectLanguageFromPath: (filePath: string) => Promise<string>;

  // Language management
  getLanguageById: (id: string) => LanguageInfo | undefined;
  getLanguageByExtension: (extension: string) => LanguageInfo | undefined;
  getAllLanguages: () => LanguageInfo[];
  searchLanguages: (query: string) => LanguageInfo[];

  // Override management  
  setFileLanguage: (fileId: string, languageId: string) => void;
  getFileLanguage: (fileId: string, defaultLanguage?: string) => string;
  clearFileLanguage: (fileId: string) => void;

  // Custom associations
  addCustomAssociation: (pattern: string, languageId: string) => void;
  removeCustomAssociation: (pattern: string) => void;
  getCustomAssociations: () => LanguageAssociation[];

  // UI
  openSelector: (fileId: string) => void;
  closeSelector: () => void;

  // Utilities
  getLanguageDisplayName: (languageId: string) => string;
  getMonacoLanguageId: (languageId: string) => string;
}

const LanguageSelectorContext = createContext<LanguageSelectorContextValue>();

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY_OVERRIDES = "cortex_language_overrides";
const STORAGE_KEY_CUSTOM_ASSOCIATIONS = "cortex_language_associations";

// ============================================================================
// Provider
// ============================================================================

export const LanguageSelectorProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<LanguageSelectorState>({
    isLoading: false,
    error: null,
    languages: MONACO_LANGUAGES,
    fileLanguageOverrides: {},
    settings: {
      customAssociations: [],
    },
    showSelector: false,
    currentFileId: null,
    settingsAssociations: {},
  });

  // ============================================================================
  // Initialization
  // ============================================================================

  onMount(() => {
    // Load saved overrides
    try {
      const savedOverrides = localStorage.getItem(STORAGE_KEY_OVERRIDES);
      if (savedOverrides) {
        const overrides = JSON.parse(savedOverrides);
        setState("fileLanguageOverrides", overrides);
      }
    } catch (err) {
      console.debug("[LanguageSelector] Parse overrides failed:", err);
    }

    // Load custom associations
    try {
      const savedAssociations = localStorage.getItem(STORAGE_KEY_CUSTOM_ASSOCIATIONS);
      if (savedAssociations) {
        const associations = JSON.parse(savedAssociations);
        setState("settings", "customAssociations", associations);
      }
    } catch (err) {
      console.debug("[LanguageSelector] Parse associations failed:", err);
    }

    // Listen for language selector events
    const handleOpenSelector = (e: CustomEvent<{ fileId: string }>) => {
      if (e.detail?.fileId) {
        openSelector(e.detail.fileId);
      }
    };

    // Listen for settings file association changes
    const handleFileAssociationChanged = (e: CustomEvent<{ pattern: string; languageId: string }>) => {
      if (e.detail?.pattern && e.detail?.languageId) {
        setState("settingsAssociations", e.detail.pattern, e.detail.languageId);
      }
    };

    const handleFileAssociationRemoved = (e: CustomEvent<{ pattern: string }>) => {
      if (e.detail?.pattern) {
        setState("settingsAssociations", (current) => {
          const updated = { ...current };
          delete updated[e.detail.pattern];
          return updated;
        });
      }
    };

    // Listen for settings loaded (to sync initial associations)
    const handleSettingsChanged = (e: CustomEvent<{ section: string }>) => {
      if (e.detail?.section === "files") {
        // Request current associations from settings
        window.dispatchEvent(new CustomEvent("language-selector:request-associations"));
      }
    };

    // Handler for receiving associations from SettingsContext
    const handleReceiveAssociations = (e: CustomEvent<{ associations: Record<string, string> }>) => {
      if (e.detail?.associations) {
        setState("settingsAssociations", e.detail.associations);
      }
    };

    window.addEventListener("language-selector:open", handleOpenSelector as EventListener);
    window.addEventListener("settings:file-association-changed", handleFileAssociationChanged as EventListener);
    window.addEventListener("settings:file-association-removed", handleFileAssociationRemoved as EventListener);
    window.addEventListener("settings:changed", handleSettingsChanged as EventListener);
    window.addEventListener("language-selector:associations", handleReceiveAssociations as EventListener);

    onCleanup(() => {
      window.removeEventListener("language-selector:open", handleOpenSelector as EventListener);
      window.removeEventListener("settings:file-association-changed", handleFileAssociationChanged as EventListener);
      window.removeEventListener("settings:file-association-removed", handleFileAssociationRemoved as EventListener);
      window.removeEventListener("settings:changed", handleSettingsChanged as EventListener);
      window.removeEventListener("language-selector:associations", handleReceiveAssociations as EventListener);
    });
  });

  // ============================================================================
  // Language Detection
  // ============================================================================

  const detectLanguage = (filename: string, _content?: string): string => {
    const lowerFilename = filename.toLowerCase();
    const baseName = lowerFilename.split("/").pop() || lowerFilename;

    // Check settings-based file associations first (from SettingsContext files.associations)
    for (const [pattern, languageId] of Object.entries(state.settingsAssociations)) {
      if (matchGlobPattern(baseName, pattern)) {
        return languageId;
      }
    }

    // Check legacy custom associations (localStorage-based, for backwards compatibility)
    for (const assoc of state.settings.customAssociations) {
      if (matchGlobPattern(baseName, assoc.pattern)) {
        return assoc.languageId;
      }
    }

    // Check special filename mappings
    if (FILENAME_LANGUAGE_MAP[baseName]) {
      return FILENAME_LANGUAGE_MAP[baseName];
    }

    // Check for files starting with specific patterns
    if (baseName.startsWith(".env")) {
      return "ini";
    }
    if (baseName.startsWith("dockerfile")) {
      return "dockerfile";
    }

    // Get extension
    const extMatch = baseName.match(/\.([^.]+)$/);
    const extension = extMatch ? `.${extMatch[1]}` : "";

    if (extension) {
      // Find language by extension
      const lang = state.languages.find((l) =>
        l.extensions.some((ext) => ext.toLowerCase() === extension)
      );
      if (lang) {
        return lang.id;
      }
    }

    // Default to plaintext
    return "plaintext";
  };

  const detectLanguageFromPath = async (filePath: string): Promise<string> => {
    try {
      const result = await invoke<string>("language_detect_from_path", { path: filePath });
      return result || detectLanguage(filePath);
    } catch (err) {
      console.debug("[LanguageSelector] Backend detection failed:", err);
      return detectLanguage(filePath);
    }
  };

  // ============================================================================
  // Language Queries
  // ============================================================================

  const getLanguageById = (id: string): LanguageInfo | undefined => {
    return state.languages.find((l) => l.id === id || l.aliases.includes(id));
  };

  const getLanguageByExtension = (extension: string): LanguageInfo | undefined => {
    const ext = extension.startsWith(".") ? extension : `.${extension}`;
    return state.languages.find((l) =>
      l.extensions.some((e) => e.toLowerCase() === ext.toLowerCase())
    );
  };

  const getAllLanguages = (): LanguageInfo[] => {
    return [...state.languages].sort((a, b) => a.name.localeCompare(b.name));
  };

  const searchLanguages = (query: string): LanguageInfo[] => {
    if (!query) return getAllLanguages();

    const lowerQuery = query.toLowerCase();
    return state.languages.filter((lang) =>
      lang.name.toLowerCase().includes(lowerQuery) ||
      lang.id.toLowerCase().includes(lowerQuery) ||
      lang.aliases.some((a) => a.toLowerCase().includes(lowerQuery)) ||
      lang.extensions.some((e) => e.toLowerCase().includes(lowerQuery))
    ).sort((a, b) => {
      // Prioritize exact matches
      const aExact = a.name.toLowerCase() === lowerQuery || a.id === lowerQuery;
      const bExact = b.name.toLowerCase() === lowerQuery || b.id === lowerQuery;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      // Then prioritize starts-with matches
      const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
      const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      return a.name.localeCompare(b.name);
    });
  };

  // ============================================================================
  // Override Management
  // ============================================================================

  const setFileLanguage = (fileId: string, languageId: string) => {
    setState("fileLanguageOverrides", fileId, languageId);

    // Persist to storage
    const overrides = { ...state.fileLanguageOverrides, [fileId]: languageId };
    localStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(overrides));

    // Emit event for Monaco editor to pick up
    window.dispatchEvent(new CustomEvent("language:changed", {
      detail: { fileId, languageId },
    }));
  };

  const getFileLanguage = (fileId: string, defaultLanguage = "plaintext"): string => {
    return state.fileLanguageOverrides[fileId] || defaultLanguage;
  };

  const clearFileLanguage = (fileId: string) => {
    const newOverrides = { ...state.fileLanguageOverrides };
    delete newOverrides[fileId];
    setState("fileLanguageOverrides", newOverrides);
    localStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(newOverrides));

    window.dispatchEvent(new CustomEvent("language:cleared", {
      detail: { fileId },
    }));
  };

  // ============================================================================
  // Custom Associations
  // ============================================================================

  const addCustomAssociation = (pattern: string, languageId: string) => {
    const existing = state.settings.customAssociations.findIndex((a) => a.pattern === pattern);
    
    if (existing >= 0) {
      setState("settings", "customAssociations", existing, "languageId", languageId);
    } else {
      setState("settings", "customAssociations", (assocs) => [
        ...assocs,
        { pattern, languageId },
      ]);
    }

    localStorage.setItem(
      STORAGE_KEY_CUSTOM_ASSOCIATIONS,
      JSON.stringify(state.settings.customAssociations)
    );
  };

  const removeCustomAssociation = (pattern: string) => {
    setState("settings", "customAssociations", (assocs) =>
      assocs.filter((a) => a.pattern !== pattern)
    );
    localStorage.setItem(
      STORAGE_KEY_CUSTOM_ASSOCIATIONS,
      JSON.stringify(state.settings.customAssociations)
    );
  };

  const getCustomAssociations = (): LanguageAssociation[] => {
    return state.settings.customAssociations;
  };

  // ============================================================================
  // UI
  // ============================================================================

  const openSelector = (fileId: string) => {
    setState("currentFileId", fileId);
    setState("showSelector", true);
  };

  const closeSelector = () => {
    setState("showSelector", false);
    setState("currentFileId", null);
  };

  // ============================================================================
  // Utilities
  // ============================================================================

  const getLanguageDisplayName = (languageId: string): string => {
    const lang = getLanguageById(languageId);
    return lang?.name || languageId;
  };

  const getMonacoLanguageId = (languageId: string): string => {
    // Map some language IDs to Monaco equivalents
    const monacoMap: Record<string, string> = {
      "tsx": "typescript",
      "jsx": "javascript",
      "shell": "shell",
      "bash": "shell",
      "zsh": "shell",
      "toml": "ini",
    };
    return monacoMap[languageId] || languageId;
  };

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: LanguageSelectorContextValue = {
    state,
    detectLanguage,
    detectLanguageFromPath,
    getLanguageById,
    getLanguageByExtension,
    getAllLanguages,
    searchLanguages,
    setFileLanguage,
    getFileLanguage,
    clearFileLanguage,
    addCustomAssociation,
    removeCustomAssociation,
    getCustomAssociations,
    openSelector,
    closeSelector,
    getLanguageDisplayName,
    getMonacoLanguageId,
  };

  return (
    <LanguageSelectorContext.Provider value={value}>
      {props.children}
    </LanguageSelectorContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

export function useLanguageSelector() {
  const ctx = useContext(LanguageSelectorContext);
  if (!ctx) throw new Error("useLanguageSelector must be used within LanguageSelectorProvider");
  return ctx;
}

// ============================================================================
// Helper Functions
// ============================================================================

function matchGlobPattern(filename: string, pattern: string): boolean {
  // Simple glob matching for common patterns
  // Supports: *, **, ?
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape regex special chars except * and ?
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, ".");

  const regex = new RegExp(`^${regexPattern}$`, "i");
  return regex.test(filename);
}
