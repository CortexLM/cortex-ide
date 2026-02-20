import { Show, For, createSignal, createEffect, onCleanup, createMemo } from "solid-js";
import { createStore, produce } from "solid-js/store";

// Error pattern types
export type ErrorCategory = 
  | "command_not_found"
  | "permission_denied"
  | "file_not_found"
  | "git_error"
  | "npm_error"
  | "yarn_error"
  | "python_error"
  | "syntax_error"
  | "network_error"
  | "unknown";

// Quick fix action
export interface QuickFixAction {
  id: string;
  label: string;
  description?: string;
  command?: string;
  priority: number;
  isLearned?: boolean;
}

// Detected error with suggested fixes
export interface DetectedError {
  id: string;
  category: ErrorCategory;
  originalLine: string;
  errorMessage: string;
  timestamp: number;
  fixes: QuickFixAction[];
  lineNumber?: number;
}

// Learned correction for personalized suggestions
interface LearnedCorrection {
  pattern: string;
  category: ErrorCategory;
  preferredFix: string;
  useCount: number;
  lastUsed: number;
}

// Common command typos and their corrections
const COMMAND_TYPO_MAP: Record<string, string> = {
  "gti": "git",
  "giit": "git",
  "gt": "git",
  "npm ": "npm",
  "npn": "npm",
  "nmp": "npm",
  "yran": "yarn",
  "yaarn": "yarn",
  "yanr": "yarn",
  "pyhton": "python",
  "pytohn": "python",
  "pyhon": "python",
  "pythn": "python",
  "noed": "node",
  "ndoe": "node",
  "noode": "node",
  "cta": "cat",
  "caat": "cat",
  "sl": "ls",
  "lss": "ls",
  "lls": "ls",
  "cd..": "cd ..",
  "cdd": "cd",
  "mkdr": "mkdir",
  "mkidr": "mkdir",
  "rn": "rm",
  "rmm": "rm",
  "touhc": "touch",
  "toch": "touch",
  "ecoh": "echo",
  "ehco": "echo",
  "grpe": "grep",
  "gerp": "grep",
  "sudp": "sudo",
  "suod": "sudo",
  "sssh": "ssh",
  "shh": "ssh",
  "curlr": "curl",
  "crul": "curl",
  "wgte": "wget",
  "weget": "wget",
  "dokcer": "docker",
  "dcoker": "docker",
  "docekr": "docker",
  "kubctl": "kubectl",
  "kubeclt": "kubectl",
  "kubetcl": "kubectl",
  "clera": "clear",
  "cealr": "clear",
  "claer": "clear",
  "eixt": "exit",
  "exti": "exit",
  "histroy": "history",
  "hisotry": "history",
};

// Error pattern definitions for detection
interface ErrorPattern {
  pattern: RegExp;
  category: ErrorCategory;
  extractInfo: (match: RegExpMatchArray) => { errorMessage: string; context?: Record<string, string> };
  generateFixes: (info: { errorMessage: string; context?: Record<string, string>; originalLine: string }) => QuickFixAction[];
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // Command not found patterns
  {
    pattern: /(?:bash|zsh|sh|powershell)?:?\s*(?:command not found|is not recognized|not found|'([^']+)' is not recognized).*?:?\s*(\w+)?/i,
    category: "command_not_found",
    extractInfo: (match) => ({
      errorMessage: match[0],
      context: { command: match[2] || match[1] || "" }
    }),
    generateFixes: (info) => {
      const fixes: QuickFixAction[] = [];
      const command = info.context?.command?.toLowerCase() || "";
      const originalLine = info.originalLine.toLowerCase();
      
      // Check for typos
      for (const [typo, correct] of Object.entries(COMMAND_TYPO_MAP)) {
        if (command.includes(typo) || originalLine.includes(typo)) {
          fixes.push({
            id: `typo-${correct}`,
            label: `Did you mean: ${correct}?`,
            description: `Replace '${typo}' with '${correct}'`,
            command: originalLine.replace(new RegExp(typo, "gi"), correct),
            priority: 100,
          });
        }
      }
      
      // Suggest installation based on common commands
      const installSuggestions: Record<string, string[]> = {
        "node": ["Install Node.js from nodejs.org", "nvm install node"],
        "npm": ["Install Node.js (includes npm)", "nvm install node"],
        "yarn": ["npm install -g yarn", "corepack enable"],
        "python": ["Install Python from python.org", "pyenv install 3.11"],
        "python3": ["Install Python 3", "apt install python3 (Linux)", "brew install python (macOS)"],
        "pip": ["python -m ensurepip", "apt install python3-pip (Linux)"],
        "git": ["Install Git from git-scm.com", "apt install git (Linux)", "brew install git (macOS)"],
        "docker": ["Install Docker from docker.com", "apt install docker.io (Linux)"],
        "kubectl": ["Install kubectl from kubernetes.io", "brew install kubectl (macOS)"],
        "cargo": ["Install Rust from rustup.rs", "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"],
        "go": ["Install Go from golang.org", "brew install go (macOS)"],
        "java": ["Install Java JDK", "apt install default-jdk (Linux)"],
        "make": ["apt install build-essential (Linux)", "xcode-select --install (macOS)"],
        "gcc": ["apt install build-essential (Linux)", "xcode-select --install (macOS)"],
        "wget": ["apt install wget (Linux)", "brew install wget (macOS)"],
        "curl": ["apt install curl (Linux)", "brew install curl (macOS)"],
      };
      
      if (command && installSuggestions[command]) {
        installSuggestions[command].forEach((suggestion, idx) => {
          fixes.push({
            id: `install-${command}-${idx}`,
            label: `Install ${command}`,
            description: suggestion,
            priority: 80 - idx,
          });
        });
      }
      
      return fixes;
    }
  },
  
  // Permission denied patterns
  {
    pattern: /(?:permission denied|access denied|EACCES|EPERM|cannot create|operation not permitted)/i,
    category: "permission_denied",
    extractInfo: (match) => ({
      errorMessage: match[0],
    }),
    generateFixes: (info) => {
      const fixes: QuickFixAction[] = [];
      const originalLine = info.originalLine.trim();
      
      // Suggest sudo for Unix-like commands
      if (!originalLine.startsWith("sudo ") && !originalLine.includes("powershell")) {
        fixes.push({
          id: "sudo",
          label: "Run with sudo",
          description: "Execute with elevated privileges",
          command: `sudo ${originalLine}`,
          priority: 100,
        });
      }
      
      // For npm global installs, suggest proper fix
      if (originalLine.includes("npm") && (originalLine.includes("-g") || originalLine.includes("--global"))) {
        fixes.push({
          id: "npm-fix-permissions",
          label: "Fix npm permissions",
          description: "Configure npm to use a directory you own",
          command: "mkdir -p ~/.npm-global && npm config set prefix '~/.npm-global'",
          priority: 90,
        });
      }
      
      fixes.push({
        id: "check-ownership",
        label: "Check file ownership",
        description: "Verify you have the right permissions",
        command: `ls -la ${originalLine.split(" ").pop() || "."}`,
        priority: 70,
      });
      
      return fixes;
    }
  },
  
  // File not found patterns
  {
    pattern: /(?:no such file or directory|ENOENT|cannot find|file not found|path not found|does not exist)(?:.*?['"]([^'"]+)['"])?/i,
    category: "file_not_found",
    extractInfo: (match) => ({
      errorMessage: match[0],
      context: { path: match[1] || "" }
    }),
    generateFixes: (info) => {
      const fixes: QuickFixAction[] = [];
      const path = info.context?.path || "";
      
      if (path) {
        // Suggest creating the directory/file
        fixes.push({
          id: "mkdir",
          label: "Create directory",
          description: `Create the missing directory`,
          command: `mkdir -p "${path.replace(/\/[^/]*$/, "")}"`,
          priority: 90,
        });
        
        fixes.push({
          id: "touch",
          label: "Create file",
          description: `Create the missing file`,
          command: `touch "${path}"`,
          priority: 85,
        });
      }
      
      // Suggest checking current directory
      fixes.push({
        id: "pwd",
        label: "Check current directory",
        description: "Verify you're in the right location",
        command: "pwd && ls -la",
        priority: 80,
      });
      
      fixes.push({
        id: "find",
        label: "Search for file",
        description: "Find the file in current directory tree",
        command: path ? `find . -name "${path.split("/").pop()}" 2>/dev/null` : "ls -la",
        priority: 75,
      });
      
      return fixes;
    }
  },
  
  // Git error patterns
  {
    pattern: /(?:fatal|error):\s*(?:not a git repository|unable to access|failed to push|rejected.*non-fast-forward|merge conflict|your local changes|untracked files|nothing to commit|divergent branches)/i,
    category: "git_error",
    extractInfo: (match) => ({
      errorMessage: match[0],
    }),
    generateFixes: (info) => {
      const fixes: QuickFixAction[] = [];
      const errorLower = info.errorMessage.toLowerCase();
      
      if (errorLower.includes("not a git repository")) {
        fixes.push({
          id: "git-init",
          label: "Initialize git repository",
          command: "git init",
          priority: 100,
        });
        fixes.push({
          id: "cd-root",
          label: "Navigate to repository root",
          description: "You may be in a subdirectory outside the repo",
          command: "cd $(git rev-parse --show-toplevel 2>/dev/null || pwd)",
          priority: 90,
        });
      }
      
      if (errorLower.includes("non-fast-forward") || errorLower.includes("failed to push") || errorLower.includes("rejected")) {
        fixes.push({
          id: "git-pull",
          label: "Pull changes first",
          description: "Fetch and merge remote changes",
          command: "git pull --rebase",
          priority: 100,
        });
        fixes.push({
          id: "git-fetch",
          label: "Fetch remote changes",
          command: "git fetch origin",
          priority: 90,
        });
      }
      
      if (errorLower.includes("merge conflict")) {
        fixes.push({
          id: "git-status",
          label: "Check conflicting files",
          command: "git status",
          priority: 100,
        });
        fixes.push({
          id: "git-diff",
          label: "View conflicts",
          command: "git diff --name-only --diff-filter=U",
          priority: 95,
        });
        fixes.push({
          id: "git-abort",
          label: "Abort merge",
          description: "Cancel the merge operation",
          command: "git merge --abort",
          priority: 80,
        });
      }
      
      if (errorLower.includes("your local changes") || errorLower.includes("untracked files")) {
        fixes.push({
          id: "git-stash",
          label: "Stash changes",
          description: "Save changes temporarily",
          command: "git stash",
          priority: 100,
        });
        fixes.push({
          id: "git-add-commit",
          label: "Commit changes",
          command: "git add -A && git commit -m 'WIP: save changes'",
          priority: 90,
        });
      }
      
      if (errorLower.includes("divergent branches")) {
        fixes.push({
          id: "git-rebase",
          label: "Rebase onto remote",
          command: "git pull --rebase origin main",
          priority: 100,
        });
        fixes.push({
          id: "git-merge",
          label: "Merge remote changes",
          command: "git pull origin main",
          priority: 90,
        });
      }
      
      if (errorLower.includes("unable to access")) {
        fixes.push({
          id: "git-remote",
          label: "Check remote URL",
          command: "git remote -v",
          priority: 100,
        });
        fixes.push({
          id: "git-auth",
          label: "Re-authenticate",
          description: "Your credentials may have expired",
          command: "git config --global credential.helper store",
          priority: 80,
        });
      }
      
      return fixes;
    }
  },
  
  // npm error patterns
  {
    pattern: /(?:npm ERR!|npm WARN|ERESOLVE|ENOTFOUND|ETARGET|peer dep|missing peer|could not resolve|package\.json not found|node_modules)/i,
    category: "npm_error",
    extractInfo: (match) => ({
      errorMessage: match[0],
    }),
    generateFixes: (info) => {
      const fixes: QuickFixAction[] = [];
      const errorLower = info.errorMessage.toLowerCase();
      
      if (errorLower.includes("eresolve") || errorLower.includes("peer dep") || errorLower.includes("could not resolve")) {
        fixes.push({
          id: "npm-legacy-peer",
          label: "Install with legacy peer deps",
          description: "Bypass peer dependency conflicts",
          command: "npm install --legacy-peer-deps",
          priority: 100,
        });
        fixes.push({
          id: "npm-force",
          label: "Force install",
          description: "Force installation (use with caution)",
          command: "npm install --force",
          priority: 80,
        });
      }
      
      if (errorLower.includes("package.json not found") || errorLower.includes("enoent")) {
        fixes.push({
          id: "npm-init",
          label: "Initialize package.json",
          command: "npm init -y",
          priority: 100,
        });
        fixes.push({
          id: "cd-project",
          label: "Navigate to project root",
          description: "Ensure you're in the right directory",
          command: "pwd && ls package.json",
          priority: 90,
        });
      }
      
      if (errorLower.includes("node_modules") || errorLower.includes("missing")) {
        fixes.push({
          id: "npm-install",
          label: "Run 'npm install'",
          description: "Install missing dependencies",
          command: "npm install",
          priority: 100,
        });
        fixes.push({
          id: "npm-ci",
          label: "Clean install",
          description: "Clean install from package-lock.json",
          command: "rm -rf node_modules && npm ci",
          priority: 90,
        });
      }
      
      // General npm troubleshooting
      fixes.push({
        id: "npm-cache-clean",
        label: "Clear npm cache",
        description: "Clean cache and retry",
        command: "npm cache clean --force",
        priority: 60,
      });
      
      return fixes;
    }
  },
  
  // yarn error patterns
  {
    pattern: /(?:yarn (?:error|ERR)|error Couldn't find|YN0002|An unexpected error occurred|resolution failed)/i,
    category: "yarn_error",
    extractInfo: (match) => ({
      errorMessage: match[0],
    }),
    generateFixes: (_info) => {
      const fixes: QuickFixAction[] = [];
      
      fixes.push({
        id: "yarn-install",
        label: "Run 'yarn install'",
        description: "Install missing dependencies",
        command: "yarn install",
        priority: 100,
      });
      
      fixes.push({
        id: "yarn-cache-clean",
        label: "Clear yarn cache",
        command: "yarn cache clean",
        priority: 80,
      });
      
      fixes.push({
        id: "yarn-reinstall",
        label: "Clean reinstall",
        description: "Remove node_modules and reinstall",
        command: "rm -rf node_modules yarn.lock && yarn install",
        priority: 70,
      });
      
      return fixes;
    }
  },
  
  // Python error patterns
  {
    pattern: /(?:ModuleNotFoundError|ImportError|No module named|pip.*not found|python.*not found|SyntaxError)/i,
    category: "python_error",
    extractInfo: (match) => ({
      errorMessage: match[0],
    }),
    generateFixes: (info) => {
      const fixes: QuickFixAction[] = [];
      const errorLower = info.errorMessage.toLowerCase();
      
      // Extract module name if present
      const moduleMatch = info.errorMessage.match(/(?:No module named|ModuleNotFoundError:.*)'([^']+)'/);
      const moduleName = moduleMatch?.[1];
      
      if (moduleName) {
        fixes.push({
          id: "pip-install",
          label: `Install ${moduleName}`,
          command: `pip install ${moduleName}`,
          priority: 100,
        });
        fixes.push({
          id: "pip3-install",
          label: `Install ${moduleName} (pip3)`,
          command: `pip3 install ${moduleName}`,
          priority: 95,
        });
      }
      
      if (errorLower.includes("pip") && errorLower.includes("not found")) {
        fixes.push({
          id: "ensure-pip",
          label: "Install pip",
          command: "python -m ensurepip --upgrade",
          priority: 100,
        });
      }
      
      fixes.push({
        id: "pip-requirements",
        label: "Install from requirements.txt",
        command: "pip install -r requirements.txt",
        priority: 85,
      });
      
      fixes.push({
        id: "pip-list",
        label: "List installed packages",
        command: "pip list",
        priority: 60,
      });
      
      return fixes;
    }
  },
  
  // Network error patterns
  {
    pattern: /(?:ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network.*error|connection.*refused|timeout|could not connect|unable to connect)/i,
    category: "network_error",
    extractInfo: (match) => ({
      errorMessage: match[0],
    }),
    generateFixes: (info) => {
      const fixes: QuickFixAction[] = [];
      
      fixes.push({
        id: "check-network",
        label: "Check network connection",
        command: "ping -c 3 google.com || ping google.com -n 3",
        priority: 100,
      });
      
      fixes.push({
        id: "check-dns",
        label: "Check DNS resolution",
        command: "nslookup google.com",
        priority: 90,
      });
      
      fixes.push({
        id: "retry",
        label: "Retry the command",
        description: "Network issues may be temporary",
        command: info.originalLine,
        priority: 80,
      });
      
      return fixes;
    }
  },
];

// Storage key for learned corrections
const LEARNED_CORRECTIONS_KEY = "terminal-quickfix-learned";

// Component props
export interface TerminalQuickFixProps {
  terminalId: string;
  terminalOutput: string;
  onApplyFix: (command: string) => void;
  visible?: boolean;
  position?: { x: number; y: number };
}

// Main component
export function TerminalQuickFix(props: TerminalQuickFixProps) {
  const [errors, setErrors] = createStore<DetectedError[]>([]);
  const [expandedErrorId, setExpandedErrorId] = createSignal<string | null>(null);
  const [showQuickFix, setShowQuickFix] = createSignal(false);
  const [learnedCorrections, setLearnedCorrections] = createSignal<LearnedCorrection[]>([]);
  
  let lastAnalyzedLength = 0;
  let popupRef: HTMLDivElement | undefined;

  // Load learned corrections from storage
  onCleanup(() => {
    // Save learned corrections on cleanup
    try {
      localStorage.setItem(LEARNED_CORRECTIONS_KEY, JSON.stringify(learnedCorrections()));
    } catch {
      // Storage may be full or disabled
    }
  });

  // Initialize learned corrections
  createEffect(() => {
    try {
      const stored = localStorage.getItem(LEARNED_CORRECTIONS_KEY);
      if (stored) {
        setLearnedCorrections(JSON.parse(stored));
      }
    } catch {
      // Invalid stored data
    }
  });

  // Analyze terminal output for errors
  createEffect(() => {
    const output = props.terminalOutput;
    if (!output || output.length <= lastAnalyzedLength) return;
    
    // Only analyze new content
    const newContent = output.slice(lastAnalyzedLength);
    lastAnalyzedLength = output.length;
    
    // Split into lines and analyze
    const lines = newContent.split("\n");
    const newErrors: DetectedError[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      for (const pattern of ERROR_PATTERNS) {
        const match = line.match(pattern.pattern);
        if (match) {
          const info = pattern.extractInfo(match);
          const fixes = pattern.generateFixes({
            ...info,
            originalLine: line,
          });
          
          // Apply learned corrections to prioritize fixes
          const sortedFixes = applyLearnedPriorities(fixes, pattern.category);
          
          if (sortedFixes.length > 0) {
            newErrors.push({
              id: `error-${Date.now()}-${i}`,
              category: pattern.category,
              originalLine: line,
              errorMessage: info.errorMessage,
              timestamp: Date.now(),
              fixes: sortedFixes,
              lineNumber: i,
            });
          }
          break; // Only match first pattern per line
        }
      }
    }
    
    if (newErrors.length > 0) {
      setErrors(produce(e => {
        // Keep only recent errors (last 10)
        const combined = [...e, ...newErrors].slice(-10);
        e.length = 0;
        e.push(...combined);
      }));
      
      // Auto-show quick fix for latest error
      if (newErrors.length > 0) {
        setExpandedErrorId(newErrors[newErrors.length - 1].id);
        setShowQuickFix(true);
      }
    }
  });

  // Apply learned priorities to fixes
  const applyLearnedPriorities = (fixes: QuickFixAction[], category: ErrorCategory): QuickFixAction[] => {
    const learned = learnedCorrections();
    
    return fixes.map(fix => {
      const correction = learned.find(
        l => l.category === category && l.preferredFix === fix.id
      );
      
      if (correction) {
        return {
          ...fix,
          priority: fix.priority + (correction.useCount * 10),
          isLearned: true,
        };
      }
      return fix;
    }).sort((a, b) => b.priority - a.priority);
  };

  // Record user's choice for learning
  const recordChoice = (category: ErrorCategory, fixId: string) => {
    setLearnedCorrections(prev => {
      const existing = prev.find(l => l.category === category && l.preferredFix === fixId);
      
      if (existing) {
        return prev.map(l => 
          l.category === category && l.preferredFix === fixId
            ? { ...l, useCount: l.useCount + 1, lastUsed: Date.now() }
            : l
        );
      }
      
      return [...prev, {
        pattern: "",
        category,
        preferredFix: fixId,
        useCount: 1,
        lastUsed: Date.now(),
      }];
    });
  };

  // Apply a fix
  const applyFix = (error: DetectedError, fix: QuickFixAction) => {
    if (fix.command) {
      props.onApplyFix(fix.command);
      recordChoice(error.category, fix.id);
    }
    
    // Remove the error from list
    setErrors(produce(e => {
      const idx = e.findIndex(err => err.id === error.id);
      if (idx !== -1) e.splice(idx, 1);
    }));
    
    setShowQuickFix(false);
    setExpandedErrorId(null);
  };

  // Dismiss error
  const dismissError = (errorId: string) => {
    setErrors(produce(e => {
      const idx = e.findIndex(err => err.id === errorId);
      if (idx !== -1) e.splice(idx, 1);
    }));
    
    if (expandedErrorId() === errorId) {
      setExpandedErrorId(null);
    }
    
    if (errors.length === 0) {
      setShowQuickFix(false);
    }
  };

  // Clear all errors
  const clearAllErrors = () => {
    setErrors([]);
    setExpandedErrorId(null);
    setShowQuickFix(false);
  };

  // Get most recent error
  const latestError = createMemo(() => {
    if (errors.length === 0) return null;
    return errors[errors.length - 1];
  });

  // Get category icon color
  const getCategoryColor = (category: ErrorCategory): string => {
    switch (category) {
      case "permission_denied":
        return "var(--cortex-warning)"; // amber
      case "file_not_found":
        return "var(--cortex-info)"; // blue
      case "git_error":
        return "var(--cortex-warning)"; // orange
      case "npm_error":
      case "yarn_error":
        return "var(--cortex-error)"; // red
      case "python_error":
        return "var(--cortex-success)"; // green
      case "network_error":
        return "var(--cortex-info)"; // violet
      case "command_not_found":
      default:
        return "var(--cortex-warning)"; // yellow
    }
  };

  // Get readable category name
  const getCategoryName = (category: ErrorCategory): string => {
    const names: Record<ErrorCategory, string> = {
      command_not_found: "Command Not Found",
      permission_denied: "Permission Denied",
      file_not_found: "File Not Found",
      git_error: "Git Error",
      npm_error: "npm Error",
      yarn_error: "Yarn Error",
      python_error: "Python Error",
      syntax_error: "Syntax Error",
      network_error: "Network Error",
      unknown: "Error",
    };
    return names[category];
  };

  // Close popup when clicking outside
  createEffect(() => {
    if (showQuickFix()) {
      const handleClickOutside = (e: MouseEvent) => {
        if (popupRef && !popupRef.contains(e.target as Node)) {
          setShowQuickFix(false);
        }
      };
      
      // Delay to prevent immediate close
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 100);
      
      onCleanup(() => {
        document.removeEventListener("mousedown", handleClickOutside);
      });
    }
  });

  return (
    <Show when={props.visible !== false && errors.length > 0}>
      {/* Light bulb indicator */}
      <div 
        class="absolute z-50"
        style={{
          left: typeof props.position?.x === "number" ? `${props.position.x}px` : (props.position?.x ?? "8px"),
          bottom: typeof props.position?.y === "number" ? `${props.position.y}px` : (props.position?.y ?? "8px"),
        }}
      >
        {/* Quick fix button */}
        <button
          class="flex items-center justify-center w-6 h-6 rounded-md transition-all cursor-pointer"
          style={{
            background: showQuickFix() ? "var(--surface-raised)" : "rgba(234, 179, 8, 0.15)",
            border: "1px solid rgba(234, 179, 8, 0.3)",
            color: "var(--cortex-warning)",
          }}
          onClick={() => {
            setShowQuickFix(!showQuickFix());
            if (!expandedErrorId() && latestError()) {
              setExpandedErrorId(latestError()!.id);
            }
          }}
          title={`${errors.length} error${errors.length > 1 ? "s" : ""} detected - Click for quick fixes`}
        >
          {/* Light bulb SVG */}
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="2" 
            stroke-linecap="round" 
            stroke-linejoin="round"
            class="w-4 h-4"
          >
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
          </svg>
          
          {/* Error count badge */}
          <Show when={errors.length > 1}>
            <span 
              class="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full"
              style={{
                background: "var(--cortex-error)",
                color: "white",
              }}
            >
              {errors.length > 9 ? "9+" : errors.length}
            </span>
          </Show>
        </button>

        {/* Quick fix popup */}
        <Show when={showQuickFix()}>
          <div
            ref={popupRef}
            class="absolute bottom-full left-0 mb-2 min-w-[320px] max-w-[400px] rounded-lg shadow-xl overflow-hidden"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-base)",
            }}
          >
            {/* Header */}
            <div 
              class="flex items-center justify-between px-3 py-2 border-b"
              style={{ 
                background: "var(--surface-base)",
                "border-color": "var(--border-weak)",
              }}
            >
              <div class="flex items-center gap-2">
                <svg 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="var(--cortex-warning)" 
                  stroke-width="2" 
                  stroke-linecap="round" 
                  stroke-linejoin="round"
                  class="w-4 h-4"
                >
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                  <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
                </svg>
                <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                  Quick Fix
                </span>
                <span class="text-xs px-1.5 py-0.5 rounded-full" style={{ 
                  background: "var(--surface-raised)",
                  color: "var(--text-weak)",
                }}>
                  {errors.length} error{errors.length > 1 ? "s" : ""}
                </span>
              </div>
              
              <div class="flex items-center gap-1">
                <button
                  class="p-1 rounded transition-colors hover:bg-[var(--surface-active)]"
                  style={{ color: "var(--text-weak)" }}
                  onClick={clearAllErrors}
                  title="Clear all"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
                <button
                  class="p-1 rounded transition-colors hover:bg-[var(--surface-active)]"
                  style={{ color: "var(--text-weak)" }}
                  onClick={() => setShowQuickFix(false)}
                  title="Close"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Error list */}
            <div class="max-h-[300px] overflow-y-auto">
              <For each={errors}>
                {(error) => (
                  <div 
                    class="border-b last:border-b-0"
                    style={{ "border-color": "var(--border-weak)" }}
                  >
                    {/* Error header */}
                    <button
                      class="w-full flex items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-active)]"
                      onClick={() => setExpandedErrorId(
                        expandedErrorId() === error.id ? null : error.id
                      )}
                    >
                      {/* Category indicator */}
                      <div 
                        class="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: getCategoryColor(error.category) }}
                      />
                      
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span 
                            class="text-xs font-medium"
                            style={{ color: getCategoryColor(error.category) }}
                          >
                            {getCategoryName(error.category)}
                          </span>
                          <Show when={error.fixes.some(f => f.isLearned)}>
                            <span 
                              class="text-[10px] px-1 rounded"
                              style={{ 
                                background: "rgba(34, 197, 94, 0.15)",
                                color: "var(--cortex-success)",
                              }}
                            >
                              learned
                            </span>
                          </Show>
                        </div>
                        <p 
                          class="text-xs truncate mt-0.5"
                          style={{ color: "var(--text-weak)" }}
                          title={error.originalLine}
                        >
                          {error.errorMessage}
                        </p>
                      </div>
                      
                      {/* Expand/collapse icon */}
                      <svg 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        stroke-width="2" 
                        class="w-4 h-4 shrink-0 transition-transform"
                        style={{ 
                          color: "var(--text-weaker)",
                          transform: expandedErrorId() === error.id ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>

                    {/* Fixes list */}
                    <Show when={expandedErrorId() === error.id}>
                      <div 
                        class="px-3 py-2"
                        style={{ background: "var(--surface-base)" }}
                      >
                        <For each={error.fixes.slice(0, 5)}>
                          {(fix) => (
                            <button
                              class="w-full flex items-start gap-2 px-2 py-1.5 rounded text-left transition-colors hover:bg-[var(--surface-raised)] group"
                              onClick={() => applyFix(error, fix)}
                              title={fix.command || fix.description}
                            >
                              {/* Fix icon */}
                              <div 
                                class="w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5"
                                style={{ 
                                  background: fix.isLearned 
                                    ? "rgba(34, 197, 94, 0.15)" 
                                    : "var(--surface-raised)",
                                  color: fix.isLearned 
                                    ? "var(--cortex-success)" 
                                    : "var(--text-weaker)",
                                }}
                              >
                                <Show when={fix.isLearned} fallback={
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3">
                                    <path d="M12 5v14M5 12h14" />
                                  </svg>
                                }>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3">
                                    <path d="M20 6L9 17l-5-5" />
                                  </svg>
                                </Show>
                              </div>
                              
                              <div class="flex-1 min-w-0">
                                <span 
                                  class="text-xs font-medium block"
                                  style={{ color: "var(--text-base)" }}
                                >
                                  {fix.label}
                                </span>
                                <Show when={fix.description || fix.command}>
                                  <span 
                                    class="text-[11px] block truncate mt-0.5"
                                    style={{ color: "var(--text-weaker)" }}
                                  >
                                    {fix.command || fix.description}
                                  </span>
                                </Show>
                              </div>
                              
                              {/* Apply button - visible on hover */}
                              <span 
                                class="text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                style={{
                                  background: "var(--surface-raised)",
                                  color: "var(--text-weak)",
                                }}
                              >
                                Apply
                              </span>
                            </button>
                          )}
                        </For>
                        
                        {/* Dismiss button */}
                        <button
                          class="w-full flex items-center justify-center gap-1 px-2 py-1.5 mt-1 rounded text-xs transition-colors hover:bg-[var(--surface-raised)]"
                          style={{ color: "var(--text-weaker)" }}
                          onClick={() => dismissError(error.id)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                          Dismiss
                        </button>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}

// Hook for using quick fix in terminal
export function useTerminalQuickFix(_terminalId: string) {
  const [output, setOutput] = createSignal("");
  const [isEnabled, setIsEnabled] = createSignal(true);

  const appendOutput = (data: string) => {
    setOutput(prev => prev + data);
  };

  const clearOutput = () => {
    setOutput("");
  };

  const toggle = () => {
    setIsEnabled(prev => !prev);
  };

  return {
    output,
    setOutput,
    appendOutput,
    clearOutput,
    isEnabled,
    setIsEnabled,
    toggle,
  };
}

// Utility to detect errors from a single line
export function detectErrorFromLine(line: string): DetectedError | null {
  for (const pattern of ERROR_PATTERNS) {
    const match = line.match(pattern.pattern);
    if (match) {
      const info = pattern.extractInfo(match);
      const fixes = pattern.generateFixes({
        ...info,
        originalLine: line,
      });
      
      if (fixes.length > 0) {
        return {
          id: `error-${Date.now()}`,
          category: pattern.category,
          originalLine: line,
          errorMessage: info.errorMessage,
          timestamp: Date.now(),
          fixes: fixes.sort((a, b) => b.priority - a.priority),
        };
      }
    }
  }
  return null;
}

export default TerminalQuickFix;

