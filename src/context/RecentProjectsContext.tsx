import { createContext, useContext, createSignal, onMount, onCleanup, ParentProps } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useNavigate } from "@solidjs/router";
import { invoke } from "@tauri-apps/api/core";
import { getWindowLabel } from "@/utils/windowStorage";
import { showErrorNotification } from "@/utils/notifications";
import { safeJsonParse } from "@/utils/json";

export interface RecentProject {
  id: string;
  path: string;
  name: string;
  lastOpened: number;
  pinned: boolean;
  icon?: string;
}

interface RecentProjectsState {
  projects: RecentProject[];
  searchQuery: string;
}

interface RecentProjectsContextValue {
  state: RecentProjectsState;
  projects: () => RecentProject[];
  pinnedProjects: () => RecentProject[];
  unpinnedProjects: () => RecentProject[];
  filteredProjects: () => RecentProject[];
  searchQuery: () => string;
  setSearchQuery: (query: string) => void;
  addProject: (path: string) => void;
  removeProject: (id: string) => void;
  clearAllProjects: () => void;
  togglePin: (id: string) => void;
  openProject: (project: RecentProject, newWindow?: boolean) => void;
  openProjectByPath: (path: string, newWindow?: boolean) => void;
  getProjectByPath: (path: string) => RecentProject | undefined;
  showRecentProjects: () => boolean;
  setShowRecentProjects: (show: boolean) => void;
}

const STORAGE_KEY = "cortex_recent_projects_v2";
const MAX_RECENT_PROJECTS = 50;

const RecentProjectsContext = createContext<RecentProjectsContextValue>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function extractProjectName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

function detectProjectIcon(_path: string): string {
  return "folder";
}

function loadFromStorage(): RecentProject[] {
  if (typeof localStorage === "undefined") return [];
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = safeJsonParse<unknown>(stored, null);
    if (Array.isArray(parsed)) {
      return parsed.map((p: Partial<RecentProject> & { path: string }) => ({
        id: p.id || generateId(),
        path: p.path,
        name: p.name || extractProjectName(p.path),
        lastOpened: p.lastOpened || Date.now(),
        pinned: p.pinned || false,
        icon: p.icon || detectProjectIcon(p.path),
      }));
    }
  }
  
  // Try loading from old format
  const oldStored = localStorage.getItem("cortex_recent_projects");
  if (oldStored) {
    const paths = safeJsonParse<string[]>(oldStored, []);
    if (paths.length > 0) {
      return paths.map((path, index) => ({
        id: generateId(),
        path,
        name: extractProjectName(path),
        lastOpened: Date.now() - index * 1000,
        pinned: false,
        icon: detectProjectIcon(path),
      }));
    }
  }
  
  return [];
}

function saveToStorage(projects: RecentProject[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    
    const pathsOnly = projects.map((p) => p.path);
    localStorage.setItem("cortex_recent_projects", JSON.stringify(pathsOnly));
  } catch (e) {
    console.error("Failed to save recent projects:", e);
  }
}

export function RecentProjectsProvider(props: ParentProps) {
  const navigate = useNavigate();
  
  const [state, setState] = createStore<RecentProjectsState>({
    projects: [],
    searchQuery: "",
  });
  
  const [showRecentProjects, setShowRecentProjects] = createSignal(false);

  onMount(() => {
    const loaded = loadFromStorage();
    setState("projects", loaded);
    
    // Listen for the recent-projects:open event from keyboard shortcuts
    const handleOpenEvent = () => {
      setShowRecentProjects(true);
    };
    
    window.addEventListener("recent-projects:open", handleOpenEvent);
    onCleanup(() => window.removeEventListener("recent-projects:open", handleOpenEvent));
  });

  const projects = () => state.projects;

  const pinnedProjects = () => {
    return state.projects
      .filter((p) => p.pinned)
      .sort((a, b) => b.lastOpened - a.lastOpened);
  };

  const unpinnedProjects = () => {
    return state.projects
      .filter((p) => !p.pinned)
      .sort((a, b) => b.lastOpened - a.lastOpened);
  };

  const filteredProjects = () => {
    const query = state.searchQuery.toLowerCase().trim();
    if (!query) {
      return [...pinnedProjects(), ...unpinnedProjects()];
    }
    
    return state.projects
      .filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(query);
        const pathMatch = p.path.toLowerCase().includes(query);
        return nameMatch || pathMatch;
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.lastOpened - a.lastOpened;
      });
  };

  const searchQuery = () => state.searchQuery;

  const setSearchQuery = (query: string) => {
    setState("searchQuery", query);
  };

  const addProject = (path: string) => {
    const normalizedPath = path.replace(/\\/g, "/");
    
    setState(
      produce((s) => {
        const existingIndex = s.projects.findIndex(
          (p) => p.path.replace(/\\/g, "/") === normalizedPath
        );
        
        if (existingIndex !== -1) {
          s.projects[existingIndex].lastOpened = Date.now();
        } else {
          const newProject: RecentProject = {
            id: generateId(),
            path,
            name: extractProjectName(path),
            lastOpened: Date.now(),
            pinned: false,
            icon: detectProjectIcon(path),
          };
          s.projects.unshift(newProject);
          
          if (s.projects.length > MAX_RECENT_PROJECTS) {
            const unpinned = s.projects.filter((p) => !p.pinned);
            if (unpinned.length > MAX_RECENT_PROJECTS - 10) {
              const toRemove = unpinned.slice(MAX_RECENT_PROJECTS - 10);
              const removeIds = new Set(toRemove.map((p) => p.id));
              s.projects = s.projects.filter((p) => !removeIds.has(p.id));
            }
          }
        }
      })
    );
    
    saveToStorage(state.projects);
  };

  const removeProject = (id: string) => {
    setState("projects", (projects) => projects.filter((p) => p.id !== id));
    saveToStorage(state.projects);
  };

  const clearAllProjects = () => {
    setState("projects", (projects) => projects.filter((p) => p.pinned));
    saveToStorage(state.projects);
  };

  const togglePin = (id: string) => {
    setState(
      "projects",
      (p) => p.id === id,
      "pinned",
      (pinned) => !pinned
    );
    saveToStorage(state.projects);
  };

  const openProject = (project: RecentProject, newWindow: boolean = false) => {
    addProject(project.path);
    
    if (newWindow) {
      invoke("create_new_window", { path: project.path }).catch((err) => {
        showErrorNotification('Failed to open project', `Could not open ${project.name}: ${err}`);
      });
    } else {
      const label = getWindowLabel();
      localStorage.setItem(`cortex_current_project_${label}`, project.path);
      if (label === "main") localStorage.setItem("cortex_current_project", project.path);
      
      // Notify WorkspaceContext
      window.dispatchEvent(new CustomEvent("workspace:open-folder", { 
        detail: { path: project.path } 
      }));
      
      window.dispatchEvent(new CustomEvent("folder:did-open"));
      localStorage.setItem("figma_layout_mode", "ide");
      
      navigate("/session");
    }
    
    setShowRecentProjects(false);
  };

  const openProjectByPath = (path: string, newWindow: boolean = false) => {
    addProject(path);
    
    if (newWindow) {
      invoke("create_new_window", { path }).catch((err) => {
        showErrorNotification('Failed to open project', `Could not open project at ${path}: ${err}`);
      });
    } else {
      const label = getWindowLabel();
      localStorage.setItem(`cortex_current_project_${label}`, path);
      if (label === "main") localStorage.setItem("cortex_current_project", path);
      
      // Notify WorkspaceContext
      window.dispatchEvent(new CustomEvent("workspace:open-folder", { 
        detail: { path } 
      }));
      
      window.dispatchEvent(new CustomEvent("folder:did-open"));
      localStorage.setItem("figma_layout_mode", "ide");
      
      navigate("/session");
    }
    
    setShowRecentProjects(false);
  };

  const getProjectByPath = (path: string): RecentProject | undefined => {
    const normalizedPath = path.replace(/\\/g, "/");
    return state.projects.find(
      (p) => p.path.replace(/\\/g, "/") === normalizedPath
    );
  };

  const value: RecentProjectsContextValue = {
    state,
    projects,
    pinnedProjects,
    unpinnedProjects,
    filteredProjects,
    searchQuery,
    setSearchQuery,
    addProject,
    removeProject,
    clearAllProjects,
    togglePin,
    openProject,
    openProjectByPath,
    getProjectByPath,
    showRecentProjects,
    setShowRecentProjects,
  };

  return (
    <RecentProjectsContext.Provider value={value}>
      {props.children}
    </RecentProjectsContext.Provider>
  );
}

export function useRecentProjects() {
  const context = useContext(RecentProjectsContext);
  if (!context) {
    throw new Error(
      "useRecentProjects must be used within a RecentProjectsProvider"
    );
  }
  return context;
}
