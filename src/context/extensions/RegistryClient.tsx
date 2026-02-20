/**
 * RegistryClient - Extension registry search and management
 *
 * Provides search, detail retrieval, installation, and update checking
 * for the extension marketplace. Communicates with the Tauri backend
 * for all registry operations.
 */
import {
  createContext,
  useContext,
  onMount,
  ParentProps,
  Accessor,
  createSignal,
  JSX,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types
// ============================================================================
export interface RegistrySearchResult {
  name: string;
  version: string;
  description: string;
  author: string;
  downloads: number;
  rating: number;
  iconUrl?: string;
  categories: string[];
  updatedAt: string;
}

export interface RegistryPluginDetail {
  name: string;
  version: string;
  description: string;
  author: string;
  downloads: number;
  rating: number;
  iconUrl?: string;
  repositoryUrl?: string;
  downloadUrl: string;
  categories: string[];
  updatedAt: string;
  readme?: string;
  changelog?: string;
  dependencies: string[];
  license?: string;
}

export interface RegistryUpdateInfo {
  name: string;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
}

export type RegistrySortOption = "relevance" | "downloads" | "rating" | "recent" | "name";

export interface RegistrySearchOptions {
  sortBy?: RegistrySortOption;
  category?: string;
  page?: number;
  pageSize?: number;
}

const REGISTRY_CATEGORIES = [
  "Themes", "Languages", "Snippets", "Formatters", "Linters",
  "Debuggers", "AI", "Git", "Testing", "Other",
] as const;

export type RegistryCategory = (typeof REGISTRY_CATEGORIES)[number];

export interface RegistryClientContextValue {
  searchResults: Accessor<RegistrySearchResult[]>;
  selectedPlugin: Accessor<RegistryPluginDetail | null>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
  sortBy: Accessor<RegistrySortOption>;
  category: Accessor<string>;
  page: Accessor<number>;
  totalCount: Accessor<number>;
  search: (query: string, opts?: RegistrySearchOptions) => Promise<void>;
  getPluginDetail: (name: string) => Promise<void>;
  checkUpdates: () => Promise<RegistryUpdateInfo[]>;
  installPlugin: (name: string) => Promise<void>;
  installPluginWithVersion: (name: string, version: string) => Promise<void>;
  resolveDependencies: (name: string, version: string) => Promise<string[]>;
  updateAll: () => Promise<number>;
  getCategories: () => readonly string[];
  categories: Accessor<string[]>;
  availableUpdates: Accessor<RegistryUpdateInfo[]>;
  fetchCategories: () => Promise<void>;
  checkMarketplaceUpdates: () => Promise<RegistryUpdateInfo[]>;
}

// ============================================================================
// Context
// ============================================================================
const RegistryClientContext = createContext<RegistryClientContextValue>();

// ============================================================================
// Provider
// ============================================================================
export function RegistryClientProvider(props: ParentProps): JSX.Element {
  const [searchResults, setSearchResults] = createSignal<RegistrySearchResult[]>([]);
  const [selectedPlugin, setSelectedPlugin] = createSignal<RegistryPluginDetail | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [sortBy, setSortBy] = createSignal<RegistrySortOption>("relevance");
  const [category, setCategory] = createSignal<string>("");
  const [page, setPage] = createSignal(1);
  const [categories, setCategories] = createSignal<string[]>([]);
  const [availableUpdates, setAvailableUpdates] = createSignal<RegistryUpdateInfo[]>([]);
  const [totalCount, setTotalCount] = createSignal(0);

  const search = async (query: string, opts?: RegistrySearchOptions): Promise<void> => {
    setLoading(true);
    setError(null);
    if (opts?.sortBy) setSortBy(opts.sortBy);
    if (opts?.category !== undefined) setCategory(opts.category);
    if (opts?.page !== undefined) setPage(opts.page);
    try {
      const result = await invoke<{
        plugins: RegistrySearchResult[];
        total_count: number;
        page: number;
        page_size: number;
      }>("registry_search", {
        query,
        sortBy: opts?.sortBy ?? sortBy(),
        category: (opts?.category ?? category()) || null,
        page: opts?.page ?? page(),
        pageSize: opts?.pageSize ?? 20,
      });
      setSearchResults(result.plugins);
      setTotalCount(result.total_count);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error("[RegistryClient] Search failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const getPluginDetail = async (name: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const detail = await invoke<RegistryPluginDetail>("registry_get_plugin", { name });
      setSelectedPlugin(detail);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error("[RegistryClient] Failed to get plugin detail:", e);
    } finally {
      setLoading(false);
    }
  };

  const checkUpdates = async (): Promise<RegistryUpdateInfo[]> => {
    setError(null);
    try {
      return await invoke<RegistryUpdateInfo[]>("registry_check_updates");
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error("[RegistryClient] Update check failed:", e);
      return [];
    }
  };

  const installPlugin = async (name: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await invoke("registry_install", { name });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error("[RegistryClient] Install failed:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const installPluginWithVersion = async (name: string, version: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await invoke("registry_install", { name, version });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error("[RegistryClient] Install with version failed:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const resolveDependencies = async (name: string, version: string): Promise<string[]> => {
    try {
      return await invoke<string[]>("registry_resolve_dependencies", { name, version });
    } catch (e) {
      console.warn("[RegistryClient] Dependency resolution failed:", e);
      return [];
    }
  };

  const updateAll = async (): Promise<number> => {
    setLoading(true);
    setError(null);
    try {
      return await invoke<number>("update_all_extensions");
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error("[RegistryClient] Update all failed:", e);
      return 0;
    } finally {
      setLoading(false);
    }
  };

  const getCategories = (): readonly string[] => REGISTRY_CATEGORIES;

  const fetchCategories = async (): Promise<void> => {
    try {
      const cats = await invoke<string[]>("get_marketplace_categories");
      setCategories(cats);
    } catch {
      // Fallback to static categories
    }
  };

  const checkMarketplaceUpdates = async (): Promise<RegistryUpdateInfo[]> => {
    try {
      const updates = await invoke<RegistryUpdateInfo[]>("check_extension_updates");
      setAvailableUpdates(updates);
      return updates;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error("[RegistryClient] Marketplace update check failed:", e);
      return [];
    }
  };

  onMount(async () => {
    try {
      await fetchCategories();
      const autoCheck = await invoke<boolean>("registry_check_updates_enabled");
      if (autoCheck) await checkUpdates();
    } catch {
      // Auto-update check setting not available; skip
    }
  });

  const value: RegistryClientContextValue = {
    searchResults, selectedPlugin, loading, error, sortBy, category, page,
    totalCount, search, getPluginDetail, checkUpdates, installPlugin,
    installPluginWithVersion, resolveDependencies, updateAll, getCategories,
    categories, availableUpdates, fetchCategories, checkMarketplaceUpdates,
  };

  return (
    <RegistryClientContext.Provider value={value}>
      {props.children}
    </RegistryClientContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================
export function useRegistryClient(): RegistryClientContextValue {
  const context = useContext(RegistryClientContext);
  if (!context) {
    throw new Error("useRegistryClient must be used within RegistryClientProvider");
  }
  return context;
}
