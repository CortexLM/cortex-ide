/**
 * Pull Request Context
 *
 * SolidJS context for pull request management.
 * Wraps Tauri IPC calls for PR lifecycle operations.
 */

import {
  createContext,
  useContext,
  ParentProps,
  createMemo,
  Accessor,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "@/utils/logger";

const prLogger = createLogger("PullRequest");

// ============================================================================
// Types (matching Rust backend: src-tauri/src/git/pull_request.rs)
// ============================================================================

export type PullRequestState = "open" | "closed" | "merged";

export type ReviewState =
  | "approved"
  | "changes_requested"
  | "commented"
  | "pending"
  | "dismissed";

export type CheckStatus =
  | "queued"
  | "in_progress"
  | "success"
  | "failure"
  | "neutral"
  | "cancelled"
  | "timed_out"
  | "action_required";

export type CheckConclusion =
  | "queued"
  | "in_progress"
  | "success"
  | "failure"
  | "neutral"
  | "cancelled"
  | "timed_out"
  | "action_required";

export type MergeMethod = "merge" | "squash" | "rebase";

export interface PullRequestUser {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface PullRequestLabel {
  id: number;
  name: string;
  color: string;
  description?: string;
}

export interface PullRequestBranch {
  label: string;
  ref: string;
  sha: string;
  repo_full_name?: string;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: PullRequestState;
  html_url: string;
  user: PullRequestUser;
  head: PullRequestBranch;
  base: PullRequestBranch;
  created_at: string;
  updated_at: string;
  merged_at?: string;
  closed_at?: string;
  labels: PullRequestLabel[];
  draft: boolean;
  mergeable?: boolean;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  review_comments?: number;
  commits?: number;
}

export interface PullRequestReview {
  id: number;
  user: PullRequestUser;
  state: ReviewState;
  body?: string;
  submitted_at?: string;
}

export interface CICheck {
  id: number;
  name: string;
  status: CheckStatus;
  conclusion?: CheckConclusion;
  html_url?: string;
  started_at?: string;
  completed_at?: string;
  output_title?: string;
  output_summary?: string;
}

export interface PullRequestCreate {
  title: string;
  body?: string;
  head: string;
  base: string;
  draft?: boolean;
  labels?: string[];
}

// ============================================================================
// Validation
// ============================================================================

const REPO_IDENTIFIER_RE = /^[a-zA-Z0-9._-]+$/;

function validateRepoIdentifier(value: string, fieldName: string): void {
  if (!value || typeof value !== "string") {
    throw new Error(`${fieldName} is required`);
  }
  if (value.length > 100) {
    throw new Error(`${fieldName} exceeds maximum length of 100 characters`);
  }
  if (!REPO_IDENTIFIER_RE.test(value)) {
    throw new Error(
      `${fieldName} contains invalid characters (only alphanumeric, '.', '-', '_' allowed)`
    );
  }
}

// ============================================================================
// State
// ============================================================================

interface PullRequestStoreState {
  pullRequests: PullRequest[];
  selectedPR: PullRequest | null;
  reviews: PullRequestReview[];
  checks: CICheck[];
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  owner: string;
  repo: string;
  filterState: PullRequestState | "all";
}

// ============================================================================
// Context Value Interface
// ============================================================================

interface PullRequestContextValue {
  state: PullRequestStoreState;
  fetchPRs: () => Promise<void>;
  selectPR: (pr: PullRequest | null) => void;
  createPR: (data: PullRequestCreate) => Promise<PullRequest>;
  mergePR: (prNumber: number, method: MergeMethod) => Promise<void>;
  setAuth: (token: string) => Promise<void>;
  setRepository: (owner: string, repo: string) => void;
  setFilterState: (filter: PullRequestState | "all") => void;
  filteredPRs: Accessor<PullRequest[]>;
}

// ============================================================================
// Context
// ============================================================================

const PullRequestContext = createContext<PullRequestContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function PullRequestProvider(props: ParentProps) {
  const [state, setState] = createStore<PullRequestStoreState>({
    pullRequests: [],
    selectedPR: null,
    reviews: [],
    checks: [],
    isLoading: false,
    error: null,
    isAuthenticated: false,
    owner: "",
    repo: "",
    filterState: "all",
  });

  const filteredPRs = createMemo(() => {
    if (state.filterState === "all") return state.pullRequests;
    return state.pullRequests.filter((pr) => pr.state === state.filterState);
  });

  const fetchPRs = async (): Promise<void> => {
    if (!state.owner || !state.repo) return;

    setState("isLoading", true);
    setState("error", null);

    try {
      const prs = await invoke<PullRequest[]>("git_forge_list_prs", {
        owner: state.owner,
        repo: state.repo,
      });
      setState("pullRequests", prs);
      prLogger.debug("PRs fetched, count:", prs.length);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState("error", errorMsg);
      prLogger.debug("Failed to fetch PRs:", errorMsg);
    } finally {
      setState("isLoading", false);
    }
  };

  const selectPR = (pr: PullRequest | null): void => {
    setState("selectedPR", pr);
    setState("reviews", []);
    setState("checks", []);

    if (pr) {
      invoke<PullRequestReview[]>("git_forge_get_pr_reviews", {
        owner: state.owner,
        repo: state.repo,
        number: pr.number,
      })
        .then((reviews) => setState("reviews", reviews))
        .catch((e) => prLogger.debug("Failed to fetch reviews:", e));

      invoke<CICheck[]>("git_forge_pr_checks", {
        owner: state.owner,
        repo: state.repo,
        refSha: pr.head.sha,
      })
        .then((checks) => setState("checks", checks))
        .catch((e) => prLogger.debug("Failed to fetch checks:", e));
    }
  };

  const createPR = async (data: PullRequestCreate): Promise<PullRequest> => {
    setState("isLoading", true);
    setState("error", null);

    try {
      const pr = await invoke<PullRequest>("git_forge_create_pr", {
        owner: state.owner,
        repo: state.repo,
        create: data,
      });
      setState("pullRequests", (prs) => [pr, ...prs]);
      prLogger.debug("PR created:", pr.number);
      return pr;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState("error", errorMsg);
      throw new Error(errorMsg);
    } finally {
      setState("isLoading", false);
    }
  };

  const mergePR = async (
    prNumber: number,
    method: MergeMethod
  ): Promise<void> => {
    setState("isLoading", true);
    setState("error", null);

    try {
      await invoke("git_forge_merge_pr", {
        owner: state.owner,
        repo: state.repo,
        number: prNumber,
        merge: {
          merge_method: method,
        },
      });

      setState(
        "pullRequests",
        (pr) => pr.number === prNumber,
        produce((pr) => {
          pr.state = "merged";
          pr.merged_at = new Date().toISOString();
        })
      );

      if (state.selectedPR?.number === prNumber) {
        setState("selectedPR", "state", "merged");
      }

      prLogger.debug("PR merged:", prNumber);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState("error", errorMsg);
      throw new Error(errorMsg);
    } finally {
      setState("isLoading", false);
    }
  };

  const setAuth = async (token: string): Promise<void> => {
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      throw new Error("Token is required and cannot be empty");
    }

    try {
      await invoke("git_forge_authenticate", { token, provider: "github" });
      setState("isAuthenticated", true);
      setState("error", null);
      prLogger.debug("Authentication set");
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState("error", errorMsg);
      throw new Error(errorMsg);
    }
  };

  const setRepository = (owner: string, repo: string): void => {
    validateRepoIdentifier(owner, "owner");
    validateRepoIdentifier(repo, "repo");

    setState("owner", owner);
    setState("repo", repo);
    setState("pullRequests", []);
    setState("selectedPR", null);
  };

  const setFilterState = (filter: PullRequestState | "all"): void => {
    setState("filterState", filter);
  };

  const contextValue: PullRequestContextValue = {
    state,
    fetchPRs,
    selectPR,
    createPR,
    mergePR,
    setAuth,
    setRepository,
    setFilterState,
    filteredPRs,
  };

  return (
    <PullRequestContext.Provider value={contextValue}>
      {props.children}
    </PullRequestContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function usePullRequests(): PullRequestContextValue {
  const context = useContext(PullRequestContext);
  if (!context) {
    throw new Error(
      "usePullRequests must be used within PullRequestProvider"
    );
  }
  return context;
}
