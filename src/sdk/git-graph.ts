import { invoke } from "@tauri-apps/api/core";

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: {
    name: string;
    email: string;
    timestamp: number;
  };
  committer: {
    name: string;
    email: string;
    timestamp: number;
  };
  parents: string[];
  refs: GitRef[];
}

export interface GitRef {
  name: string;
  type: "branch" | "tag" | "remote" | "head";
  isHead?: boolean;
}

export interface GitGraphNode {
  commit: GitCommit;
  column: number;
  color: string;
  connections: GitGraphConnection[];
}

export interface GitGraphConnection {
  fromColumn: number;
  toColumn: number;
  type: "straight" | "merge" | "branch";
  color: string;
}

export interface GitGraphOptions {
  path?: string;
  maxCount?: number;
  skip?: number;
  branch?: string;
  all?: boolean;
  firstParent?: boolean;
  since?: string;
  until?: string;
  author?: string;
  grep?: string;
}

export interface GitGraphResult {
  nodes: GitGraphNode[];
  branches: GitBranch[];
  tags: GitTag[];
  totalCount: number;
  hasMore: boolean;
}

export interface GitBranch {
  name: string;
  isRemote: boolean;
  isHead: boolean;
  upstream?: string;
  ahead?: number;
  behind?: number;
}

export interface GitTag {
  name: string;
  hash: string;
  message?: string;
  tagger?: {
    name: string;
    email: string;
    timestamp: number;
  };
}

export interface GitDiffStat {
  insertions: number;
  deletions: number;
  files: number;
}

export interface GitCommitDetails extends GitCommit {
  body: string;
  diff?: string;
  stats?: GitDiffStat;
  files: GitFileChange[];
}

export interface GitFileChange {
  path: string;
  oldPath?: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied";
  insertions: number;
  deletions: number;
}

export async function gitGetCommitGraph(options: GitGraphOptions = {}): Promise<GitGraphResult> {
  try {
    const result = await invoke<GitGraphResult>("git_get_commit_graph", {
      path: options.path ?? ".",
      options: {
        maxCount: options.maxCount ?? 100,
        skip: options.skip ?? 0,
        branch: options.branch,
        all: options.all ?? true,
        firstParent: options.firstParent ?? false,
        since: options.since,
        until: options.until,
        author: options.author,
        grep: options.grep,
      },
    });
    return result;
  } catch (error) {
    console.error("[git-graph] Failed to get commit graph:", error);
    return {
      nodes: [],
      branches: [],
      tags: [],
      totalCount: 0,
      hasMore: false,
    };
  }
}

export async function gitGetCommitDetails(hash: string, path?: string): Promise<GitCommitDetails | null> {
  try {
    const result = await invoke<GitCommitDetails>("git_get_commit_details", {
      hash,
      path,
    });
    return result;
  } catch (error) {
    console.error("[git-graph] Failed to get commit details:", error);
    return null;
  }
}

export async function gitGetBranches(path?: string): Promise<GitBranch[]> {
  try {
    const result = await invoke<{ branches: Array<{ name: string; is_head: boolean; is_remote: boolean; upstream?: string; ahead?: number; behind?: number }> }>("git_branches", { path: path ?? "." });
    return result.branches.map((b) => ({
      name: b.name,
      isRemote: b.is_remote,
      isHead: b.is_head,
      upstream: b.upstream,
      ahead: b.ahead,
      behind: b.behind,
    }));
  } catch (error) {
    console.error("[git-graph] Failed to get branches:", error);
    return [];
  }
}

export async function gitGetTags(path?: string): Promise<GitTag[]> {
  try {
    const result = await invoke<Array<{ name: string; commit_sha: string; message?: string; tagger?: string; date?: string; is_annotated: boolean }>>("git_list_tags", { path: path ?? "." });
    return result.map((t) => ({
      name: t.name,
      hash: t.commit_sha,
      message: t.message,
    }));
  } catch (error) {
    console.error("[git-graph] Failed to get tags:", error);
    return [];
  }
}

export async function gitCheckout(ref: string, path?: string): Promise<boolean> {
  try {
    await invoke("git_checkout", { ref, path });
    return true;
  } catch (error) {
    console.error("[git-graph] Failed to checkout:", error);
    return false;
  }
}

export async function gitCreateBranch(name: string, startPoint?: string, path?: string): Promise<boolean> {
  try {
    await invoke("git_create_branch", { name, startPoint, path });
    return true;
  } catch (error) {
    console.error("[git-graph] Failed to create branch:", error);
    return false;
  }
}

export async function gitDeleteBranch(name: string, force?: boolean, path?: string): Promise<boolean> {
  try {
    await invoke("git_delete_branch", { name, force: force ?? false, path });
    return true;
  } catch (error) {
    console.error("[git-graph] Failed to delete branch:", error);
    return false;
  }
}

export async function gitMerge(branch: string, noFastForward?: boolean, path?: string): Promise<boolean> {
  try {
    await invoke("git_merge", { branch, noFf: noFastForward ?? false, path });
    return true;
  } catch (error) {
    console.error("[git-graph] Failed to merge:", error);
    return false;
  }
}

export async function gitRebase(onto: string, path?: string): Promise<boolean> {
  try {
    await invoke("git_rebase", { onto, path });
    return true;
  } catch (error) {
    console.error("[git-graph] Failed to rebase:", error);
    return false;
  }
}

export async function gitCherryPick(hash: string, path?: string): Promise<boolean> {
  try {
    await invoke("git_cherry_pick", { hash, path });
    return true;
  } catch (error) {
    console.error("[git-graph] Failed to cherry-pick:", error);
    return false;
  }
}

export async function gitRevert(hash: string, path?: string): Promise<boolean> {
  try {
    await invoke("git_revert", { hash, path });
    return true;
  } catch (error) {
    console.error("[git-graph] Failed to revert:", error);
    return false;
  }
}

export async function gitReset(hash: string, mode: "soft" | "mixed" | "hard" = "mixed", path?: string): Promise<boolean> {
  try {
    await invoke("git_reset", { hash, mode, path });
    return true;
  } catch (error) {
    console.error("[git-graph] Failed to reset:", error);
    return false;
  }
}

export async function gitCompareCommits(
  from: string,
  to: string,
  path?: string
): Promise<{ filesChanged: number; additions: number; deletions: number; files: GitFileChange[] } | null> {
  try {
    const result = await invoke<{ filesChanged: number; additions: number; deletions: number; files: Array<{ path: string; status: string; additions: number; deletions: number }> }>(
      "git_compare_commits",
      { fromSha: from, toSha: to, path: path ?? "." }
    );
    return {
      filesChanged: result.filesChanged,
      additions: result.additions,
      deletions: result.deletions,
      files: result.files.map((f) => ({
        path: f.path,
        status: f.status as GitFileChange["status"],
        insertions: f.additions,
        deletions: f.deletions,
      })),
    };
  } catch (error) {
    console.error("[git-graph] Failed to compare commits:", error);
    return null;
  }
}
