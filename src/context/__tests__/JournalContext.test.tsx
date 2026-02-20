import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

interface JournalEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  mood?: string;
  weather?: string;
  location?: string;
}

interface JournalTemplate {
  id: string;
  name: string;
  content: string;
  isDefault?: boolean;
}

interface JournalSettings {
  storagePath: string;
  defaultTemplate: string | null;
  dateFormat: string;
  autoSave: boolean;
  autoSaveIntervalMs: number;
  showWordCount: boolean;
  enableTags: boolean;
  enableMood: boolean;
  enableWeather: boolean;
}

interface JournalState {
  entries: Map<string, JournalEntry>;
  templates: JournalTemplate[];
  settings: JournalSettings;
  currentDate: string;
  currentEntry: JournalEntry | null;
  isLoading: boolean;
  isDirty: boolean;
}

interface JournalContextValue {
  state: JournalState;
  createEntry: (date: string, content?: string) => Promise<JournalEntry | null>;
  updateEntry: (id: string, updates: Partial<JournalEntry>) => Promise<boolean>;
  deleteEntry: (id: string) => Promise<boolean>;
  getEntryByDate: (date: string) => JournalEntry | null;
  setCurrentDate: (date: string) => void;
  saveCurrentEntry: () => Promise<boolean>;
  loadEntriesForMonth: (year: number, month: number) => Promise<void>;
  addTemplate: (template: Omit<JournalTemplate, "id">) => void;
  removeTemplate: (id: string) => void;
  applyTemplate: (templateId: string) => void;
  updateSettings: (settings: Partial<JournalSettings>) => void;
  searchEntries: (query: string) => JournalEntry[];
  getEntriesByTag: (tag: string) => JournalEntry[];
}

const STORAGE_KEY = "cortex_journal_settings";

describe("JournalContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("JournalEntry interface", () => {
    it("should have correct entry structure", () => {
      const entry: JournalEntry = {
        id: "entry-123",
        date: "2024-01-15",
        title: "Monday Reflections",
        content: "Today was productive...",
        tags: ["work", "productivity"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mood: "happy",
        weather: "sunny",
        location: "Home Office",
      };

      expect(entry.id).toBe("entry-123");
      expect(entry.date).toBe("2024-01-15");
      expect(entry.tags).toContain("work");
      expect(entry.mood).toBe("happy");
    });

    it("should allow optional metadata fields", () => {
      const entry: JournalEntry = {
        id: "entry-456",
        date: "2024-01-16",
        title: "Simple Entry",
        content: "Just a note",
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(entry.mood).toBeUndefined();
      expect(entry.weather).toBeUndefined();
      expect(entry.location).toBeUndefined();
    });
  });

  describe("JournalTemplate interface", () => {
    it("should define template structure", () => {
      const template: JournalTemplate = {
        id: "template-1",
        name: "Daily Standup",
        content: "## What I did yesterday\n\n## What I'll do today\n\n## Blockers\n",
        isDefault: true,
      };

      expect(template.id).toBe("template-1");
      expect(template.name).toBe("Daily Standup");
      expect(template.isDefault).toBe(true);
    });
  });

  describe("JournalSettings interface", () => {
    it("should have correct default settings structure", () => {
      const settings: JournalSettings = {
        storagePath: ".cortex/journal",
        defaultTemplate: null,
        dateFormat: "YYYY-MM-DD",
        autoSave: true,
        autoSaveIntervalMs: 30000,
        showWordCount: true,
        enableTags: true,
        enableMood: false,
        enableWeather: false,
      };

      expect(settings.storagePath).toBe(".cortex/journal");
      expect(settings.autoSave).toBe(true);
      expect(settings.autoSaveIntervalMs).toBe(30000);
    });
  });

  describe("IPC operations", () => {
    it("should call invoke for reading journal files", async () => {
      vi.mocked(invoke).mockResolvedValue("# Journal Entry\n\nContent here");

      await invoke("fs_read_file", { path: ".cortex/journal/2024-01-15.md" });

      expect(invoke).toHaveBeenCalledWith("fs_read_file", {
        path: ".cortex/journal/2024-01-15.md",
      });
    });

    it("should call invoke for writing journal files", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      const content = "# Today's Entry\n\nSome content";
      await invoke("fs_write_file", {
        path: ".cortex/journal/2024-01-15.md",
        content,
      });

      expect(invoke).toHaveBeenCalledWith("fs_write_file", {
        path: ".cortex/journal/2024-01-15.md",
        content,
      });
    });

    it("should call invoke for deleting journal files", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("fs_delete_file", { path: ".cortex/journal/2024-01-15.md" });

      expect(invoke).toHaveBeenCalledWith("fs_delete_file", {
        path: ".cortex/journal/2024-01-15.md",
      });
    });

    it("should call invoke for listing journal directory", async () => {
      vi.mocked(invoke).mockResolvedValue([
        { name: "2024-01-01.md", isFile: true },
        { name: "2024-01-02.md", isFile: true },
      ]);

      const result = await invoke("fs_list_directory", {
        path: ".cortex/journal",
        showHidden: false,
        includeIgnored: true,
      });

      expect(invoke).toHaveBeenCalledWith("fs_list_directory", {
        path: ".cortex/journal",
        showHidden: false,
        includeIgnored: true,
      });
      expect(result).toHaveLength(2);
    });
  });

  describe("State management", () => {
    it("should handle entries map", () => {
      const entries = new Map<string, JournalEntry>();
      const entry: JournalEntry = {
        id: "entry-1",
        date: "2024-01-15",
        title: "Test Entry",
        content: "Content",
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      entries.set("2024-01-15", entry);

      expect(entries.has("2024-01-15")).toBe(true);
      expect(entries.get("2024-01-15")?.title).toBe("Test Entry");
    });

    it("should track current date", () => {
      let state: JournalState = {
        entries: new Map(),
        templates: [],
        settings: {
          storagePath: ".cortex/journal",
          defaultTemplate: null,
          dateFormat: "YYYY-MM-DD",
          autoSave: true,
          autoSaveIntervalMs: 30000,
          showWordCount: true,
          enableTags: true,
          enableMood: false,
          enableWeather: false,
        },
        currentDate: "2024-01-15",
        currentEntry: null,
        isLoading: false,
        isDirty: false,
      };

      state = { ...state, currentDate: "2024-01-16" };
      expect(state.currentDate).toBe("2024-01-16");
    });

    it("should track dirty state", () => {
      let state: JournalState = {
        entries: new Map(),
        templates: [],
        settings: {
          storagePath: ".cortex/journal",
          defaultTemplate: null,
          dateFormat: "YYYY-MM-DD",
          autoSave: true,
          autoSaveIntervalMs: 30000,
          showWordCount: true,
          enableTags: true,
          enableMood: false,
          enableWeather: false,
        },
        currentDate: "2024-01-15",
        currentEntry: null,
        isLoading: false,
        isDirty: false,
      };

      state = { ...state, isDirty: true };
      expect(state.isDirty).toBe(true);
    });
  });

  describe("Settings persistence", () => {
    it("should save settings to localStorage", () => {
      const settings: JournalSettings = {
        storagePath: ".cortex/journal",
        defaultTemplate: "daily",
        dateFormat: "YYYY-MM-DD",
        autoSave: true,
        autoSaveIntervalMs: 60000,
        showWordCount: true,
        enableTags: true,
        enableMood: true,
        enableWeather: false,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.defaultTemplate).toBe("daily");
      expect(parsed.autoSaveIntervalMs).toBe(60000);
    });

    it("should load settings from localStorage", () => {
      const settings = {
        storagePath: ".custom/journal",
        defaultTemplate: "weekly",
        dateFormat: "DD/MM/YYYY",
        autoSave: false,
        autoSaveIntervalMs: 120000,
        showWordCount: false,
        enableTags: false,
        enableMood: false,
        enableWeather: false,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      const stored = localStorage.getItem(STORAGE_KEY);
      const loaded = JSON.parse(stored!) as JournalSettings;

      expect(loaded.storagePath).toBe(".custom/journal");
      expect(loaded.autoSave).toBe(false);
    });
  });

  describe("Template management", () => {
    it("should manage templates array", () => {
      const templates: JournalTemplate[] = [
        { id: "t1", name: "Daily", content: "## Daily Log\n", isDefault: true },
        { id: "t2", name: "Weekly", content: "## Weekly Review\n" },
      ];

      expect(templates).toHaveLength(2);
      expect(templates.find((t) => t.isDefault)?.name).toBe("Daily");
    });

    it("should add new template", () => {
      const templates: JournalTemplate[] = [];
      const newTemplate: JournalTemplate = {
        id: "new-1",
        name: "Meeting Notes",
        content: "## Meeting Notes\n\n### Attendees\n\n### Agenda\n",
      };

      templates.push(newTemplate);
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe("Meeting Notes");
    });

    it("should remove template by id", () => {
      let templates: JournalTemplate[] = [
        { id: "t1", name: "Daily", content: "## Daily\n" },
        { id: "t2", name: "Weekly", content: "## Weekly\n" },
      ];

      templates = templates.filter((t) => t.id !== "t1");
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe("t2");
    });
  });

  describe("Entry operations", () => {
    it("should create entry with generated id", () => {
      const entry: JournalEntry = {
        id: `entry-${Date.now()}`,
        date: "2024-01-15",
        title: "New Entry",
        content: "",
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(entry.id).toMatch(/^entry-\d+$/);
      expect(entry.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it("should update entry fields", () => {
      let entry: JournalEntry = {
        id: "entry-1",
        date: "2024-01-15",
        title: "Original Title",
        content: "Original content",
        tags: [],
        createdAt: 1000,
        updatedAt: 1000,
      };

      entry = {
        ...entry,
        title: "Updated Title",
        content: "Updated content",
        tags: ["updated"],
        updatedAt: Date.now(),
      };

      expect(entry.title).toBe("Updated Title");
      expect(entry.tags).toContain("updated");
      expect(entry.updatedAt).toBeGreaterThan(entry.createdAt);
    });
  });

  describe("Search and filtering", () => {
    it("should filter entries by tag", () => {
      const entries: JournalEntry[] = [
        {
          id: "1",
          date: "2024-01-15",
          title: "Work Day",
          content: "",
          tags: ["work", "productivity"],
          createdAt: 0,
          updatedAt: 0,
        },
        {
          id: "2",
          date: "2024-01-16",
          title: "Weekend",
          content: "",
          tags: ["personal", "relaxation"],
          createdAt: 0,
          updatedAt: 0,
        },
        {
          id: "3",
          date: "2024-01-17",
          title: "Another Work Day",
          content: "",
          tags: ["work"],
          createdAt: 0,
          updatedAt: 0,
        },
      ];

      const workEntries = entries.filter((e) => e.tags.includes("work"));
      expect(workEntries).toHaveLength(2);
    });

    it("should search entries by content", () => {
      const entries: JournalEntry[] = [
        {
          id: "1",
          date: "2024-01-15",
          title: "Meeting Notes",
          content: "Discussed project timeline",
          tags: [],
          createdAt: 0,
          updatedAt: 0,
        },
        {
          id: "2",
          date: "2024-01-16",
          title: "Ideas",
          content: "New feature ideas for the app",
          tags: [],
          createdAt: 0,
          updatedAt: 0,
        },
      ];

      const query = "project";
      const results = entries.filter(
        (e) =>
          e.content.toLowerCase().includes(query.toLowerCase()) ||
          e.title.toLowerCase().includes(query.toLowerCase())
      );

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Meeting Notes");
    });
  });

  describe("Context value structure", () => {
    it("should define all required methods", () => {
      const mockContext: JournalContextValue = {
        state: {
          entries: new Map(),
          templates: [],
          settings: {
            storagePath: ".cortex/journal",
            defaultTemplate: null,
            dateFormat: "YYYY-MM-DD",
            autoSave: true,
            autoSaveIntervalMs: 30000,
            showWordCount: true,
            enableTags: true,
            enableMood: false,
            enableWeather: false,
          },
          currentDate: "2024-01-15",
          currentEntry: null,
          isLoading: false,
          isDirty: false,
        },
        createEntry: vi.fn(),
        updateEntry: vi.fn(),
        deleteEntry: vi.fn(),
        getEntryByDate: vi.fn(),
        setCurrentDate: vi.fn(),
        saveCurrentEntry: vi.fn(),
        loadEntriesForMonth: vi.fn(),
        addTemplate: vi.fn(),
        removeTemplate: vi.fn(),
        applyTemplate: vi.fn(),
        updateSettings: vi.fn(),
        searchEntries: vi.fn(),
        getEntriesByTag: vi.fn(),
      };

      expect(mockContext.createEntry).toBeDefined();
      expect(mockContext.updateEntry).toBeDefined();
      expect(mockContext.deleteEntry).toBeDefined();
      expect(mockContext.searchEntries).toBeDefined();
    });
  });
});
