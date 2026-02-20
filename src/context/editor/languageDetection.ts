export function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const name = filename.toLowerCase();
  
  if (name === "dockerfile" || name.startsWith("dockerfile.")) return "dockerfile";
  if (name === "makefile" || name === "gnumakefile") return "shell";
  if (name === ".gitignore" || name === ".dockerignore") return "shell";
  if (name === ".env" || name.startsWith(".env.")) return "shell";
  
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    mts: "typescript",
    cts: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    html: "html",
    htm: "html",
    xml: "html",
    svg: "html",
    css: "css",
    scss: "css",
    sass: "css",
    less: "css",
    json: "json",
    jsonc: "json",
    json5: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    ini: "toml",
    cfg: "toml",
    conf: "toml",
    py: "python",
    pyw: "python",
    pyi: "python",
    rs: "rust",
    go: "go",
    rb: "python",
    php: "javascript",
    java: "typescript",
    kt: "typescript",
    kts: "typescript",
    scala: "typescript",
    swift: "typescript",
    c: "rust",
    h: "rust",
    cpp: "rust",
    cc: "rust",
    cxx: "rust",
    hpp: "rust",
    cs: "typescript",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    ps1: "shell",
    psm1: "shell",
    bat: "shell",
    cmd: "shell",
    sql: "sql",
    mysql: "sql",
    pgsql: "sql",
    sqlite: "sql",
    md: "markdown",
    mdx: "markdown",
    markdown: "markdown",
    rst: "markdown",
    txt: "plaintext",
    lock: "json",
    editorconfig: "toml",
    gitattributes: "shell",
  };
  
  return langMap[ext] || "plaintext";
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
