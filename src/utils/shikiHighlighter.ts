/**
 * Shiki Highlighter Utility - Maximum Performance Optimization
 * 
 * Uses shiki/core with single theme for minimal bundle size.
 * Languages loaded on-demand only when needed.
 * 
 * Bundle impact:
 * - Core: ~100KB (loaded on first highlight)
 * - WASM: ~600KB (loaded on first highlight)  
 * - Theme: ~8KB (single theme)
 * - Languages: loaded individually when used
 */

// ============================================================================
// Language Aliases
// ============================================================================

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript", 
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rs: "rust",
  rb: "ruby",
  sh: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  "c++": "cpp",
  "c#": "csharp",
  cs: "csharp",
  kt: "kotlin",
  docker: "dockerfile",
  text: "plaintext",
  txt: "plaintext",
  plain: "plaintext",
};

// ============================================================================
// Dynamic Language Imports (true lazy loading)
// ============================================================================

const LANG_IMPORTS: Record<string, () => Promise<unknown>> = {
  javascript: () => import("shiki/langs/javascript.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  cpp: () => import("shiki/langs/cpp.mjs"),
  c: () => import("shiki/langs/c.mjs"),
  bash: () => import("shiki/langs/bash.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  graphql: () => import("shiki/langs/graphql.mjs"),
  dockerfile: () => import("shiki/langs/dockerfile.mjs"),
  diff: () => import("shiki/langs/diff.mjs"),
  xml: () => import("shiki/langs/xml.mjs"),
  scss: () => import("shiki/langs/scss.mjs"),
  ruby: () => import("shiki/langs/ruby.mjs"),
  php: () => import("shiki/langs/php.mjs"),
  swift: () => import("shiki/langs/swift.mjs"),
  kotlin: () => import("shiki/langs/kotlin.mjs"),
  csharp: () => import("shiki/langs/csharp.mjs"),
  shell: () => import("shiki/langs/shellscript.mjs"),
};

// ============================================================================
// Highlighter State
// ============================================================================

type HighlighterType = Awaited<ReturnType<typeof import("shiki/core").createHighlighterCore>>;
let highlighter: HighlighterType | null = null;
let highlighterPromise: Promise<HighlighterType> | null = null;
const loadedLangs = new Set<string>();

// ============================================================================
// Core Functions
// ============================================================================

async function getHighlighter(): Promise<HighlighterType | null> {
  if (highlighter) return highlighter;
  if (highlighterPromise) return highlighterPromise;

  highlighterPromise = (async () => {
    // Dynamic imports for core and engine
    const [{ createHighlighterCore }, { createOnigurumaEngine }] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/oniguruma"),
    ]);

    // Load only github-dark theme
    const githubDark = await import("shiki/themes/github-dark.mjs");

    highlighter = await createHighlighterCore({
      themes: [githubDark.default],
      langs: [], // No languages preloaded
      engine: createOnigurumaEngine(import("shiki/wasm")),
    });

    return highlighter;
  })();

  return highlighterPromise;
}

async function loadLanguage(lang: string): Promise<boolean> {
  if (loadedLangs.has(lang)) return true;
  
  const importFn = LANG_IMPORTS[lang];
  if (!importFn) return false;

  try {
    const h = await getHighlighter();
    if (!h) return false;
    
    const langModule = await importFn();
    await h.loadLanguage(langModule as Parameters<typeof h.loadLanguage>[0]);
    loadedLangs.add(lang);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Highlight code with Shiki (async, lazy-loaded)
 */
export async function highlightCode(
  code: string,
  language: string,
  _theme: string = "github-dark"
): Promise<string> {
  const lang = normalizeLanguage(language);
  
  if (lang === "plaintext" || !LANG_IMPORTS[lang]) {
    return createPlainHtml(code);
  }

  try {
    const h = await getHighlighter();
    if (!h) return createPlainHtml(code);

    // Load language if needed
    if (!loadedLangs.has(lang)) {
      const loaded = await loadLanguage(lang);
      if (!loaded) return createPlainHtml(code);
    }

    return h.codeToHtml(code, {
      lang,
      theme: "github-dark",
    });
  } catch (error) {
    console.warn("Shiki highlight error:", error);
    return createPlainHtml(code);
  }
}

/**
 * Normalize language identifier
 */
export function normalizeLanguage(lang: string | undefined): string {
  if (!lang) return "plaintext";
  const normalized = lang.toLowerCase().trim();
  return LANGUAGE_ALIASES[normalized] || normalized;
}

/**
 * Check if language is supported
 */
export function isLanguageSupported(lang: string): boolean {
  const normalized = normalizeLanguage(lang);
  return normalized in LANG_IMPORTS || normalized === "plaintext";
}

/**
 * Detect language from file path
 */
export function detectLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const fileName = filePath.split(/[/\\]/).pop()?.toLowerCase() || "";
  
  if (fileName === "dockerfile" || fileName.startsWith("dockerfile.")) return "dockerfile";
  
  const extMap: Record<string, string> = {
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
    py: "python", rs: "rust", go: "go", java: "java",
    c: "c", h: "c", cpp: "cpp", hpp: "cpp", cc: "cpp",
    cs: "csharp", rb: "ruby", php: "php", swift: "swift", kt: "kotlin",
    html: "html", htm: "html", css: "css", scss: "scss",
    json: "json", yaml: "yaml", yml: "yaml", toml: "toml", xml: "xml",
    md: "markdown", mdx: "markdown",
    sh: "bash", bash: "bash", zsh: "bash",
    sql: "sql", graphql: "graphql", gql: "graphql",
    diff: "diff", patch: "diff",
  };
  
  return extMap[ext] || "plaintext";
}

/**
 * Lightweight synchronous fallback for rendering code before Shiki loads.
 * Returns a plain `<pre>` block with escaped HTML — no syntax highlighting.
 * Use this as the initial/placeholder render while `highlightCode()` resolves.
 */
export function getPlainHighlightHtml(code: string, _language?: string): string {
  return createPlainHtml(code);
}

/**
 * Dispose highlighter (for cleanup)
 */
export function disposeHighlighter(): void {
  if (highlighter) {
    highlighter.dispose();
    highlighter = null;
    highlighterPromise = null;
    loadedLangs.clear();
  }
}

// ============================================================================
// Utilities  
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createPlainHtml(code: string): string {
  return `<pre class="shiki" style="background-color:#0d1117;color:#e6edf3;padding:1em;overflow-x:auto;border-radius:6px"><code>${escapeHtml(code)}</code></pre>`;
}
