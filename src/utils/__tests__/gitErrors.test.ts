import { describe, it, expect } from "vitest";
import {
  GitErrorCode,
  createGitError,
  parseGitErrorCode,
  getGitErrorMessage,
  isRetryableError,
  getGitErrorSeverity,
} from "../git/errors";

describe("git/errors", () => {
  describe("parseGitErrorCode", () => {
    it("detects repository locked", () => {
      expect(parseGitErrorCode("another git process seems to be running")).toBe(
        GitErrorCode.RepositoryIsLocked
      );
    });
    it("detects cant lock ref", () => {
      expect(parseGitErrorCode("cannot lock ref")).toBe(GitErrorCode.CantLockRef);
    });
    it("detects auth failed", () => {
      expect(parseGitErrorCode("Authentication failed")).toBe(
        GitErrorCode.AuthenticationFailed
      );
    });
    it("detects not a git repository", () => {
      expect(parseGitErrorCode("fatal: not a git repository")).toBe(
        GitErrorCode.NotAGitRepository
      );
    });
    it("detects push rejected", () => {
      expect(parseGitErrorCode("[rejected] main -> main (non-fast-forward)")).toBe(
        GitErrorCode.PushRejected
      );
    });
    it("detects merge conflict", () => {
      expect(parseGitErrorCode("CONFLICT (content): Merge conflict in file.txt")).toBe(
        GitErrorCode.MergeConflict
      );
    });
    it("detects rebase conflict", () => {
      expect(parseGitErrorCode("CONFLICT during rebase")).toBe(
        GitErrorCode.RebaseConflict
      );
    });
    it("detects branch not found", () => {
      expect(parseGitErrorCode("error: branch 'foo' not found")).toBe(
        GitErrorCode.BranchNotFound
      );
    });
    it("detects branch already exists", () => {
      expect(parseGitErrorCode("a branch named 'foo' already exists")).toBe(
        GitErrorCode.BranchAlreadyExists
      );
    });
    it("detects empty commit message", () => {
      expect(parseGitErrorCode("aborting commit due to empty commit message")).toBe(
        GitErrorCode.EmptyCommitMessage
      );
    });
    it("detects nothing to commit", () => {
      expect(parseGitErrorCode("nothing to commit")).toBe(
        GitErrorCode.NoChangesToCommit
      );
    });
    it("detects dirty work tree", () => {
      expect(parseGitErrorCode("please commit your changes or stash them before")).toBe(
        GitErrorCode.DirtyWorkTree
      );
    });
    it("detects local changes overwritten", () => {
      expect(parseGitErrorCode("your local changes would be overwritten by merge")).toBe(
        GitErrorCode.LocalChangesOverwritten
      );
    });
    it("detects SSH error", () => {
      expect(parseGitErrorCode("Permission denied (publickey)")).toBe(
        GitErrorCode.SSHError
      );
    });
    it("detects permission denied", () => {
      expect(parseGitErrorCode("error: permission denied")).toBe(
        GitErrorCode.PermissionDenied
      );
    });
    it("detects network error", () => {
      expect(parseGitErrorCode("could not resolve host")).toBe(
        GitErrorCode.NetworkError
      );
    });
    it("detects remote not found", () => {
      expect(parseGitErrorCode("remote origin not found")).toBe(
        GitErrorCode.RemoteNotFound
      );
    });
    it("detects tag already exists", () => {
      expect(parseGitErrorCode("tag 'v1.0' already exists")).toBe(
        GitErrorCode.TagAlreadyExists
      );
    });
    it("detects no stash found", () => {
      expect(parseGitErrorCode("no stash entries found")).toBe(
        GitErrorCode.NoStashFound
      );
    });
    it("returns unknown for unrecognized", () => {
      expect(parseGitErrorCode("something random")).toBe(GitErrorCode.Unknown);
    });
  });

  describe("createGitError", () => {
    it("creates error with parsed code", () => {
      const err = createGitError("test", {
        stderr: "another git process seems to be running",
        exitCode: 128,
      });
      expect(err.message).toBe("test");
      expect(err.gitErrorCode).toBe(GitErrorCode.RepositoryIsLocked);
      expect(err.exitCode).toBe(128);
    });
    it("defaults to Unknown without stderr", () => {
      const err = createGitError("test");
      expect(err.gitErrorCode).toBe(GitErrorCode.Unknown);
    });
  });

  describe("getGitErrorMessage", () => {
    it("returns user-friendly message", () => {
      expect(getGitErrorMessage(GitErrorCode.RepositoryIsLocked)).toContain(
        "Another Git process"
      );
      expect(getGitErrorMessage(GitErrorCode.AuthenticationFailed)).toContain(
        "Authentication"
      );
    });
    it("returns generic message for unknown", () => {
      expect(getGitErrorMessage(GitErrorCode.Unknown)).toContain("Git error");
    });
  });

  describe("isRetryableError", () => {
    it("returns true for retryable errors", () => {
      expect(isRetryableError(GitErrorCode.RepositoryIsLocked)).toBe(true);
      expect(isRetryableError(GitErrorCode.CantLockRef)).toBe(true);
    });
    it("returns false for non-retryable errors", () => {
      expect(isRetryableError(GitErrorCode.AuthenticationFailed)).toBe(false);
      expect(isRetryableError(GitErrorCode.Unknown)).toBe(false);
    });
  });

  describe("getGitErrorSeverity", () => {
    it("returns error for most codes", () => {
      expect(getGitErrorSeverity(GitErrorCode.AuthenticationFailed)).toBe("error");
    });
    it("returns warning for conflict errors", () => {
      expect(getGitErrorSeverity(GitErrorCode.ConflictError)).toBe("warning");
      expect(getGitErrorSeverity(GitErrorCode.MergeConflict)).toBe("warning");
    });
    it("returns info for informational codes", () => {
      expect(getGitErrorSeverity(GitErrorCode.NoChangesToCommit)).toBe("info");
      expect(getGitErrorSeverity(GitErrorCode.NoStashFound)).toBe("info");
    });
  });
});
