import { createSignal, createMemo, For, Show, onMount, createEffect } from "solid-js";
import { useDebug, DebugSessionConfig, SavedLaunchConfig } from "@/context/DebugContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useTasks } from "@/context/TasksContext";
import { Icon } from "../ui/Icon";

// Debug configuration type icons mapping
const DEBUG_TYPE_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  node: { icon: "box", color: "var(--cortex-success)", label: "Node.js" },
  "node-terminal": { icon: "terminal", color: "var(--cortex-success)", label: "Node.js Terminal" },
  "pwa-node": { icon: "box", color: "var(--cortex-success)", label: "Node.js" },
  "pwa-chrome": { icon: "globe", color: "var(--cortex-info)", label: "Chrome" },
  "pwa-msedge": { icon: "globe", color: "var(--cortex-info)", label: "Edge" },
  chrome: { icon: "globe", color: "var(--cortex-info)", label: "Chrome" },
  firefox: { icon: "globe", color: "var(--cortex-warning)", label: "Firefox" },
  python: { icon: "code", color: "var(--cortex-info)", label: "Python" },
  debugpy: { icon: "code", color: "var(--cortex-info)", label: "Python" },
  go: { icon: "code", color: "var(--cortex-info)", label: "Go" },
  delve: { icon: "code", color: "var(--cortex-info)", label: "Go (Delve)" },
  lldb: { icon: "microchip", color: "var(--cortex-error)", label: "LLDB" },
  "lldb-dap": { icon: "microchip", color: "var(--cortex-error)", label: "LLDB" },
  cppdbg: { icon: "microchip", color: "var(--cortex-info)", label: "C/C++" },
  cppvsdbg: { icon: "microchip", color: "var(--cortex-info)", label: "C/C++ (VS)" },
  rust: { icon: "microchip", color: "var(--cortex-warning)", label: "Rust" },
  "codelldb": { icon: "microchip", color: "var(--cortex-warning)", label: "CodeLLDB" },
  java: { icon: "code", color: "var(--cortex-warning)", label: "Java" },
  kotlin: { icon: "code", color: "var(--cortex-info)", label: "Kotlin" },
  coreclr: { icon: "code", color: "var(--cortex-info)", label: ".NET Core" },
  clr: { icon: "code", color: "var(--cortex-info)", label: ".NET" },
  php: { icon: "code", color: "var(--cortex-info)", label: "PHP" },
  ruby: { icon: "code", color: "var(--cortex-error)", label: "Ruby" },
  dart: { icon: "code", color: "var(--cortex-info)", label: "Dart" },
  flutter: { icon: "code", color: "var(--cortex-info)", label: "Flutter" },
};

// Quick start templates for when no launch.json exists
interface QuickStartTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  request: "launch" | "attach";
  icon: string;
  color: string;
  getConfig: (workspacePath: string) => Partial<DebugSessionConfig>;
}

const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  {
    id: "node-launch",
    name: "Node.js: Launch Program",
    description: "Launch a Node.js program in debug mode",
    type: "node",
    request: "launch",
    icon: "box",
    color: "var(--cortex-success)",
    getConfig: (_ws) => ({
      program: "${workspaceFolder}/index.js",
      console: "integratedTerminal",
      skipFiles: ["<node_internals>/**"],
    }),
  },
  {
    id: "node-attach",
    name: "Node.js: Attach to Process",
    description: "Attach to a running Node.js process",
    type: "node",
    request: "attach",
    icon: "box",
    color: "var(--cortex-success)",
    getConfig: () => ({
      port: 9229,
      restart: true,
    }),
  },
  {
    id: "python-file",
    name: "Python: Current File",
    description: "Debug the currently active Python file",
    type: "python",
    request: "launch",
    icon: "code",
    color: "var(--cortex-info)",
    getConfig: () => ({
      program: "${file}",
      console: "integratedTerminal",
      justMyCode: true,
    }),
  },
  {
    id: "python-module",
    name: "Python: Module",
    description: "Debug a Python module",
    type: "python",
    request: "launch",
    icon: "code",
    color: "var(--cortex-info)",
    getConfig: () => ({
      module: "mymodule",
      console: "integratedTerminal",
    }),
  },
  {
    id: "go-launch",
    name: "Go: Launch Package",
    description: "Debug a Go package",
    type: "go",
    request: "launch",
    icon: "code",
    color: "var(--cortex-info)",
    getConfig: () => ({
      mode: "auto",
      program: "${fileDirname}",
    }),
  },
  {
    id: "rust-lldb",
    name: "Rust: Launch (LLDB)",
    description: "Debug a Rust binary with LLDB",
    type: "lldb",
    request: "launch",
    icon: "microchip",
    color: "var(--cortex-warning)",
    getConfig: (_ws) => ({
      program: "${workspaceFolder}/target/debug/${workspaceFolderBasename}",
      cwd: "${workspaceFolder}",
    }),
  },
  {
    id: "cpp-launch",
    name: "C/C++: Launch",
    description: "Debug a C/C++ program",
    type: "cppdbg",
    request: "launch",
    icon: "microchip",
    color: "var(--cortex-info)",
    getConfig: (_ws) => ({
      program: "${workspaceFolder}/a.out",
      cwd: "${workspaceFolder}",
      MIMode: "gdb",
    }),
  },
  {
    id: "chrome-launch",
    name: "Chrome: Launch",
    description: "Launch Chrome against localhost",
    type: "chrome",
    request: "launch",
    icon: "globe",
    color: "var(--cortex-info)",
    getConfig: () => ({
      url: "http://localhost:3000",
      webRoot: "${workspaceFolder}",
    }),
  },
];

// =============================================================================
// LAUNCH CONFIGURATION SNIPPETS
// =============================================================================
// These snippets provide ready-to-use launch.json configurations for common
// debugging scenarios. They can be inserted directly into launch.json.

export interface LaunchConfigSnippet {
  id: string;
  name: string;
  description: string;
  category: string;
  config: Record<string, unknown>;
}

/**
 * Complete launch configuration snippets for various languages and scenarios.
 * These generate full configuration objects suitable for launch.json.
 */
export const LAUNCH_CONFIG_SNIPPETS: Record<string, LaunchConfigSnippet> = {
  // Node.js configurations
  "node-launch": {
    id: "node-launch",
    name: "Node.js: Launch Program",
    description: "Launch a Node.js program with debugging",
    category: "Node.js",
    config: {
      type: "node",
      request: "launch",
      name: "Launch Program",
      program: "${workspaceFolder}/index.js",
      cwd: "${workspaceFolder}",
      console: "integratedTerminal",
      skipFiles: ["<node_internals>/**"],
    },
  },
  "node-attach": {
    id: "node-attach",
    name: "Node.js: Attach to Process",
    description: "Attach to a running Node.js process",
    category: "Node.js",
    config: {
      type: "node",
      request: "attach",
      name: "Attach to Process",
      port: 9229,
      restart: true,
      skipFiles: ["<node_internals>/**"],
    },
  },
  "node-npm": {
    id: "node-npm",
    name: "Node.js: Launch via NPM",
    description: "Launch Node.js using npm script",
    category: "Node.js",
    config: {
      type: "node",
      request: "launch",
      name: "Launch via NPM",
      runtimeExecutable: "npm",
      runtimeArgs: ["run-script", "debug"],
      cwd: "${workspaceFolder}",
      console: "integratedTerminal",
    },
  },
  "node-mocha": {
    id: "node-mocha",
    name: "Node.js: Mocha Tests",
    description: "Debug Mocha tests",
    category: "Node.js",
    config: {
      type: "node",
      request: "launch",
      name: "Mocha Tests",
      program: "${workspaceFolder}/node_modules/mocha/bin/_mocha",
      args: ["--timeout", "999999", "--colors", "${workspaceFolder}/test"],
      console: "integratedTerminal",
      internalConsoleOptions: "neverOpen",
    },
  },
  "node-jest": {
    id: "node-jest",
    name: "Node.js: Jest Tests",
    description: "Debug Jest tests",
    category: "Node.js",
    config: {
      type: "node",
      request: "launch",
      name: "Jest Tests",
      program: "${workspaceFolder}/node_modules/jest/bin/jest",
      args: ["--runInBand"],
      console: "integratedTerminal",
      internalConsoleOptions: "neverOpen",
      windows: {
        program: "${workspaceFolder}/node_modules/jest/bin/jest.js",
      },
    },
  },

  // Python configurations
  "python-file": {
    id: "python-file",
    name: "Python: Current File",
    description: "Debug the currently active Python file",
    category: "Python",
    config: {
      type: "python",
      request: "launch",
      name: "Python: Current File",
      program: "${file}",
      console: "integratedTerminal",
      justMyCode: true,
    },
  },
  "python-module": {
    id: "python-module",
    name: "Python: Module",
    description: "Debug a Python module",
    category: "Python",
    config: {
      type: "python",
      request: "launch",
      name: "Python: Module",
      module: "enter-your-module-name",
      console: "integratedTerminal",
      justMyCode: true,
    },
  },
  "python-django": {
    id: "python-django",
    name: "Python: Django",
    description: "Debug Django web application",
    category: "Python",
    config: {
      type: "python",
      request: "launch",
      name: "Python: Django",
      program: "${workspaceFolder}/manage.py",
      args: ["runserver"],
      django: true,
      justMyCode: true,
    },
  },
  "python-flask": {
    id: "python-flask",
    name: "Python: Flask",
    description: "Debug Flask web application",
    category: "Python",
    config: {
      type: "python",
      request: "launch",
      name: "Python: Flask",
      module: "flask",
      env: {
        FLASK_APP: "app.py",
        FLASK_DEBUG: "1",
      },
      args: ["run", "--no-debugger"],
      jinja: true,
      justMyCode: true,
    },
  },
  "python-fastapi": {
    id: "python-fastapi",
    name: "Python: FastAPI",
    description: "Debug FastAPI application",
    category: "Python",
    config: {
      type: "python",
      request: "launch",
      name: "Python: FastAPI",
      module: "uvicorn",
      args: ["main:app", "--reload"],
      jinja: true,
      justMyCode: true,
    },
  },
  "python-pytest": {
    id: "python-pytest",
    name: "Python: Pytest",
    description: "Debug pytest tests",
    category: "Python",
    config: {
      type: "python",
      request: "launch",
      name: "Python: Pytest",
      module: "pytest",
      args: ["-v"],
      console: "integratedTerminal",
      justMyCode: false,
    },
  },
  "python-attach": {
    id: "python-attach",
    name: "Python: Remote Attach",
    description: "Attach to a remote Python process",
    category: "Python",
    config: {
      type: "python",
      request: "attach",
      name: "Python: Remote Attach",
      connect: {
        host: "localhost",
        port: 5678,
      },
      pathMappings: [
        {
          localRoot: "${workspaceFolder}",
          remoteRoot: ".",
        },
      ],
      justMyCode: true,
    },
  },

  // Chrome/Browser configurations
  "chrome-launch": {
    id: "chrome-launch",
    name: "Chrome: Launch",
    description: "Launch Chrome against localhost",
    category: "Chrome",
    config: {
      type: "chrome",
      request: "launch",
      name: "Launch Chrome",
      url: "http://localhost:3000",
      webRoot: "${workspaceFolder}",
    },
  },
  "chrome-attach": {
    id: "chrome-attach",
    name: "Chrome: Attach",
    description: "Attach to running Chrome instance",
    category: "Chrome",
    config: {
      type: "chrome",
      request: "attach",
      name: "Attach to Chrome",
      port: 9222,
      webRoot: "${workspaceFolder}",
    },
  },
  "edge-launch": {
    id: "edge-launch",
    name: "Edge: Launch",
    description: "Launch Microsoft Edge against localhost",
    category: "Chrome",
    config: {
      type: "msedge",
      request: "launch",
      name: "Launch Edge",
      url: "http://localhost:3000",
      webRoot: "${workspaceFolder}",
    },
  },

  // Go configurations
  "go-launch": {
    id: "go-launch",
    name: "Go: Launch Package",
    description: "Debug a Go package",
    category: "Go",
    config: {
      type: "go",
      request: "launch",
      name: "Launch Package",
      mode: "auto",
      program: "${fileDirname}",
    },
  },
  "go-test": {
    id: "go-test",
    name: "Go: Launch Test",
    description: "Debug Go tests",
    category: "Go",
    config: {
      type: "go",
      request: "launch",
      name: "Launch Test",
      mode: "test",
      program: "${fileDirname}",
    },
  },
  "go-attach": {
    id: "go-attach",
    name: "Go: Attach to Process",
    description: "Attach to a running Go process",
    category: "Go",
    config: {
      type: "go",
      request: "attach",
      name: "Attach to Process",
      mode: "local",
      processId: 0,
    },
  },

  // Rust configurations
  "rust-lldb": {
    id: "rust-lldb",
    name: "Rust: Launch (LLDB)",
    description: "Debug Rust binary with LLDB",
    category: "Rust",
    config: {
      type: "lldb",
      request: "launch",
      name: "Rust: Launch (LLDB)",
      cargo: {
        args: ["build", "--bin=your-binary-name"],
        filter: {
          name: "your-binary-name",
          kind: "bin",
        },
      },
      cwd: "${workspaceFolder}",
    },
  },
  "rust-codelldb": {
    id: "rust-codelldb",
    name: "Rust: Launch (CodeLLDB)",
    description: "Debug Rust binary with CodeLLDB",
    category: "Rust",
    config: {
      type: "lldb",
      request: "launch",
      name: "Rust: Launch",
      program: "${workspaceFolder}/target/debug/${workspaceFolderBasename}",
      args: [],
      cwd: "${workspaceFolder}",
    },
  },
  "rust-test": {
    id: "rust-test",
    name: "Rust: Debug Tests",
    description: "Debug Rust tests",
    category: "Rust",
    config: {
      type: "lldb",
      request: "launch",
      name: "Rust: Debug Tests",
      cargo: {
        args: ["test", "--no-run"],
      },
      cwd: "${workspaceFolder}",
    },
  },

  // C/C++ configurations
  "cpp-launch-gdb": {
    id: "cpp-launch-gdb",
    name: "C/C++: Launch (GDB)",
    description: "Debug C/C++ program with GDB",
    category: "C/C++",
    config: {
      type: "cppdbg",
      request: "launch",
      name: "C/C++: Launch (GDB)",
      program: "${workspaceFolder}/a.out",
      args: [],
      stopAtEntry: false,
      cwd: "${workspaceFolder}",
      environment: [],
      externalConsole: false,
      MIMode: "gdb",
      setupCommands: [
        {
          description: "Enable pretty-printing for gdb",
          text: "-enable-pretty-printing",
          ignoreFailures: true,
        },
      ],
    },
  },
  "cpp-launch-lldb": {
    id: "cpp-launch-lldb",
    name: "C/C++: Launch (LLDB)",
    description: "Debug C/C++ program with LLDB",
    category: "C/C++",
    config: {
      type: "cppdbg",
      request: "launch",
      name: "C/C++: Launch (LLDB)",
      program: "${workspaceFolder}/a.out",
      args: [],
      stopAtEntry: false,
      cwd: "${workspaceFolder}",
      environment: [],
      externalConsole: false,
      MIMode: "lldb",
    },
  },
  "cpp-attach": {
    id: "cpp-attach",
    name: "C/C++: Attach to Process",
    description: "Attach to running C/C++ process",
    category: "C/C++",
    config: {
      type: "cppdbg",
      request: "attach",
      name: "C/C++: Attach",
      program: "${workspaceFolder}/a.out",
      processId: "${command:pickProcess}",
      MIMode: "gdb",
    },
  },

  // .NET configurations
  "dotnet-launch": {
    id: "dotnet-launch",
    name: ".NET: Launch",
    description: "Debug .NET application",
    category: ".NET",
    config: {
      type: "coreclr",
      request: "launch",
      name: ".NET Core Launch",
      program: "${workspaceFolder}/bin/Debug/net8.0/MyApp.dll",
      args: [],
      cwd: "${workspaceFolder}",
      stopAtEntry: false,
      console: "internalConsole",
    },
  },
  "dotnet-attach": {
    id: "dotnet-attach",
    name: ".NET: Attach",
    description: "Attach to running .NET process",
    category: ".NET",
    config: {
      type: "coreclr",
      request: "attach",
      name: ".NET Core Attach",
      processId: "${command:pickProcess}",
    },
  },

  // Java configurations
  "java-launch": {
    id: "java-launch",
    name: "Java: Launch Current File",
    description: "Debug current Java file",
    category: "Java",
    config: {
      type: "java",
      request: "launch",
      name: "Launch Current File",
      mainClass: "${file}",
    },
  },
  "java-attach": {
    id: "java-attach",
    name: "Java: Attach to Process",
    description: "Attach to running Java process",
    category: "Java",
    config: {
      type: "java",
      request: "attach",
      name: "Attach to Process",
      hostName: "localhost",
      port: 5005,
    },
  },

  // PHP configurations
  "php-launch": {
    id: "php-launch",
    name: "PHP: Launch Built-in Server",
    description: "Debug PHP with built-in server",
    category: "PHP",
    config: {
      type: "php",
      request: "launch",
      name: "Launch Built-in Server",
      program: "${workspaceFolder}/index.php",
      cwd: "${workspaceFolder}",
      port: 8080,
      runtimeExecutable: "php",
      runtimeArgs: ["-S", "localhost:8080", "-t", "${workspaceFolder}"],
    },
  },
  "php-xdebug": {
    id: "php-xdebug",
    name: "PHP: Listen for Xdebug",
    description: "Listen for Xdebug connections",
    category: "PHP",
    config: {
      type: "php",
      request: "launch",
      name: "Listen for Xdebug",
      port: 9003,
      pathMappings: {
        "/var/www/html": "${workspaceFolder}",
      },
    },
  },

  // Ruby configurations  
  "ruby-launch": {
    id: "ruby-launch",
    name: "Ruby: Debug Current File",
    description: "Debug the current Ruby file",
    category: "Ruby",
    config: {
      type: "ruby",
      request: "launch",
      name: "Debug Current File",
      program: "${file}",
      cwd: "${workspaceFolder}",
    },
  },
  "ruby-rails": {
    id: "ruby-rails",
    name: "Ruby: Rails Server",
    description: "Debug Rails application",
    category: "Ruby",
    config: {
      type: "ruby",
      request: "launch",
      name: "Rails Server",
      program: "${workspaceFolder}/bin/rails",
      args: ["server"],
      cwd: "${workspaceFolder}",
    },
  },
};

/**
 * Get all snippets grouped by category
 */
export function getSnippetsByCategory(): Record<string, LaunchConfigSnippet[]> {
  const categories: Record<string, LaunchConfigSnippet[]> = {};
  
  for (const snippet of Object.values(LAUNCH_CONFIG_SNIPPETS)) {
    if (!categories[snippet.category]) {
      categories[snippet.category] = [];
    }
    categories[snippet.category].push(snippet);
  }
  
  return categories;
}

/**
 * Get a snippet configuration ready for insertion into launch.json
 */
export function getSnippetConfig(snippetId: string): Record<string, unknown> | null {
  const snippet = LAUNCH_CONFIG_SNIPPETS[snippetId];
  return snippet ? { ...snippet.config } : null;
}

interface LaunchConfigPickerProps {
  onClose: () => void;
  onLaunch: (config: DebugSessionConfig) => void;
  onEdit?: (config: SavedLaunchConfig) => void;
}

// Storage key for recent configurations
const RECENT_CONFIGS_KEY = "orion:debug:recent-configs";
const MAX_RECENT_CONFIGS = 5;

export function LaunchConfigPicker(props: LaunchConfigPickerProps) {
  const debug = useDebug();
  const workspace = useWorkspace();
  
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [showAdvanced, setShowAdvanced] = createSignal(false);
  const [showSnippetPicker, setShowSnippetPicker] = createSignal(false);
  const [recentConfigs, setRecentConfigs] = createSignal<string[]>([]);
  
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  // Load recent configs from localStorage
  onMount(() => {
    try {
      const stored = localStorage.getItem(RECENT_CONFIGS_KEY);
      if (stored) {
        setRecentConfigs(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load recent debug configs:", e);
    }
    
    // Focus search input
    setTimeout(() => inputRef?.focus(), 50);
  });

  // Save recent config
  const saveRecentConfig = (configName: string) => {
    const recent = recentConfigs().filter(n => n !== configName);
    recent.unshift(configName);
    const trimmed = recent.slice(0, MAX_RECENT_CONFIGS);
    setRecentConfigs(trimmed);
    try {
      localStorage.setItem(RECENT_CONFIGS_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.error("Failed to save recent debug configs:", e);
    }
  };

  // Get saved configurations from DebugContext
  const savedConfigs = createMemo(() => debug.getSavedConfigurations());
  
  // Get compounds
  const compounds = createMemo(() => debug.getCompounds());

  // Build list of all available configurations
  const allConfigurations = createMemo(() => {
    const items: Array<{
      type: "config" | "compound" | "template" | "action";
      id: string;
      name: string;
      description?: string;
      debugType?: string;
      request?: string;
      config?: SavedLaunchConfig;
      compound?: any;
      template?: QuickStartTemplate;
      isRecent?: boolean;
    }> = [];

    const query = searchQuery().toLowerCase();
    const recent = new Set(recentConfigs());

    // Add saved configurations
    for (const config of savedConfigs()) {
      if (query && !config.name.toLowerCase().includes(query) && 
          !config.type.toLowerCase().includes(query)) continue;
      
      items.push({
        type: "config",
        id: config.id,
        name: config.name,
        description: `${config.type} • ${config.request}`,
        debugType: config.type,
        request: config.request,
        config,
        isRecent: recent.has(config.name),
      });
    }

    // Add compounds
    for (const compound of compounds()) {
      if (query && !compound.name.toLowerCase().includes(query)) continue;
      
      items.push({
        type: "compound",
        id: `compound:${compound.name}`,
        name: compound.name,
        description: `Compound • ${compound.configurations.length} configurations`,
        compound,
        isRecent: recent.has(compound.name),
      });
    }

    // If no saved configs, show quick start templates
    if (savedConfigs().length === 0) {
      for (const template of QUICK_START_TEMPLATES) {
        if (query && !template.name.toLowerCase().includes(query) &&
            !template.type.toLowerCase().includes(query)) continue;
        
        items.push({
          type: "template",
          id: `template:${template.id}`,
          name: template.name,
          description: template.description,
          debugType: template.type,
          request: template.request,
          template,
        });
      }
    }

    // Sort: recent first, then alphabetically
    items.sort((a, b) => {
      if (a.isRecent && !b.isRecent) return -1;
      if (!a.isRecent && b.isRecent) return 1;
      return a.name.localeCompare(b.name);
    });

    // Add action items at the end
    if (!query) {
      items.push({
        type: "action",
        id: "action:add",
        name: "Add Configuration...",
        description: "Create a new debug configuration from scratch",
      });
      items.push({
        type: "action",
        id: "action:snippets",
        name: "Add Configuration from Snippet...",
        description: "Choose from predefined configuration templates",
      });
    }

    return items;
  });

  // Reset selection when search changes
  createEffect(() => {
    searchQuery();
    setSelectedIndex(0);
  });

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    const items = allConfigurations();
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, items.length - 1));
        scrollToSelected();
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        scrollToSelected();
        break;
      case "Enter":
        e.preventDefault();
        const selected = items[selectedIndex()];
        if (selected) handleSelect(selected);
        break;
      case "Escape":
        e.preventDefault();
        props.onClose();
        break;
    }
  };

  const scrollToSelected = () => {
    if (!listRef) return;
    const selectedEl = listRef.querySelector(`[data-index="${selectedIndex()}"]`);
    selectedEl?.scrollIntoView({ block: "nearest" });
  };

  // Handle selection
  const handleSelect = (item: ReturnType<typeof allConfigurations>[0]) => {
    if (item.type === "config" && item.config) {
      saveRecentConfig(item.config.name);
      props.onLaunch({
        ...item.config,
        id: `debug-${Date.now()}`,
      });
    } else if (item.type === "compound" && item.compound) {
      saveRecentConfig(item.compound.name);
      debug.launchCompound(item.compound.name);
      props.onClose();
    } else if (item.type === "template" && item.template) {
      const folders = workspace.folders();
      const ws = folders.length > 0 ? folders[0].path : "";
      const config: DebugSessionConfig = {
        id: `debug-${Date.now()}`,
        name: item.template.name,
        type: item.template.type,
        request: item.template.request,
        ...item.template.getConfig(ws),
      };
      props.onLaunch(config);
    }
  };

// Get icon for debug type
  const getTypeIcon = (type?: string) => {
    const info = type ? DEBUG_TYPE_ICONS[type] : null;
    return info || { icon: "bug", color: "var(--text-weak)", label: type || "Debug" };
  };

  return (
    <div
      class="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      style={{ background: "var(--ui-panel-bg)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        class="w-[600px] max-h-[60vh] rounded-lg shadow-2xl flex flex-col overflow-hidden"
        style={{ 
          background: "var(--background-base)",
          border: "1px solid var(--border-weak)",
        }}
      >
        {/* Search Header */}
        <div
          class="shrink-0 flex items-center gap-2 px-3 py-2 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <Icon name="play" class="w-4 h-4 shrink-0" style={{ color: "var(--debug-icon-start-foreground)" }} />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Select debug configuration to start..."
            class="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--text-base)" }}
          />
          <Show when={searchQuery()}>
            <button
              onClick={() => setSearchQuery("")}
              class="p-1 rounded hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
            >
              <Icon name="xmark" class="w-3.5 h-3.5" />
            </button>
          </Show>
        </div>

        {/* Configuration List */}
        <div ref={listRef} class="flex-1 overflow-auto py-1">
          <Show when={allConfigurations().length === 0}>
            <div class="px-4 py-8 text-center">
              <Icon name="bug" class="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: "var(--text-weak)" }} />
              <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                No debug configurations found
              </p>
              <p class="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Create a launch.json file or use a quick start template
              </p>
            </div>
          </Show>

          <For each={allConfigurations()}>
            {(item, index) => {
              const isSelected = () => selectedIndex() === index();
              const typeInfo = getTypeIcon(item.debugType);

              return (
                <div
                  data-index={index()}
                  class="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors"
                  style={{
                    background: isSelected() ? "var(--surface-raised)" : "transparent",
                  }}
                  onMouseEnter={() => setSelectedIndex(index())}
                  onClick={() => handleSelect(item)}
                >
                  {/* Icon */}
                  <div class="w-6 h-6 flex items-center justify-center shrink-0">
                    <Show when={item.type === "action"}>
                      <Icon name="plus" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                    </Show>
                    <Show when={item.type === "compound"}>
                      <Icon name="shapes" class="w-4 h-4" style={{ color: "var(--accent)" }} />
                    </Show>
<Show when={item.type === "config" || item.type === "template"}>
                      <Icon name={typeInfo.icon} class="w-4 h-4" style={{ color: typeInfo.color }} />
                    </Show>
                  </div>

                  {/* Content */}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span 
                        class="text-sm truncate"
                        style={{ color: "var(--text-base)" }}
                      >
                        {item.name}
                      </span>
                      <Show when={item.isRecent}>
                        <Icon name="clock" class="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                      </Show>
                    </div>
                    <Show when={item.description}>
                      <p 
                        class="text-xs truncate"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {item.description}
                      </p>
                    </Show>
                  </div>

                  {/* Actions */}
                  <Show when={item.type === "config" && isSelected()}>
                    <div class="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onEdit?.(item.config!);
                        }}
                        class="p-1 rounded hover:bg-[var(--surface-sunken)]"
                        style={{ color: "var(--text-weak)" }}
                        title="Edit configuration"
                      >
                        <Icon name="pen" class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </Show>

                  {/* Enter hint */}
                  <Show when={isSelected()}>
                    <span 
                      class="text-xs shrink-0"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Enter
                    </span>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>

        {/* Footer */}
        <div
          class="shrink-0 flex items-center justify-between px-3 py-2 border-t text-xs"
          style={{ 
            "border-color": "var(--border-weak)",
            color: "var(--text-muted)",
          }}
        >
          <div class="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>Enter to select</span>
            <span>Esc to close</span>
          </div>
          <button
            onClick={() => setShowAdvanced(true)}
            class="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
          >
            <Icon name="gear" class="w-3.5 h-3.5" />
            <span>Configure</span>
          </button>
        </div>
      </div>

      {/* Advanced Configuration Modal */}
      <Show when={showAdvanced()}>
        <AdvancedConfigModal
          onClose={() => setShowAdvanced(false)}
          onSave={(config) => {
            setShowAdvanced(false);
            props.onLaunch(config);
          }}
        />
      </Show>
      
      {/* Snippet Picker Modal */}
      <Show when={showSnippetPicker()}>
        <SnippetPickerModal
          onClose={() => setShowSnippetPicker(false)}
          onSelect={(snippet) => {
            setShowSnippetPicker(false);
            // Emit event to insert snippet into launch.json
            window.dispatchEvent(new CustomEvent("debug:insert-launch-config", {
              detail: { config: snippet.config }
            }));
          }}
        />
      </Show>
    </div>
  );
}

// Advanced configuration modal for creating new configs
function AdvancedConfigModal(props: {
  onClose: () => void;
  onSave: (config: DebugSessionConfig) => void;
  initialConfig?: SavedLaunchConfig;
}) {
  const tasks = useTasks();
  // workspace context available if needed for folder paths
  void useWorkspace();
  
  const [selectedType, setSelectedType] = createSignal(props.initialConfig?.type || "node");
  const [name, setName] = createSignal(props.initialConfig?.name || "");
  const [request, setRequest] = createSignal<"launch" | "attach">(props.initialConfig?.request || "launch");
  const [program, setProgram] = createSignal(props.initialConfig?.program || "");
  const [args, setArgs] = createSignal(props.initialConfig?.args?.join(" ") || "");
  const [cwd, setCwd] = createSignal(props.initialConfig?.cwd || "");
  const [env, setEnv] = createSignal(
    props.initialConfig?.env 
      ? Object.entries(props.initialConfig.env).map(([k, v]) => `${k}=${v}`).join("\n")
      : ""
  );
  const [stopOnEntry, setStopOnEntry] = createSignal(props.initialConfig?.stopOnEntry || false);
  const [preLaunchTask, setPreLaunchTask] = createSignal(props.initialConfig?.preLaunchTask || "");
  const [postDebugTask, setPostDebugTask] = createSignal(props.initialConfig?.postDebugTask || "");

const debugTypes = [
    { id: "node", name: "Node.js", icon: "box", color: "var(--cortex-success)" },
    { id: "python", name: "Python", icon: "code", color: "var(--cortex-info)" },
    { id: "go", name: "Go", icon: "code", color: "var(--cortex-info)" },
    { id: "lldb", name: "LLDB (Rust/C++)", icon: "microchip", color: "var(--cortex-warning)" },
    { id: "cppdbg", name: "C/C++ (GDB)", icon: "microchip", color: "var(--cortex-info)" },
    { id: "chrome", name: "Chrome", icon: "globe", color: "var(--cortex-info)" },
  ];

  const handleSave = () => {
    const config: DebugSessionConfig = {
      id: `debug-${Date.now()}`,
      name: name() || `Debug ${selectedType()}`,
      type: selectedType(),
      request: request(),
      program: program() || undefined,
      args: args() ? args().split(/\s+/) : undefined,
      cwd: cwd() || undefined,
      env: env() ? Object.fromEntries(
        env().split("\n")
          .map(line => line.split("="))
          .filter(parts => parts.length >= 2)
          .map(([k, ...v]) => [k.trim(), v.join("=").trim()])
      ) : undefined,
      stopOnEntry: stopOnEntry(),
      preLaunchTask: preLaunchTask() || undefined,
      postDebugTask: postDebugTask() || undefined,
    };
    props.onSave(config);
  };

  return (
    <div
      class="fixed inset-0 z-[110] flex items-center justify-center"
      style={{ background: "var(--ui-panel-bg)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        class="w-[550px] max-h-[80vh] rounded-lg shadow-2xl flex flex-col overflow-hidden"
        style={{ 
          background: "var(--background-base)",
          border: "1px solid var(--border-weak)",
        }}
      >
        {/* Header */}
        <div
          class="shrink-0 flex items-center justify-between px-4 py-3 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <h2 class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
            {props.initialConfig ? "Edit Configuration" : "New Debug Configuration"}
          </h2>
          <button
            onClick={props.onClose}
            class="p-1 rounded hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
          >
            <Icon name="xmark" class="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-auto p-4 space-y-4">
          {/* Debug Type Selection */}
          <div>
            <label class="block text-xs mb-2" style={{ color: "var(--text-weak)" }}>
              Debug Type
            </label>
            <div class="grid grid-cols-3 gap-2">
              <For each={debugTypes}>
{(type) => {
                  return (
                    <button
                      onClick={() => setSelectedType(type.id)}
                      class="flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors"
                      style={{
                        background: selectedType() === type.id 
                          ? "var(--accent)" 
                          : "var(--surface-sunken)",
                        color: selectedType() === type.id 
                          ? "white" 
                          : "var(--text-base)",
                        border: `1px solid ${selectedType() === type.id ? "var(--accent)" : "var(--border-weak)"}`,
                      }}
                    >
                      <Icon name={type.icon} class="w-4 h-4" style={{ 
                        color: selectedType() === type.id ? "white" : type.color 
                      }} />
                      {type.name}
                    </button>
                  );
                }}
              </For>
            </div>
          </div>

          {/* Request Type */}
          <div class="flex gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="request"
                checked={request() === "launch"}
                onChange={() => setRequest("launch")}
              />
              <span class="text-sm" style={{ color: "var(--text-base)" }}>Launch</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="request"
                checked={request() === "attach"}
                onChange={() => setRequest("attach")}
              />
              <span class="text-sm" style={{ color: "var(--text-base)" }}>Attach</span>
            </label>
          </div>

          {/* Configuration Name */}
          <div>
            <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
              Configuration Name
            </label>
            <input
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder={`Debug ${selectedType()}`}
              class="w-full px-3 py-2 text-sm rounded outline-none"
              style={{
                background: "var(--surface-sunken)",
                color: "var(--text-base)",
                border: "1px solid var(--border-weak)",
              }}
            />
          </div>

          {/* Program */}
          <Show when={request() === "launch"}>
            <div>
              <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                Program
              </label>
              <div class="flex gap-2">
                <input
                  type="text"
                  value={program()}
                  onInput={(e) => setProgram(e.currentTarget.value)}
                  placeholder="${workspaceFolder}/main.js"
                  class="flex-1 px-3 py-2 text-sm rounded outline-none font-mono"
                  style={{
                    background: "var(--surface-sunken)",
                    color: "var(--text-base)",
                    border: "1px solid var(--border-weak)",
                  }}
                />
                <button
                  class="px-2 rounded hover:bg-[var(--surface-raised)]"
                  style={{
                    background: "var(--surface-sunken)",
                    color: "var(--text-weak)",
                    border: "1px solid var(--border-weak)",
                  }}
                  title="Browse"
                >
                  <Icon name="file" class="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Arguments */}
            <div>
              <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                Arguments
              </label>
              <input
                type="text"
                value={args()}
                onInput={(e) => setArgs(e.currentTarget.value)}
                placeholder="arg1 arg2 --flag"
                class="w-full px-3 py-2 text-sm rounded outline-none font-mono"
                style={{
                  background: "var(--surface-sunken)",
                  color: "var(--text-base)",
                  border: "1px solid var(--border-weak)",
                }}
              />
            </div>

            {/* Working Directory */}
            <div>
              <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                Working Directory
              </label>
              <input
                type="text"
                value={cwd()}
                onInput={(e) => setCwd(e.currentTarget.value)}
                placeholder="${workspaceFolder}"
                class="w-full px-3 py-2 text-sm rounded outline-none font-mono"
                style={{
                  background: "var(--surface-sunken)",
                  color: "var(--text-base)",
                  border: "1px solid var(--border-weak)",
                }}
              />
            </div>
          </Show>

          {/* Environment Variables */}
          <div>
            <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
              Environment Variables
            </label>
            <textarea
              value={env()}
              onInput={(e) => setEnv(e.currentTarget.value)}
              placeholder="KEY=value"
              rows={2}
              class="w-full px-3 py-2 text-sm rounded outline-none resize-none font-mono"
              style={{
                background: "var(--surface-sunken)",
                color: "var(--text-base)",
                border: "1px solid var(--border-weak)",
              }}
            />
          </div>

          {/* Stop on Entry */}
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={stopOnEntry()}
              onChange={(e) => setStopOnEntry(e.currentTarget.checked)}
            />
            <span class="text-sm" style={{ color: "var(--text-base)" }}>Stop on entry</span>
          </label>

          {/* Tasks */}
          <details class="group">
            <summary
              class="cursor-pointer text-xs flex items-center gap-1"
              style={{ color: "var(--text-weak)" }}
            >
              <Icon name="chevron-right" class="w-3 h-3 transition-transform group-open:rotate-90" />
              Tasks & Advanced
            </summary>
            <div class="mt-3 space-y-3 pl-4">
              <div>
                <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                  Pre-launch Task
                </label>
                <select
                  value={preLaunchTask()}
                  onChange={(e) => setPreLaunchTask(e.currentTarget.value)}
                  class="w-full px-3 py-2 text-sm rounded outline-none"
                  style={{
                    background: "var(--surface-sunken)",
                    color: "var(--text-base)",
                    border: "1px solid var(--border-weak)",
                  }}
                >
                  <option value="">None</option>
                  <For each={tasks.allTasks()}>
                    {(task) => <option value={task.label}>{task.label}</option>}
                  </For>
                </select>
              </div>
              <div>
                <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                  Post Debug Task
                </label>
                <select
                  value={postDebugTask()}
                  onChange={(e) => setPostDebugTask(e.currentTarget.value)}
                  class="w-full px-3 py-2 text-sm rounded outline-none"
                  style={{
                    background: "var(--surface-sunken)",
                    color: "var(--text-base)",
                    border: "1px solid var(--border-weak)",
                  }}
                >
                  <option value="">None</option>
                  <For each={tasks.allTasks()}>
                    {(task) => <option value={task.label}>{task.label}</option>}
                  </For>
                </select>
              </div>
            </div>
          </details>
        </div>

        {/* Footer */}
        <div
          class="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-t"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <button
            onClick={props.onClose}
            class="px-3 py-1.5 text-sm rounded hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded"
            style={{
              background: "var(--debug-icon-start-foreground)",
              color: "white",
            }}
          >
            <Icon name="play" class="w-3.5 h-3.5" />
            Start Debugging
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Snippet Picker Modal - Allows users to select from predefined launch configurations
 */
function SnippetPickerModal(props: {
  onClose: () => void;
  onSelect: (snippet: LaunchConfigSnippet) => void;
}) {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [expandedCategories, setExpandedCategories] = createSignal<Set<string>>(new Set());
  
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;
  
  onMount(() => {
    // Focus search input
    setTimeout(() => inputRef?.focus(), 50);
    
    // Expand all categories initially
    const categories = Object.keys(getSnippetsByCategory());
    setExpandedCategories(new Set(categories));
  });
  
  // Filter snippets based on search
  const filteredSnippets = createMemo(() => {
    const query = searchQuery().toLowerCase();
    const allSnippets = Object.values(LAUNCH_CONFIG_SNIPPETS);
    
    if (!query) return allSnippets;
    
    return allSnippets.filter(snippet => 
      snippet.name.toLowerCase().includes(query) ||
      snippet.description.toLowerCase().includes(query) ||
      snippet.category.toLowerCase().includes(query)
    );
  });
  
  // Group filtered snippets by category
  const groupedSnippets = createMemo(() => {
    const groups: Record<string, LaunchConfigSnippet[]> = {};
    
    for (const snippet of filteredSnippets()) {
      if (!groups[snippet.category]) {
        groups[snippet.category] = [];
      }
      groups[snippet.category].push(snippet);
    }
    
    return groups;
  });
  
  // Flat list for keyboard navigation
  const flatList = createMemo(() => {
    const items: LaunchConfigSnippet[] = [];
    const groups = groupedSnippets();
    const expanded = expandedCategories();
    
    for (const category of Object.keys(groups).sort()) {
      if (expanded.has(category)) {
        items.push(...groups[category]);
      }
    }
    
    return items;
  });
  
  // Reset selection when search changes
  createEffect(() => {
    searchQuery();
    setSelectedIndex(0);
  });
  
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };
  
  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    const items = flatList();
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, items.length - 1));
        scrollToSelected();
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        scrollToSelected();
        break;
      case "Enter":
        e.preventDefault();
        const selected = items[selectedIndex()];
        if (selected) props.onSelect(selected);
        break;
      case "Escape":
        e.preventDefault();
        props.onClose();
        break;
    }
  };
  
  const scrollToSelected = () => {
    if (!listRef) return;
    const selectedEl = listRef.querySelector(`[data-selected="true"]`);
    selectedEl?.scrollIntoView({ block: "nearest" });
  };
  
  // Get icon for debug type
  const getTypeIcon = (type: string) => {
    const info = DEBUG_TYPE_ICONS[type];
    return info || { icon: "code", color: "var(--text-weak)", label: type };
  };

  return (
    <div
      class="fixed inset-0 z-[110] flex items-start justify-center pt-[10vh]"
      style={{ background: "var(--ui-panel-bg)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        class="w-[650px] max-h-[70vh] rounded-lg shadow-2xl flex flex-col overflow-hidden"
        style={{ 
          background: "var(--background-base)",
          border: "1px solid var(--border-weak)",
        }}
      >
        {/* Header */}
        <div
          class="shrink-0 flex items-center gap-2 px-3 py-2 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <Icon name="plus" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search configuration snippets..."
            class="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--text-base)" }}
          />
          <Show when={searchQuery()}>
            <button
              onClick={() => setSearchQuery("")}
              class="p-1 rounded hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
            >
              <Icon name="xmark" class="w-3.5 h-3.5" />
            </button>
          </Show>
        </div>

        {/* Snippet List */}
        <div ref={listRef} class="flex-1 overflow-auto py-2">
          <Show when={filteredSnippets().length === 0}>
            <div class="px-4 py-8 text-center">
              <Icon name="code" class="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: "var(--text-weak)" }} />
              <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                No snippets found
              </p>
            </div>
          </Show>

          <For each={Object.keys(groupedSnippets()).sort()}>
            {(category) => {
              const snippets = () => groupedSnippets()[category] || [];
              const isExpanded = () => expandedCategories().has(category);
              
              return (
                <div class="mb-2">
                  {/* Category Header */}
                  <button
                    class="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--surface-raised)] transition-colors"
                    onClick={() => toggleCategory(category)}
                  >
                    <Show when={isExpanded()} fallback={<Icon name="chevron-right" class="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />}>
                      <Icon name="chevron-down" class="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                    </Show>
                    <span class="text-xs font-semibold uppercase" style={{ color: "var(--text-muted)", "letter-spacing": "0.5px" }}>
                      {category}
                    </span>
                    <span class="text-xs" style={{ color: "var(--text-muted)" }}>
                      ({snippets().length})
                    </span>
                  </button>
                  
                  {/* Snippets in Category */}
                  <Show when={isExpanded()}>
                    <For each={snippets()}>
                      {(snippet) => {
                        const typeInfo = getTypeIcon(snippet.config.type as string);
                        const globalIndex = () => flatList().findIndex(s => s.id === snippet.id);
                        const isSelected = () => globalIndex() === selectedIndex();
                        
                        return (
                          <div
                            data-selected={isSelected()}
                            class="flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ml-4"
                            style={{
                              background: isSelected() ? "var(--surface-raised)" : "transparent",
                            }}
                            onMouseEnter={() => {
                              const idx = globalIndex();
                              if (idx >= 0) setSelectedIndex(idx);
                            }}
                            onClick={() => props.onSelect(snippet)}
                          >
                            {/* Icon */}
                            <div class="w-6 h-6 flex items-center justify-center shrink-0">
                              <Icon name={typeInfo.icon} class="w-4 h-4" style={{ color: typeInfo.color }} />
                            </div>

                            {/* Content */}
                            <div class="flex-1 min-w-0">
                              <div class="text-sm truncate" style={{ color: "var(--text-base)" }}>
                                {snippet.name}
                              </div>
                              <div class="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                                {snippet.description}
                              </div>
                            </div>

                            {/* Enter hint */}
                            <Show when={isSelected()}>
                              <span class="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                                Enter
                              </span>
                            </Show>
                          </div>
                        );
                      }}
                    </For>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>

        {/* Footer */}
        <div
          class="shrink-0 flex items-center justify-between px-3 py-2 border-t text-xs"
          style={{ 
            "border-color": "var(--border-weak)",
            color: "var(--text-muted)",
          }}
        >
          <div class="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>Enter to select</span>
            <span>Esc to close</span>
          </div>
          <span>
            {filteredSnippets().length} snippet{filteredSnippets().length !== 1 ? 's' : ''} available
          </span>
        </div>
      </div>
    </div>
  );
}

export default LaunchConfigPicker;

