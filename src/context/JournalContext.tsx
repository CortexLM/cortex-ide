import { createContext, useContext, ParentProps, onMount, onCleanup, createEffect } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { useCommands } from "./CommandContext";
import { fsCreateDirectory } from "../utils/tauri-api";

export type HourFormat = "12h" | "24h";

export interface JournalEntry {
  id: string;
  path: string;
  date: Date;
  year: number;
  month: number;
  day: number;
  content: string;
  modified: boolean;
  lastModified?: Date;
}

export interface JournalTemplate {
  id: string;
  name: string;
  content: string;
  isDefault?: boolean;
}

export interface JournalSettings {
  basePath: string;
  hourFormat: HourFormat;
  defaultTemplate: string | null;
  autoSave: boolean;
  autoSaveInterval: number;
}

interface JournalState {
  entries: JournalEntry[];
  currentEntry: JournalEntry | null;
  selectedDate: Date;
  templates: JournalTemplate[];
  settings: JournalSettings;
  searchQuery: string;
  searchResults: JournalEntry[];
  isSearching: boolean;
  isLoading: boolean;
  showJournalPanel: boolean;
  entriesIndex: Map<string, { path: string; date: Date }>;
}

interface JournalContextValue {
  state: JournalState;
  openTodayEntry: () => Promise<void>;
  openEntry: (date: Date) => Promise<void>;
  createEntry: (date: Date, templateId?: string) => Promise<JournalEntry>;
  saveEntry: (entry: JournalEntry) => Promise<void>;
  updateEntryContent: (content: string) => void;
  deleteEntry: (entry: JournalEntry) => Promise<void>;
  searchEntries: (query: string) => Promise<void>;
  clearSearch: () => void;
  setSelectedDate: (date: Date) => void;
  navigateMonth: (delta: number) => void;
  navigateYear: (delta: number) => void;
  goToToday: () => void;
  addTemplate: (template: Omit<JournalTemplate, "id">) => void;
  removeTemplate: (id: string) => void;
  updateSettings: (settings: Partial<JournalSettings>) => void;
  getEntriesForMonth: (year: number, month: number) => Promise<Date[]>;
  hasEntryForDate: (date: Date) => boolean;
  setShowJournalPanel: (show: boolean) => void;
  formatTime: (date: Date) => string;
  getEntryPath: (date: Date) => string;
}

const JournalContext = createContext<JournalContextValue>();

const DEFAULT_TEMPLATES: JournalTemplate[] = [
  {
    id: "daily",
    name: "Daily Journal",
    content: `## Goals for Today

- [ ] 

## Notes

## End of Day Review

### What went well?

### What could be improved?

`,
    isDefault: true,
  },
  {
    id: "meeting",
    name: "Meeting Notes",
    content: `## Meeting Notes

**Date:** {{date}}
**Time:** {{time}}
**Attendees:**

---

### Agenda

1. 

### Discussion Points

### Action Items

- [ ] 

### Follow-up

`,
  },
  {
    id: "standup",
    name: "Standup",
    content: `## Daily Standup - {{date}}

### Yesterday
- 

### Today
- 

### Blockers
- None

`,
  },
  {
    id: "blank",
    name: "Blank",
    content: "",
  },
];

const DEFAULT_SETTINGS: JournalSettings = {
  basePath: "~/.cortex/journal",
  hourFormat: "12h",
  defaultTemplate: "daily",
  autoSave: true,
  autoSaveInterval: 30000,
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatDateForPath(date: Date): { year: string; month: string; day: string } {
  return {
    year: date.getFullYear().toString(),
    month: String(date.getMonth() + 1).padStart(2, "0"),
    day: String(date.getDate()).padStart(2, "0"),
  };
}

function getDateKey(date: Date): string {
  const { year, month, day } = formatDateForPath(date);
  return `${year}-${month}-${day}`;
}

function expandPath(path: string): string {
  // The server will handle ~ expansion, so we just return the path as-is
  // The backend API understands ~ as home directory
  return path;
}

export function JournalProvider(props: ParentProps) {
  let autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  
  const [state, setState] = createStore<JournalState>({
    entries: [],
    currentEntry: null,
    selectedDate: new Date(),
    templates: [...DEFAULT_TEMPLATES],
    settings: { ...DEFAULT_SETTINGS },
    searchQuery: "",
    searchResults: [],
    isSearching: false,
    isLoading: false,
    showJournalPanel: false,
    entriesIndex: new Map(),
  });

  const getEntryPath = (date: Date): string => {
    const { year, month, day } = formatDateForPath(date);
    const basePath = expandPath(state.settings.basePath);
    return `${basePath}/${year}/${month}/${day}.md`;
  };

  const formatTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    if (state.settings.hourFormat === "24h") {
      return `${hours}:${String(minutes).padStart(2, "0")}`;
    }
    
    const hour12 = hours % 12 || 12;
    const ampm = hours < 12 ? "AM" : "PM";
    return `${hour12}:${String(minutes).padStart(2, "0")} ${ampm}`;
  };

  const formatDateForTemplate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const processTemplate = (template: JournalTemplate, date: Date): string => {
    let content = template.content;
    const now = new Date();
    
    content = content.replace(/\{\{date\}\}/g, formatDateForTemplate(date));
    content = content.replace(/\{\{time\}\}/g, formatTime(now));
    content = content.replace(/\{\{year\}\}/g, date.getFullYear().toString());
    content = content.replace(/\{\{month\}\}/g, String(date.getMonth() + 1).padStart(2, "0"));
    content = content.replace(/\{\{day\}\}/g, String(date.getDate()).padStart(2, "0"));
    
    return content;
  };

  const createTimeHeading = (date: Date): string => {
    return `# ${formatTime(date)}`;
  };

  const readFile = async (path: string): Promise<string | null> => {
    try {
      const content = await invoke<string>("fs_read_file", { path });
      return content;
    } catch (err) {
      console.debug("[Journal] Read file failed:", err);
      return null;
    }
  };

  const writeFile = async (path: string, content: string): Promise<boolean> => {
    try {
      await invoke("fs_write_file", { path, content });
      return true;
    } catch (err) {
      console.debug("[Journal] Write file failed:", err);
      return false;
    }
  };

  const deleteFile = async (path: string): Promise<boolean> => {
    try {
      await invoke("fs_delete_file", { path });
      return true;
    } catch (err) {
      console.debug("[Journal] Delete file failed:", err);
      return false;
    }
  };

  const listDirectory = async (path: string): Promise<string[]> => {
    try {
      const entries = await invoke<Array<{ name: string; path: string }>>("fs_list_directory", { path });
      return entries.map(e => e.name);
    } catch (err) {
      console.debug("[Journal] List directory failed:", err);
      return [];
    }
  };

  const ensureDirectoryExists = async (path: string): Promise<boolean> => {
    try {
      await fsCreateDirectory(path);
      return true;
    } catch (err) {
      console.debug("[Journal] Create directory failed:", err);
      return false;
    }
  };

  const createEntry = async (date: Date, templateId?: string): Promise<JournalEntry> => {
    const path = getEntryPath(date);
    const { year, month, day } = formatDateForPath(date);
    
    const dirPath = path.substring(0, path.lastIndexOf("/"));
    await ensureDirectoryExists(dirPath);
    
    let content = "";
    const template = state.templates.find(
      (t) => t.id === (templateId || state.settings.defaultTemplate)
    );
    
    if (template) {
      content = processTemplate(template, date);
    }
    
    content = `${createTimeHeading(new Date())}\n\n${content}`;
    
    await writeFile(path, content);
    
    const entry: JournalEntry = {
      id: generateId(),
      path,
      date,
      year: parseInt(year),
      month: parseInt(month),
      day: parseInt(day),
      content,
      modified: false,
      lastModified: new Date(),
    };
    
    setState("entries", (entries) => [...entries, entry]);
    setState("entriesIndex", (index) => {
      const newIndex = new Map(index);
      newIndex.set(getDateKey(date), { path, date });
      return newIndex;
    });
    
    return entry;
  };

  const openEntry = async (date: Date): Promise<void> => {
    setState("isLoading", true);
    
    try {
      const path = getEntryPath(date);
      const { year, month, day } = formatDateForPath(date);
      
      const existingEntry = state.entries.find((e) => e.path === path);
      if (existingEntry) {
        setState("currentEntry", existingEntry);
        setState("selectedDate", date);
        setState("isLoading", false);
        return;
      }
      
      const content = await readFile(path);
      
      if (content !== null) {
        const entry: JournalEntry = {
          id: generateId(),
          path,
          date,
          year: parseInt(year),
          month: parseInt(month),
          day: parseInt(day),
          content,
          modified: false,
        };
        
        setState("entries", (entries) => [...entries, entry]);
        setState("currentEntry", entry);
        setState("entriesIndex", (index) => {
          const newIndex = new Map(index);
          newIndex.set(getDateKey(date), { path, date });
          return newIndex;
        });
      } else {
        const entry = await createEntry(date);
        setState("currentEntry", entry);
      }
      
      setState("selectedDate", date);
    } finally {
      setState("isLoading", false);
    }
  };

  const openTodayEntry = async (): Promise<void> => {
    await openEntry(new Date());
    setState("showJournalPanel", true);
  };

  const saveEntry = async (entry: JournalEntry): Promise<void> => {
    const success = await writeFile(entry.path, entry.content);
    
    if (success) {
      setState(
        "entries",
        (e) => e.id === entry.id,
        produce((e) => {
          e.modified = false;
          e.lastModified = new Date();
        })
      );
      
      if (state.currentEntry?.id === entry.id) {
        setState("currentEntry", produce((e) => {
          if (e) {
            e.modified = false;
            e.lastModified = new Date();
          }
        }));
      }
    }
  };

  const updateEntryContent = (content: string): void => {
    if (!state.currentEntry) return;
    
    const entryId = state.currentEntry.id;
    
    setState(
      "entries",
      (e) => e.id === entryId,
      "content",
      content
    );
    setState(
      "entries",
      (e) => e.id === entryId,
      "modified",
      true
    );
    setState("currentEntry", produce((e) => {
      if (e) {
        e.content = content;
        e.modified = true;
      }
    }));
  };

  const deleteEntry = async (entry: JournalEntry): Promise<void> => {
    const success = await deleteFile(entry.path);
    
    if (success) {
      setState("entries", (entries) => entries.filter((e) => e.id !== entry.id));
      setState("entriesIndex", (index) => {
        const newIndex = new Map(index);
        newIndex.delete(getDateKey(entry.date));
        return newIndex;
      });
      
      if (state.currentEntry?.id === entry.id) {
        setState("currentEntry", null);
      }
    }
  };

  const searchEntries = async (query: string): Promise<void> => {
    if (!query.trim()) {
      clearSearch();
      return;
    }
    
    setState("searchQuery", query);
    setState("isSearching", true);
    
    try {
      const basePath = expandPath(state.settings.basePath);
      const years = await listDirectory(basePath);
      const results: JournalEntry[] = [];
      const queryLower = query.toLowerCase();
      
      for (const year of years) {
        if (!/^\d{4}$/.test(year)) continue;
        
        const months = await listDirectory(`${basePath}/${year}`);
        
        for (const month of months) {
          if (!/^\d{2}$/.test(month)) continue;
          
          const days = await listDirectory(`${basePath}/${year}/${month}`);
          
          for (const dayFile of days) {
            if (!dayFile.endsWith(".md")) continue;
            
            const day = dayFile.replace(".md", "");
            const path = `${basePath}/${year}/${month}/${dayFile}`;
            const content = await readFile(path);
            
            if (content && content.toLowerCase().includes(queryLower)) {
              const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              
              results.push({
                id: generateId(),
                path,
                date,
                year: parseInt(year),
                month: parseInt(month),
                day: parseInt(day),
                content,
                modified: false,
              });
            }
          }
        }
      }
      
      results.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      setState("searchResults", results);
    } finally {
      setState("isSearching", false);
    }
  };

  const clearSearch = (): void => {
    setState("searchQuery", "");
    setState("searchResults", []);
    setState("isSearching", false);
  };

  const setSelectedDate = (date: Date): void => {
    setState("selectedDate", date);
  };

  const navigateMonth = (delta: number): void => {
    setState("selectedDate", (current) => {
      const newDate = new Date(current);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  const navigateYear = (delta: number): void => {
    setState("selectedDate", (current) => {
      const newDate = new Date(current);
      newDate.setFullYear(newDate.getFullYear() + delta);
      return newDate;
    });
  };

  const goToToday = (): void => {
    setState("selectedDate", new Date());
  };

  const addTemplate = (template: Omit<JournalTemplate, "id">): void => {
    const newTemplate: JournalTemplate = {
      ...template,
      id: generateId(),
    };
    setState("templates", (templates) => [...templates, newTemplate]);
    saveSettingsToStorage();
  };

  const removeTemplate = (id: string): void => {
    const template = state.templates.find((t) => t.id === id);
    if (template?.isDefault) return;
    
    setState("templates", (templates) => templates.filter((t) => t.id !== id));
    saveSettingsToStorage();
  };

  const updateSettings = (settings: Partial<JournalSettings>): void => {
    setState("settings", (current) => ({ ...current, ...settings }));
    saveSettingsToStorage();
    setupAutoSave();
  };

  const getEntriesForMonth = async (year: number, month: number): Promise<Date[]> => {
    const basePath = expandPath(state.settings.basePath);
    const monthPath = `${basePath}/${year}/${String(month).padStart(2, "0")}`;
    
    const days = await listDirectory(monthPath);
    const dates: Date[] = [];
    
    for (const dayFile of days) {
      if (!dayFile.endsWith(".md")) continue;
      const day = parseInt(dayFile.replace(".md", ""));
      if (!isNaN(day)) {
        dates.push(new Date(year, month - 1, day));
      }
    }
    
    return dates;
  };

  const hasEntryForDate = (date: Date): boolean => {
    return state.entriesIndex.has(getDateKey(date));
  };

  const setShowJournalPanel = (show: boolean): void => {
    setState("showJournalPanel", show);
  };

  const loadSettingsFromStorage = (): void => {
    try {
      const stored = localStorage.getItem("cortex-journal-settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        setState("settings", (current) => ({ ...current, ...parsed.settings }));
        if (parsed.templates) {
          setState("templates", [...DEFAULT_TEMPLATES, ...parsed.templates.filter(
            (t: JournalTemplate) => !DEFAULT_TEMPLATES.some((dt) => dt.id === t.id)
          )]);
        }
      }
    } catch (err) {
      console.debug("[Journal] Failed to load settings from storage:", err);
    }
  };

  const saveSettingsToStorage = (): void => {
    try {
      const customTemplates = state.templates.filter((t) => !t.isDefault);
      localStorage.setItem("cortex-journal-settings", JSON.stringify({
        settings: state.settings,
        templates: customTemplates,
      }));
    } catch (err) {
      console.debug("[Journal] Failed to save settings to storage:", err);
    }
  };

  const setupAutoSave = (): void => {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
    
    if (state.settings.autoSave && state.settings.autoSaveInterval > 0) {
      autoSaveTimer = setInterval(() => {
        if (state.currentEntry?.modified) {
          saveEntry(state.currentEntry);
        }
      }, state.settings.autoSaveInterval);
    }
  };

  onMount(() => {
    loadSettingsFromStorage();
    setupAutoSave();
    
    onCleanup(() => {
      if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
      }
    });
  });

  createEffect(() => {
    const commands = useCommands();
    
    commands.registerCommand({
      id: "journal-open-today",
      label: "Journal: Open Today's Entry",
      shortcut: "Ctrl+Alt+J",
      category: "Journal",
      action: openTodayEntry,
    });
    
    commands.registerCommand({
      id: "journal-new-entry",
      label: "Journal: New Entry",
      category: "Journal",
      action: () => {
        setShowJournalPanel(true);
        openEntry(new Date());
      },
    });
    
    commands.registerCommand({
      id: "journal-search",
      label: "Journal: Search Entries",
      category: "Journal",
      action: () => {
        setShowJournalPanel(true);
      },
    });
    
    commands.registerCommand({
      id: "journal-show-calendar",
      label: "Journal: Show Calendar",
      category: "Journal",
      action: () => {
        setShowJournalPanel(true);
      },
    });
  });

  const value: JournalContextValue = {
    state,
    openTodayEntry,
    openEntry,
    createEntry,
    saveEntry,
    updateEntryContent,
    deleteEntry,
    searchEntries,
    clearSearch,
    setSelectedDate,
    navigateMonth,
    navigateYear,
    goToToday,
    addTemplate,
    removeTemplate,
    updateSettings,
    getEntriesForMonth,
    hasEntryForDate,
    setShowJournalPanel,
    formatTime,
    getEntryPath,
  };

  return (
    <JournalContext.Provider value={value}>
      {props.children}
    </JournalContext.Provider>
  );
}

export function useJournal() {
  const context = useContext(JournalContext);
  if (!context) {
    throw new Error("useJournal must be used within JournalProvider");
  }
  return context;
}
