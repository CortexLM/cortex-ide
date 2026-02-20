import { createContext, useContext, ParentProps, onMount, createEffect, on } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Rules Types
// ============================================================================

/** A single AI instruction rule */
export interface Rule {
  id: string;
  name: string;
  description: string;
  content: string;
  enabled: boolean;
  priority: number;
  tags: string[];
  source: RuleSource;
  createdAt: string;
  updatedAt: string;
}

/** Source of a rule */
export type RuleSource = "project" | "user" | "builtin";

/** A .rules file containing multiple rules */
export interface RulesFile {
  path: string;
  name: string;
  source: RuleSource;
  rules: Rule[];
  lastModified: string;
}

/** Configuration for rule inheritance */
export interface RuleInheritance {
  enabled: boolean;
  parentRulesPath: string | null;
  mergeStrategy: "override" | "append" | "prepend";
}

/** Rule composition for combining multiple rules */
export interface RuleComposition {
  id: string;
  name: string;
  description: string;
  ruleIds: string[];
  enabled: boolean;
}

/** Preview of how rules affect AI context */
export interface RulePreview {
  totalRules: number;
  enabledRules: number;
  estimatedTokens: number;
  previewText: string;
  warnings: string[];
}

// ============================================================================
// Rules State
// ============================================================================

interface RulesLibraryState {
  rulesFiles: RulesFile[];
  projectRoot: string | null;
  compositions: RuleComposition[];
  inheritance: RuleInheritance;
  showPanel: boolean;
  editingRule: { rule: Rule; filePath: string } | null;
  selectedRuleId: string | null;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  filterTags: string[];
  filterSource: RuleSource | "all";
}

interface RulesLibraryContextValue {
  state: RulesLibraryState;
  // Rule management
  loadRules: () => Promise<void>;
  scanProjectRules: (projectPath: string) => Promise<void>;
  getAllRules: () => Rule[];
  getEnabledRules: () => Rule[];
  getRuleById: (id: string) => Rule | undefined;
  getRulesBySource: (source: RuleSource) => Rule[];
  getRulesByTag: (tag: string) => Rule[];
  // CRUD operations
  createRule: (rule: Omit<Rule, "id" | "createdAt" | "updatedAt">, filePath?: string) => Promise<void>;
  updateRule: (id: string, updates: Partial<Rule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  duplicateRule: (id: string) => Promise<void>;
  // Enable/disable
  toggleRule: (id: string) => Promise<void>;
  enableRule: (id: string) => Promise<void>;
  disableRule: (id: string) => Promise<void>;
  enableAllRules: () => Promise<void>;
  disableAllRules: () => Promise<void>;
  // Rule ordering
  setRulePriority: (id: string, priority: number) => Promise<void>;
  moveRuleUp: (id: string) => Promise<void>;
  moveRuleDown: (id: string) => Promise<void>;
  // Composition
  createComposition: (composition: Omit<RuleComposition, "id">) => void;
  updateComposition: (id: string, updates: Partial<RuleComposition>) => void;
  deleteComposition: (id: string) => void;
  getComposedRules: (compositionId: string) => Rule[];
  // Inheritance
  setInheritance: (inheritance: Partial<RuleInheritance>) => void;
  getInheritedRules: () => Rule[];
  // Preview
  previewRules: () => RulePreview;
  getActiveRulesContext: () => string;
  estimateTokenCount: (text: string) => number;
  // Panel controls
  openPanel: () => void;
  closePanel: () => void;
  editRule: (rule: Rule, filePath: string) => void;
  createNewRule: (source?: RuleSource) => void;
  closeEditor: () => void;
  selectRule: (id: string | null) => void;
  // Search & filter
  setSearchQuery: (query: string) => void;
  setFilterTags: (tags: string[]) => void;
  setFilterSource: (source: RuleSource | "all") => void;
  getFilteredRules: () => Rule[];
  getAllTags: () => string[];
  // File operations
  importRulesFile: (path: string) => Promise<void>;
  exportRulesFile: (path: string, ruleIds?: string[]) => Promise<void>;
  createRulesFile: (name: string, source: RuleSource) => Promise<string>;
  deleteRulesFile: (path: string) => Promise<void>;
  // Utility
  validateRule: (rule: Partial<Rule>) => string[];
  formatRuleContent: (content: string) => string;
}

const RulesLibraryContext = createContext<RulesLibraryContextValue>();

const RULES_STORAGE_KEY = "cortex-rules-library";

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateCompositionId(): string {
  return `comp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

function parseRulesFile(content: string, filePath: string, source: RuleSource): Rule[] {
  const rules: Rule[] = [];
  
  // Parse markdown-like .rules format
  // Format:
  // # Rule Name
  // > Description of the rule
  // @tags: tag1, tag2
  // @priority: 10
  // @enabled: true
  //
  // Rule content goes here...
  // ---
  
  const sections = content.split(/^---$/m).filter(s => s.trim());
  
  for (const section of sections) {
    const lines = section.trim().split("\n");
    let name = "";
    let description = "";
    let tags: string[] = [];
    let priority = 50;
    let enabled = true;
    const contentLines: string[] = [];
    let inContent = false;
    
    for (const line of lines) {
      if (line.startsWith("# ") && !inContent) {
        name = line.substring(2).trim();
      } else if (line.startsWith("> ") && !inContent) {
        description = line.substring(2).trim();
      } else if (line.startsWith("@tags:") && !inContent) {
        tags = line.substring(6).split(",").map(t => t.trim()).filter(Boolean);
      } else if (line.startsWith("@priority:") && !inContent) {
        priority = parseInt(line.substring(10).trim(), 10) || 50;
      } else if (line.startsWith("@enabled:") && !inContent) {
        enabled = line.substring(9).trim().toLowerCase() !== "false";
      } else if (line.trim() || inContent) {
        inContent = true;
        contentLines.push(line);
      }
    }
    
    if (name && contentLines.length > 0) {
      rules.push({
        id: generateId(),
        name,
        description,
        content: contentLines.join("\n").trim(),
        enabled,
        priority,
        tags,
        source,
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
      });
    }
  }
  
  // If no structured rules found, treat entire content as a single rule
  if (rules.length === 0 && content.trim()) {
    const fileName = filePath.split(/[/\\]/).pop()?.replace(".rules", "") || "Unnamed Rule";
    rules.push({
      id: generateId(),
      name: fileName,
      description: `Rule from ${filePath}`,
      content: content.trim(),
      enabled: true,
      priority: 50,
      tags: [],
      source,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
    });
  }
  
  return rules;
}

function serializeRulesToFile(rules: Rule[]): string {
  return rules.map(rule => {
    const lines: string[] = [];
    lines.push(`# ${rule.name}`);
    if (rule.description) {
      lines.push(`> ${rule.description}`);
    }
    if (rule.tags.length > 0) {
      lines.push(`@tags: ${rule.tags.join(", ")}`);
    }
    lines.push(`@priority: ${rule.priority}`);
    lines.push(`@enabled: ${rule.enabled}`);
    lines.push("");
    lines.push(rule.content);
    return lines.join("\n");
  }).join("\n---\n");
}

// ============================================================================
// Default Rules
// ============================================================================

function getDefaultRules(): RulesFile[] {
  return [
    {
      path: "builtin/coding-standards.rules",
      name: "Coding Standards",
      source: "builtin",
      lastModified: getCurrentTimestamp(),
      rules: [
        {
          id: generateId(),
          name: "Code Quality",
          description: "General code quality guidelines",
          content: `When writing code:
- Prioritize code correctness and clarity
- Use meaningful variable and function names (no abbreviations)
- Handle errors appropriately - never silently discard errors
- Write self-documenting code; add comments only for non-obvious decisions
- Follow existing patterns and conventions in the codebase`,
          enabled: true,
          priority: 100,
          tags: ["quality", "general"],
          source: "builtin",
          createdAt: getCurrentTimestamp(),
          updatedAt: getCurrentTimestamp(),
        },
        {
          id: generateId(),
          name: "TypeScript Best Practices",
          description: "TypeScript-specific guidelines",
          content: `For TypeScript code:
- Use explicit types instead of 'any'
- Prefer interfaces over type aliases for object types
- Use strict null checks
- Leverage union types and discriminated unions
- Use readonly for immutable properties
- Prefer const assertions for literal types`,
          enabled: true,
          priority: 80,
          tags: ["typescript", "language"],
          source: "builtin",
          createdAt: getCurrentTimestamp(),
          updatedAt: getCurrentTimestamp(),
        },
        {
          id: generateId(),
          name: "Rust Best Practices",
          description: "Rust-specific guidelines",
          content: `For Rust code:
- Avoid using functions that panic like unwrap() - use ? to propagate errors
- Be careful with indexing operations that may panic
- Never silently discard errors with let _ = on fallible operations
- Use variable shadowing to scope clones in async contexts
- Prefer implementing functionality in existing files unless it's a new logical component
- Never create files with mod.rs paths - prefer src/some_module.rs`,
          enabled: true,
          priority: 80,
          tags: ["rust", "language"],
          source: "builtin",
          createdAt: getCurrentTimestamp(),
          updatedAt: getCurrentTimestamp(),
        },
      ],
    },
    {
      path: "builtin/testing.rules",
      name: "Testing Guidelines",
      source: "builtin",
      lastModified: getCurrentTimestamp(),
      rules: [
        {
          id: generateId(),
          name: "Test Coverage",
          description: "Guidelines for test coverage",
          content: `When writing tests:
- Write tests for both happy paths and edge cases
- Use descriptive test names that explain what is being tested
- Keep tests focused and independent
- Mock external dependencies appropriately
- Aim for meaningful coverage, not just high percentages`,
          enabled: true,
          priority: 70,
          tags: ["testing", "quality"],
          source: "builtin",
          createdAt: getCurrentTimestamp(),
          updatedAt: getCurrentTimestamp(),
        },
      ],
    },
  ];
}

// ============================================================================
// Rules Library Provider
// ============================================================================

export function RulesLibraryProvider(props: ParentProps) {
  const [state, setState] = createStore<RulesLibraryState>({
    rulesFiles: [],
    projectRoot: null,
    compositions: [],
    inheritance: {
      enabled: true,
      parentRulesPath: null,
      mergeStrategy: "append",
    },
    showPanel: false,
    editingRule: null,
    selectedRuleId: null,
    loading: false,
    error: null,
    searchQuery: "",
    filterTags: [],
    filterSource: "all",
  });

  onMount(() => {
    loadRules();
  });

  const loadRules = async (): Promise<void> => {
    setState("loading", true);
    setState("error", null);

    try {
      // Load from localStorage
      const stored = localStorage.getItem(RULES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setState("rulesFiles", parsed.rulesFiles || []);
        setState("compositions", parsed.compositions || []);
        setState("inheritance", parsed.inheritance || state.inheritance);
      }

      // Add built-in rules if not present
      const hasBuiltin = state.rulesFiles.some(f => f.source === "builtin");
      if (!hasBuiltin) {
        const defaultRules = getDefaultRules();
        setState("rulesFiles", [...state.rulesFiles, ...defaultRules]);
      }

      // Try to scan project rules if we have a project root
      if (state.projectRoot) {
        await scanProjectRules(state.projectRoot);
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
    } finally {
      setState("loading", false);
    }
  };

  const saveState = () => {
    const data = {
      rulesFiles: state.rulesFiles.filter(f => f.source !== "project"),
      compositions: state.compositions,
      inheritance: state.inheritance,
    };
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(data));
  };

  // Auto-save on state changes
  createEffect(on(
    () => [state.rulesFiles, state.compositions, state.inheritance],
    () => saveState(),
    { defer: true }
  ));

  const scanProjectRules = async (projectPath: string): Promise<void> => {
    setState("projectRoot", projectPath);
    
    try {
      // Try to read .rules files from project root via Tauri
      const rulesFiles = await invoke<{ path: string; content: string }[]>("rules_scan_project", {
        projectPath,
      });

      // Remove existing project rules
      setState("rulesFiles", files => files.filter(f => f.source !== "project"));

      // Parse and add new project rules
      for (const file of rulesFiles) {
        const rules = parseRulesFile(file.content, file.path, "project");
        const rulesFile: RulesFile = {
          path: file.path,
          name: file.path.split(/[/\\]/).pop() || "Unknown",
          source: "project",
          rules,
          lastModified: getCurrentTimestamp(),
        };
        setState("rulesFiles", files => [...files, rulesFile]);
      }
    } catch (e) {
      // Project scanning failed - might not have Tauri available
      console.warn("Failed to scan project rules:", e);
    }
  };

  const getAllRules = (): Rule[] => {
    const allRules: Rule[] = [];
    for (const file of state.rulesFiles) {
      allRules.push(...file.rules);
    }
    return allRules.sort((a, b) => b.priority - a.priority);
  };

  const getEnabledRules = (): Rule[] => {
    return getAllRules().filter(r => r.enabled);
  };

  const getRuleById = (id: string): Rule | undefined => {
    return getAllRules().find(r => r.id === id);
  };

  const getRulesBySource = (source: RuleSource): Rule[] => {
    return getAllRules().filter(r => r.source === source);
  };

  const getRulesByTag = (tag: string): Rule[] => {
    return getAllRules().filter(r => r.tags.includes(tag));
  };

  const findRuleFileIndex = (ruleId: string): { fileIndex: number; ruleIndex: number } | null => {
    for (let fileIndex = 0; fileIndex < state.rulesFiles.length; fileIndex++) {
      const ruleIndex = state.rulesFiles[fileIndex].rules.findIndex(r => r.id === ruleId);
      if (ruleIndex !== -1) {
        return { fileIndex, ruleIndex };
      }
    }
    return null;
  };

  const createRule = async (
    rule: Omit<Rule, "id" | "createdAt" | "updatedAt">,
    filePath?: string
  ): Promise<void> => {
    const newRule: Rule = {
      ...rule,
      id: generateId(),
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
    };

    const targetPath = filePath || `user/${newRule.source}.rules`;
    let fileIndex = state.rulesFiles.findIndex(f => f.path === targetPath);

    if (fileIndex === -1) {
      // Create new file
      const newFile: RulesFile = {
        path: targetPath,
        name: targetPath.split(/[/\\]/).pop() || "Custom Rules",
        source: newRule.source,
        rules: [newRule],
        lastModified: getCurrentTimestamp(),
      };
      setState("rulesFiles", files => [...files, newFile]);
    } else {
      // Add to existing file
      setState("rulesFiles", fileIndex, "rules", rules => [...rules, newRule]);
      setState("rulesFiles", fileIndex, "lastModified", getCurrentTimestamp());
    }

    // Save to file system if it's a project rule
    if (newRule.source === "project" && state.projectRoot) {
      try {
        await invoke("rules_save_file", {
          path: targetPath,
          content: serializeRulesToFile(state.rulesFiles[fileIndex >= 0 ? fileIndex : state.rulesFiles.length - 1].rules),
        });
      } catch (e) {
        console.error("Failed to save rules file:", e);
      }
    }
  };

  const updateRule = async (id: string, updates: Partial<Rule>): Promise<void> => {
    const location = findRuleFileIndex(id);
    if (!location) return;

    setState(
      "rulesFiles",
      location.fileIndex,
      "rules",
      location.ruleIndex,
      produce((rule) => {
        Object.assign(rule, updates, { updatedAt: getCurrentTimestamp() });
      })
    );
    setState("rulesFiles", location.fileIndex, "lastModified", getCurrentTimestamp());
  };

  const deleteRule = async (id: string): Promise<void> => {
    const location = findRuleFileIndex(id);
    if (!location) return;

    setState(
      "rulesFiles",
      location.fileIndex,
      "rules",
      rules => rules.filter(r => r.id !== id)
    );
    setState("rulesFiles", location.fileIndex, "lastModified", getCurrentTimestamp());
  };

  const duplicateRule = async (id: string): Promise<void> => {
    const rule = getRuleById(id);
    if (!rule) return;

    await createRule({
      ...rule,
      name: `${rule.name} (Copy)`,
      enabled: false,
    });
  };

  const toggleRule = async (id: string): Promise<void> => {
    const rule = getRuleById(id);
    if (rule) {
      await updateRule(id, { enabled: !rule.enabled });
    }
  };

  const enableRule = async (id: string): Promise<void> => {
    await updateRule(id, { enabled: true });
  };

  const disableRule = async (id: string): Promise<void> => {
    await updateRule(id, { enabled: false });
  };

  const enableAllRules = async (): Promise<void> => {
    for (const rule of getAllRules()) {
      await enableRule(rule.id);
    }
  };

  const disableAllRules = async (): Promise<void> => {
    for (const rule of getAllRules()) {
      await disableRule(rule.id);
    }
  };

  const setRulePriority = async (id: string, priority: number): Promise<void> => {
    await updateRule(id, { priority: Math.max(0, Math.min(100, priority)) });
  };

  const moveRuleUp = async (id: string): Promise<void> => {
    const rule = getRuleById(id);
    if (rule) {
      await setRulePriority(id, rule.priority + 10);
    }
  };

  const moveRuleDown = async (id: string): Promise<void> => {
    const rule = getRuleById(id);
    if (rule) {
      await setRulePriority(id, rule.priority - 10);
    }
  };

  const createComposition = (composition: Omit<RuleComposition, "id">): void => {
    const newComposition: RuleComposition = {
      ...composition,
      id: generateCompositionId(),
    };
    setState("compositions", comps => [...comps, newComposition]);
  };

  const updateComposition = (id: string, updates: Partial<RuleComposition>): void => {
    setState(
      "compositions",
      comp => comp.id === id,
      produce((comp) => Object.assign(comp, updates))
    );
  };

  const deleteComposition = (id: string): void => {
    setState("compositions", comps => comps.filter(c => c.id !== id));
  };

  const getComposedRules = (compositionId: string): Rule[] => {
    const composition = state.compositions.find(c => c.id === compositionId);
    if (!composition) return [];
    
    return composition.ruleIds
      .map(id => getRuleById(id))
      .filter((r): r is Rule => r !== undefined);
  };

  const setInheritance = (inheritance: Partial<RuleInheritance>): void => {
    setState("inheritance", inh => ({ ...inh, ...inheritance }));
  };

  const getInheritedRules = (): Rule[] => {
    if (!state.inheritance.enabled || !state.inheritance.parentRulesPath) {
      return [];
    }
    
    const parentFile = state.rulesFiles.find(f => f.path === state.inheritance.parentRulesPath);
    return parentFile?.rules || [];
  };

  const previewRules = (): RulePreview => {
    const enabledRules = getEnabledRules();
    const allRules = getAllRules();
    const context = getActiveRulesContext();
    const warnings: string[] = [];

    // Check for potential issues
    if (enabledRules.length === 0) {
      warnings.push("No rules are currently enabled");
    }

    const tokens = estimateTokenCount(context);
    if (tokens > 4000) {
      warnings.push(`Rules context is large (${tokens} estimated tokens). Consider disabling some rules.`);
    }

    // Check for conflicting rules
    const tagCounts = new Map<string, number>();
    for (const rule of enabledRules) {
      for (const tag of rule.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    for (const [tag, count] of tagCounts) {
      if (count > 3) {
        warnings.push(`Multiple rules with tag "${tag}" (${count}). Consider consolidating.`);
      }
    }

    return {
      totalRules: allRules.length,
      enabledRules: enabledRules.length,
      estimatedTokens: tokens,
      previewText: context,
      warnings,
    };
  };

  const getActiveRulesContext = (): string => {
    const rules = getEnabledRules();
    if (rules.length === 0) {
      return "";
    }

    const sections: string[] = [];
    
    // Group by source
    const projectRules = rules.filter(r => r.source === "project");
    const userRules = rules.filter(r => r.source === "user");
    const builtinRules = rules.filter(r => r.source === "builtin");

    if (projectRules.length > 0) {
      sections.push("## Project Rules\n\n" + projectRules.map(r => r.content).join("\n\n"));
    }
    if (userRules.length > 0) {
      sections.push("## Custom Rules\n\n" + userRules.map(r => r.content).join("\n\n"));
    }
    if (builtinRules.length > 0) {
      sections.push("## General Guidelines\n\n" + builtinRules.map(r => r.content).join("\n\n"));
    }

    return sections.join("\n\n---\n\n");
  };

  const estimateTokenCount = (text: string): number => {
    return estimateTokens(text);
  };

  const openPanel = () => {
    setState("showPanel", true);
  };

  const closePanel = () => {
    setState("showPanel", false);
    setState("editingRule", null);
  };

  const editRule = (rule: Rule, filePath: string) => {
    setState("editingRule", { rule, filePath });
  };

  const createNewRule = (source: RuleSource = "user") => {
    const newRule: Rule = {
      id: "",
      name: "",
      description: "",
      content: "",
      enabled: true,
      priority: 50,
      tags: [],
      source,
      createdAt: "",
      updatedAt: "",
    };
    setState("editingRule", { rule: newRule, filePath: `user/${source}.rules` });
  };

  const closeEditor = () => {
    setState("editingRule", null);
  };

  const selectRule = (id: string | null) => {
    setState("selectedRuleId", id);
  };

  const setSearchQuery = (query: string) => {
    setState("searchQuery", query);
  };

  const setFilterTags = (tags: string[]) => {
    setState("filterTags", tags);
  };

  const setFilterSource = (source: RuleSource | "all") => {
    setState("filterSource", source);
  };

  const getFilteredRules = (): Rule[] => {
    let rules = getAllRules();

    // Filter by search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      rules = rules.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query) ||
        r.content.toLowerCase().includes(query) ||
        r.tags.some(t => t.toLowerCase().includes(query))
      );
    }

    // Filter by tags
    if (state.filterTags.length > 0) {
      rules = rules.filter(r =>
        state.filterTags.some(tag => r.tags.includes(tag))
      );
    }

    // Filter by source
    if (state.filterSource !== "all") {
      rules = rules.filter(r => r.source === state.filterSource);
    }

    return rules;
  };

  const getAllTags = (): string[] => {
    const tags = new Set<string>();
    for (const rule of getAllRules()) {
      for (const tag of rule.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort();
  };

  const importRulesFile = async (path: string): Promise<void> => {
    try {
      const content = await invoke<string>("rules_read_file", { path });
      const rules = parseRulesFile(content, path, "user");
      const fileName = path.split(/[/\\]/).pop() || "Imported Rules";
      
      const newFile: RulesFile = {
        path,
        name: fileName,
        source: "user",
        rules,
        lastModified: getCurrentTimestamp(),
      };
      
      setState("rulesFiles", files => [...files, newFile]);
    } catch (e) {
      throw new Error(`Failed to import rules file: ${e}`);
    }
  };

  const exportRulesFile = async (path: string, ruleIds?: string[]): Promise<void> => {
    const rules = ruleIds
      ? ruleIds.map(id => getRuleById(id)).filter((r): r is Rule => r !== undefined)
      : getEnabledRules();
    
    const content = serializeRulesToFile(rules);
    
    try {
      await invoke("rules_write_file", { path, content });
    } catch (e) {
      throw new Error(`Failed to export rules file: ${e}`);
    }
  };

  const createRulesFile = async (name: string, source: RuleSource): Promise<string> => {
    const path = source === "project" 
      ? `${state.projectRoot || "."}/${name}.rules`
      : `user/${name}.rules`;
    
    const newFile: RulesFile = {
      path,
      name: `${name}.rules`,
      source,
      rules: [],
      lastModified: getCurrentTimestamp(),
    };
    
    setState("rulesFiles", files => [...files, newFile]);
    return path;
  };

  const deleteRulesFile = async (path: string): Promise<void> => {
    setState("rulesFiles", files => files.filter(f => f.path !== path));
    
    try {
      await invoke("rules_delete_file", { path });
    } catch (e) {
      console.warn("Failed to delete rules file from disk:", e);
    }
  };

  const validateRule = (rule: Partial<Rule>): string[] => {
    const errors: string[] = [];
    
    if (!rule.name?.trim()) {
      errors.push("Rule name is required");
    }
    
    if (!rule.content?.trim()) {
      errors.push("Rule content is required");
    }
    
    if (rule.priority !== undefined && (rule.priority < 0 || rule.priority > 100)) {
      errors.push("Priority must be between 0 and 100");
    }
    
    return errors;
  };

  const formatRuleContent = (content: string): string => {
    // Basic formatting - trim whitespace and normalize line endings
    return content.trim().replace(/\r\n/g, "\n");
  };

  return (
    <RulesLibraryContext.Provider
      value={{
        state,
        loadRules,
        scanProjectRules,
        getAllRules,
        getEnabledRules,
        getRuleById,
        getRulesBySource,
        getRulesByTag,
        createRule,
        updateRule,
        deleteRule,
        duplicateRule,
        toggleRule,
        enableRule,
        disableRule,
        enableAllRules,
        disableAllRules,
        setRulePriority,
        moveRuleUp,
        moveRuleDown,
        createComposition,
        updateComposition,
        deleteComposition,
        getComposedRules,
        setInheritance,
        getInheritedRules,
        previewRules,
        getActiveRulesContext,
        estimateTokenCount,
        openPanel,
        closePanel,
        editRule,
        createNewRule,
        closeEditor,
        selectRule,
        setSearchQuery,
        setFilterTags,
        setFilterSource,
        getFilteredRules,
        getAllTags,
        importRulesFile,
        exportRulesFile,
        createRulesFile,
        deleteRulesFile,
        validateRule,
        formatRuleContent,
      }}
    >
      {props.children}
    </RulesLibraryContext.Provider>
  );
}

export function useRulesLibrary() {
  const context = useContext(RulesLibraryContext);
  if (!context) {
    throw new Error("useRulesLibrary must be used within RulesLibraryProvider");
  }
  return context;
}
