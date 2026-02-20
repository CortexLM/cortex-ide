/**
 * File icon utilities using vscode-symbols theme
 * Based on https://github.com/miguelsolorio/vscode-symbols
 */

// Base path for icons
const ICONS_BASE = "/icons";

// File extension to icon mapping
const fileExtensionIcons: Record<string, string> = {
  // JavaScript/TypeScript
  js: "js",
  mjs: "js",
  cjs: "js",
  ts: "ts",
  mts: "ts",
  cts: "ts",
  jsx: "react",
  tsx: "react-ts",
  
  // Web
  html: "code-orange",
  htm: "code-orange",
  css: "brackets-purple",
  scss: "sass",
  sass: "sass",
  less: "less",
  svg: "svg",
  
  // Data formats
  json: "brackets-yellow",
  yaml: "yaml",
  yml: "yaml",
  toml: "gear",
  xml: "xml",
  csv: "csv",
  
  // Documentation
  md: "markdown",
  mdx: "mdx",
  txt: "text",
  pdf: "pdf",
  
  // Config
  env: "gear",
  gitignore: "ignore",
  dockerignore: "docker",
  
  // Programming languages
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  c: "c",
  cpp: "cplus",
  cc: "cplus",
  cxx: "cplus",
  h: "h",
  hpp: "h",
  cs: "csharp",
  rb: "ruby",
  php: "php",
  swift: "swift",
  dart: "dart",
  lua: "lua",
  r: "r",
  sql: "database",
  
  // Shell
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  fish: "shell",
  ps1: "shell",
  bat: "shell",
  cmd: "shell",
  
  // Images
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "gif",
  ico: "image",
  webp: "image",
  avif: "image",
  bmp: "image",
  tiff: "image",
  
  // Fonts
  woff: "font",
  woff2: "font",
  ttf: "font",
  otf: "font",
  eot: "font",
  
  // Audio/Video
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  mp4: "video",
  webm: "video",
  mov: "video",
  
  // Archives
  zip: "exe",
  tar: "exe",
  gz: "exe",
  rar: "exe",
  "7z": "exe",
  
  // Other
  lock: "lock",
  log: "document",
  prisma: "prisma",
  graphql: "graphql",
  gql: "graphql",
  astro: "astro",
  svelte: "svelte",
  vue: "vue",
};

// Special filename to icon mapping (exact matches)
const fileNameIcons: Record<string, string> = {
  // Package managers
  "package.json": "node",
  "package-lock.json": "node",
  "yarn.lock": "yarn",
  "pnpm-lock.yaml": "pnpm",
  "bun.lockb": "bun",
  "bun.lock": "bun",
  
  // Config files
  "tsconfig.json": "tsconfig",
  "jsconfig.json": "tsconfig",
  ".eslintrc": "eslint",
  ".eslintrc.js": "eslint",
  ".eslintrc.json": "eslint",
  ".eslintrc.cjs": "eslint",
  "eslint.config.js": "eslint",
  "eslint.config.mjs": "eslint",
  ".prettierrc": "prettier",
  ".prettierrc.js": "prettier",
  ".prettierrc.json": "prettier",
  "prettier.config.js": "prettier",
  "biome.json": "biome",
  ".editorconfig": "editorconfig",
  
  // Git
  ".gitignore": "git",
  ".gitattributes": "git",
  ".gitmodules": "git",
  
  // Docker
  "dockerfile": "docker",
  "docker-compose.yml": "docker",
  "docker-compose.yaml": "docker",
  ".dockerignore": "docker",
  
  // CI/CD
  ".gitlab-ci.yml": "gitlab",
  "jenkinsfile": "jenkins",
  ".travis.yml": "gear",
  
  // Frameworks
  "vite.config.ts": "vite",
  "vite.config.js": "vite",
  "vite.config.mjs": "vite",
  "next.config.js": "next",
  "next.config.mjs": "next",
  "next.config.ts": "next",
  "nuxt.config.ts": "nuxt",
  "nuxt.config.js": "nuxt",
  "astro.config.mjs": "astro",
  "astro.config.ts": "astro",
  "svelte.config.js": "svelte",
  "tailwind.config.js": "tailwind",
  "tailwind.config.ts": "tailwind",
  "postcss.config.js": "postcss",
  "webpack.config.js": "webpack",
  
  // Testing
  "jest.config.js": "jest",
  "jest.config.ts": "jest",
  "vitest.config.ts": "vitest",
  "vitest.config.js": "vitest",
  "cypress.config.ts": "cypress",
  "cypress.config.js": "cypress",
  
  // Documentation
  "readme.md": "markdown",
  "readme": "markdown",
  "license": "license",
  "license.md": "license",
  "license.txt": "license",
  "changelog.md": "markdown",
  
  // Environment
  ".env": "gear",
  ".env.local": "gear",
  ".env.development": "gear",
  ".env.production": "gear",
  ".env.example": "gear",
  
  // Tauri
  "tauri.conf.json": "tauri",
  
  // Database
  "prisma.schema": "prisma",
  "schema.prisma": "prisma",
  
  // Misc
  ".nvmrc": "node",
  ".node-version": "node",
  "nodemon.json": "nodemon",
  "vercel.json": "vercel",
  "netlify.toml": "netlify",
};

// Folder name to icon mapping
const folderIcons: Record<string, string> = {
  // Standard folders
  src: "folder-sky-code",
  source: "folder-sky-code",
  lib: "folder-blue-code",
  dist: "folder-gray",
  build: "folder-build",
  out: "folder-gray",
  output: "folder-gray",
  bin: "folder-gray",
  
  // Config
  config: "folder-config",
  configs: "folder-config",
  ".config": "folder-config",
  settings: "folder-config",
  
  // Assets
  assets: "folder-assets",
  static: "folder-assets",
  public: "folder-assets",
  resources: "folder-assets",
  res: "folder-assets",
  
  // Images
  images: "folder-images",
  img: "folder-images",
  icons: "folder-images",
  
  // Styles
  styles: "folder-sass",
  css: "folder-sass",
  scss: "folder-sass",
  sass: "folder-sass",
  
  // Components
  components: "folder-react",
  component: "folder-react",
  widgets: "folder-react",
  ui: "folder-react",
  
  // Pages/Views
  pages: "folder-layout",
  views: "folder-layout",
  screens: "folder-layout",
  layouts: "folder-layout",
  
  // API/Services
  api: "folder-services",
  apis: "folder-services",
  services: "folder-services",
  service: "folder-services",
  
  // Data
  data: "folder-database",
  database: "folder-database",
  db: "folder-database",
  models: "folder-models",
  model: "folder-models",
  entities: "folder-models",
  
  // Utils
  utils: "folder-utils",
  util: "folder-utils",
  utilities: "folder-utils",
  helpers: "folder-helpers",
  helper: "folder-helpers",
  
  // Hooks
  hooks: "folder-hooks",
  hook: "folder-hooks",
  
  // Context/State
  context: "folder-context",
  contexts: "folder-context",
  store: "folder-redux-reducer",
  stores: "folder-redux-reducer",
  state: "folder-redux-reducer",
  redux: "folder-redux-reducer",
  
  // Types
  types: "folder-interfaces",
  typings: "folder-interfaces",
  interfaces: "folder-interfaces",
  
  // Tests
  tests: "folder-green",
  test: "folder-green",
  __tests__: "folder-green",
  spec: "folder-green",
  specs: "folder-green",
  
  // Documentation
  docs: "folder-documents",
  doc: "folder-documents",
  documentation: "folder-documents",
  
  // Git
  ".git": "folder-github",
  ".github": "folder-github",
  ".gitlab": "folder-gitlab",
  
  // IDE/Editor
  ".vscode": "folder-vscode",
  ".idea": "folder-purple",
  ".cursor": "folder-cursor",
  
  // Node
  node_modules: "folder-node-modules",
  
  // Docker
  docker: "folder-docker",
  
  // CI/CD
  ".ci": "folder-purple",
  ci: "folder-purple",
  
  // Misc
  scripts: "folder-orange-code",
  vendor: "folder-gray",
  temp: "folder-gray",
  tmp: "folder-gray",
  cache: "folder-gray",
  ".cache": "folder-gray",
  logs: "folder-gray",
  log: "folder-gray",
  
  // Framework specific
  app: "folder-app",
  middleware: "folder-middleware",
  middlewares: "folder-middleware",
  routes: "folder-router",
  router: "folder-router",
  routing: "folder-router",
  constants: "folder-constants",
  i18n: "folder-i18n",
  locales: "folder-i18n",
  translations: "folder-i18n",
  fonts: "folder-fonts",
  modules: "folder-modules",
  providers: "folder-providers",
  shared: "folder-shared",
  common: "folder-shared",
  core: "folder-core",
  prisma: "folder-prisma",
  supabase: "folder-supabase",
  firebase: "folder-firebase",
  graphql: "folder-graphql",
  "src-tauri": "folder-tauri",
};

/**
 * Get the icon path for a file
 */
export function getFileIcon(filename: string, isDir: boolean = false): string {
  const lowerName = filename.toLowerCase();
  
  if (isDir) {
    // Check folder name
    const folderIcon = folderIcons[lowerName];
    if (folderIcon) {
      return `${ICONS_BASE}/folders/${folderIcon}.svg`;
    }
    // Default folder
    return `${ICONS_BASE}/folders/folder.svg`;
  }
  
  // Check exact filename first
  const fileIcon = fileNameIcons[lowerName];
  if (fileIcon) {
    return `${ICONS_BASE}/files/${fileIcon}.svg`;
  }
  
  // Check compound extensions (e.g., test.ts, spec.tsx)
  const parts = lowerName.split(".");
  if (parts.length > 2) {
    const compoundExt = parts.slice(-2).join(".");
    const testMappings: Record<string, string> = {
      "test.ts": "ts-test",
      "spec.ts": "ts-test",
      "test.js": "js-test",
      "spec.js": "js-test",
      "test.tsx": "react-test",
      "spec.tsx": "react-test",
      "test.jsx": "react-test",
      "spec.jsx": "react-test",
      "stories.tsx": "storybook",
      "stories.ts": "storybook",
      "stories.jsx": "storybook",
      "stories.js": "storybook",
      "d.ts": "dts",
    };
    const testIcon = testMappings[compoundExt];
    if (testIcon) {
      return `${ICONS_BASE}/files/${testIcon}.svg`;
    }
  }
  
  // Check extension
  const ext = parts.pop() || "";
  const extIcon = fileExtensionIcons[ext];
  if (extIcon) {
    return `${ICONS_BASE}/files/${extIcon}.svg`;
  }
  
  // Default file icon
  return `${ICONS_BASE}/files/document.svg`;
}

/**
 * Get the expanded folder icon path
 */
export function getFolderIconExpanded(folderName: string): string {
  const lowerName = folderName.toLowerCase();
  const folderIcon = folderIcons[lowerName];
  
  if (folderIcon) {
    // For special folders, use the same icon (they don't have open variants)
    return `${ICONS_BASE}/folders/${folderIcon}.svg`;
  }
  
  // Default expanded folder
  return `${ICONS_BASE}/folders/folder.svg`;
}

/**
 * Alias for getFileIcon for folder-specific usage
 */
export function getFolderIcon(folderName: string): string {
  return getFileIcon(folderName, true);
}

/**
 * Preload common icons for better performance
 */
export function preloadCommonIcons(): void {
  const commonIcons = [
    "/icons/folders/folder.svg",
    "/icons/files/document.svg",
    "/icons/files/js.svg",
    "/icons/files/ts.svg",
    "/icons/files/react.svg",
    "/icons/files/react-ts.svg",
    "/icons/files/brackets-yellow.svg",
    "/icons/files/markdown.svg",
    "/icons/files/brackets-purple.svg",
    "/icons/folders/folder-sky-code.svg",
    "/icons/folders/folder-react.svg",
    "/icons/folders/folder-node-modules.svg",
  ];
  
  commonIcons.forEach(src => {
    const img = new Image();
    img.src = src;
  });
}
