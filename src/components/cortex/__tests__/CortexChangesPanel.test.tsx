import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { invoke } from "@tauri-apps/api/core";
import { CortexChangesPanel } from "../CortexChangesPanel";
import type { FileChange } from "../CortexChangesPanel";

vi.mock("../primitives/CortexIcon", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
}));

vi.mock("../vibe/VibeTabBar", () => ({
  VibeTabBar: (props: { tabs: { id: string; label: string; count?: number }[]; activeId: string; onTabChange: (id: string) => void }) => (
    <div data-testid="vibe-tab-bar">
      {props.tabs.map((tab: { id: string; label: string; count?: number }) => (
        <button
          data-testid={`tab-${tab.id}`}
          data-active={props.activeId === tab.id}
          onClick={() => props.onTabChange(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && <span data-testid={`tab-count-${tab.id}`}>{tab.count}</span>}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("../vibe/FileChangeRow", () => ({
  FileChangeRow: (props: {
    path: string;
    additions: number;
    deletions: number;
    status: string;
    isExpanded?: boolean;
    onClick: () => void;
  }) => (
    <div
      data-testid={`file-row-${props.path}`}
      data-status={props.status}
      data-expanded={props.isExpanded}
      onClick={props.onClick}
    >
      <span data-testid={`file-name-${props.path}`}>{props.path}</span>
      <span data-testid={`file-additions-${props.path}`}>+{props.additions}</span>
      <span data-testid={`file-deletions-${props.path}`}>-{props.deletions}</span>
    </div>
  ),
}));

vi.mock("../vibe/DiffPreview", () => ({
  DiffPreview: (props: { fileName: string; lines: { content: string; type: string }[] }) => (
    <div data-testid={`diff-preview-${props.fileName}`}>
      {props.lines.map((line: { content: string; type: string }, i: number) => (
        <div data-testid={`diff-line-${i}`} data-type={line.type}>
          {line.content}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("../vibe/VibeTerminal", () => ({
  VibeTerminal: (props: {
    output: string[];
    branchName?: string;
    height: number;
    onRunCommand: (cmd: string) => void;
    onRun: () => void;
    onDividerDrag: (e: MouseEvent) => void;
  }) => (
    <div data-testid="vibe-terminal">
      <span data-testid="terminal-branch">{props.branchName}</span>
      {props.output.map((line: string, i: number) => (
        <div data-testid={`terminal-line-${i}`}>{line}</div>
      ))}
      <button data-testid="terminal-run" onClick={props.onRun}>Run</button>
    </div>
  ),
}));

describe("CortexChangesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  const createChanges = (): FileChange[] => [
    { path: "src/App.tsx", additions: 15, deletions: 3, status: "modified" },
    { path: "src/utils/helpers.ts", additions: 42, deletions: 0, status: "added" },
    { path: "src/old-module.ts", additions: 0, deletions: 28, status: "deleted" },
  ];

  describe("Renders file changes list", () => {
    it("should render all file changes", () => {
      const changes = createChanges();
      const { getByTestId } = render(() => (
        <CortexChangesPanel changes={changes} />
      ));

      expect(getByTestId("file-row-src/App.tsx")).toBeTruthy();
      expect(getByTestId("file-row-src/utils/helpers.ts")).toBeTruthy();
      expect(getByTestId("file-row-src/old-module.ts")).toBeTruthy();
    });

    it("should display file paths", () => {
      const changes = createChanges();
      const { container } = render(() => (
        <CortexChangesPanel changes={changes} />
      ));

      expect(container.textContent).toContain("src/App.tsx");
      expect(container.textContent).toContain("src/utils/helpers.ts");
      expect(container.textContent).toContain("src/old-module.ts");
    });

    it("should display addition and deletion counts", () => {
      const changes = createChanges();
      const { getByTestId } = render(() => (
        <CortexChangesPanel changes={changes} />
      ));

      expect(getByTestId("file-additions-src/App.tsx").textContent).toBe("+15");
      expect(getByTestId("file-deletions-src/App.tsx").textContent).toBe("-3");
    });

    it("should display file status", () => {
      const changes = createChanges();
      const { getByTestId } = render(() => (
        <CortexChangesPanel changes={changes} />
      ));

      expect(getByTestId("file-row-src/App.tsx").getAttribute("data-status")).toBe("modified");
      expect(getByTestId("file-row-src/utils/helpers.ts").getAttribute("data-status")).toBe("added");
      expect(getByTestId("file-row-src/old-module.ts").getAttribute("data-status")).toBe("deleted");
    });

    it("should show 'No changes yet' when changes list is empty", () => {
      const { container } = render(() => (
        <CortexChangesPanel changes={[]} />
      ));

      expect(container.textContent).toContain("No changes yet");
    });

    it("should render tab bar with Changes and All Files tabs", () => {
      const { getByTestId } = render(() => (
        <CortexChangesPanel changes={[]} />
      ));

      expect(getByTestId("vibe-tab-bar")).toBeTruthy();
      expect(getByTestId("tab-changes")).toBeTruthy();
      expect(getByTestId("tab-all_files")).toBeTruthy();
    });

    it("should show changes count in tab when changes exist", () => {
      const changes = createChanges();
      const { getByTestId } = render(() => (
        <CortexChangesPanel changes={changes} />
      ));

      expect(getByTestId("tab-count-changes").textContent).toBe("3");
    });

    it("should display summary bar with total additions and deletions", () => {
      const changes = createChanges();
      const { container } = render(() => (
        <CortexChangesPanel changes={changes} />
      ));

      expect(container.textContent).toContain("+57");
      expect(container.textContent).toContain("-31");
    });

    it("should render terminal", () => {
      const { getByTestId } = render(() => (
        <CortexChangesPanel changes={[]} />
      ));

      expect(getByTestId("vibe-terminal")).toBeTruthy();
    });

    it("should pass branch name to terminal", () => {
      const { getByTestId } = render(() => (
        <CortexChangesPanel changes={[]} branchName="feature/my-branch" />
      ));

      expect(getByTestId("terminal-branch").textContent).toBe("feature/my-branch");
    });

    it("should render terminal output lines", () => {
      const { getByTestId } = render(() => (
        <CortexChangesPanel changes={[]} terminalOutput={["$ npm install", "✅ Done"]} />
      ));

      expect(getByTestId("terminal-line-0").textContent).toBe("$ npm install");
      expect(getByTestId("terminal-line-1").textContent).toBe("✅ Done");
    });
  });

  describe("Accept/reject change actions", () => {
    it("should render accept button when onAcceptFile is provided", () => {
      const changes = createChanges();
      const onAcceptFile = vi.fn();

      const { container } = render(() => (
        <CortexChangesPanel changes={changes} onAcceptFile={onAcceptFile} />
      ));

      const acceptButtons = container.querySelectorAll("button");
      const acceptBtn = Array.from(acceptButtons).find(btn => btn.textContent === "✓");
      expect(acceptBtn).toBeTruthy();
    });

    it("should render reject button when onRejectFile is provided", () => {
      const changes = createChanges();
      const onRejectFile = vi.fn();

      const { container } = render(() => (
        <CortexChangesPanel changes={changes} onRejectFile={onRejectFile} />
      ));

      const rejectButtons = container.querySelectorAll("button");
      const rejectBtn = Array.from(rejectButtons).find(btn => btn.textContent === "✕");
      expect(rejectBtn).toBeTruthy();
    });

    it("should call onAcceptFile with file path when accept is clicked", async () => {
      const changes: FileChange[] = [
        { path: "src/App.tsx", additions: 5, deletions: 2, status: "modified" },
      ];
      const onAcceptFile = vi.fn();

      const { container } = render(() => (
        <CortexChangesPanel changes={changes} onAcceptFile={onAcceptFile} />
      ));

      const acceptBtn = Array.from(container.querySelectorAll("button")).find(btn => btn.textContent === "✓");
      if (acceptBtn) {
        await fireEvent.click(acceptBtn);
      }

      expect(onAcceptFile).toHaveBeenCalledWith("src/App.tsx");
    });

    it("should call onRejectFile with file path when reject is clicked", async () => {
      const changes: FileChange[] = [
        { path: "src/App.tsx", additions: 5, deletions: 2, status: "modified" },
      ];
      const onRejectFile = vi.fn();

      const { container } = render(() => (
        <CortexChangesPanel changes={changes} onRejectFile={onRejectFile} />
      ));

      const rejectBtn = Array.from(container.querySelectorAll("button")).find(btn => btn.textContent === "✕");
      if (rejectBtn) {
        await fireEvent.click(rejectBtn);
      }

      expect(onRejectFile).toHaveBeenCalledWith("src/App.tsx");
    });

    it("should not render accept/reject buttons when handlers are not provided", () => {
      const changes = createChanges();

      const { container } = render(() => (
        <CortexChangesPanel changes={changes} />
      ));

      const acceptBtn = Array.from(container.querySelectorAll("button")).find(btn => btn.textContent === "✓");
      const rejectBtn = Array.from(container.querySelectorAll("button")).find(btn => btn.textContent === "✕");
      expect(acceptBtn).toBeUndefined();
      expect(rejectBtn).toBeUndefined();
    });
  });

  describe("Diff preview for each change", () => {
    it("should show diff preview when file is clicked", async () => {
      const changes: FileChange[] = [
        { path: "src/App.tsx", additions: 5, deletions: 2, status: "modified" },
      ];

      const mockedInvoke = vi.mocked(invoke);
      mockedInvoke.mockResolvedValueOnce(
        "@@ -1,3 +1,5 @@\n+import React from 'react';\n const App = () => {\n-  return null;\n+  return <div>Hello</div>;\n+};\n"
      );

      const { getByTestId, findByTestId } = render(() => (
        <CortexChangesPanel changes={changes} projectPath="/my/project" />
      ));

      await fireEvent.click(getByTestId("file-row-src/App.tsx"));

      const diffPreview = await findByTestId("diff-preview-src/App.tsx");
      expect(diffPreview).toBeTruthy();
    });

    it("should call git_diff with correct parameters", async () => {
      const changes: FileChange[] = [
        { path: "src/App.tsx", additions: 5, deletions: 2, status: "modified" },
      ];

      const mockedInvoke = vi.mocked(invoke);
      mockedInvoke.mockResolvedValueOnce("@@ -1,1 +1,1 @@\n-old\n+new\n");

      const { getByTestId } = render(() => (
        <CortexChangesPanel changes={changes} projectPath="/my/project" />
      ));

      await fireEvent.click(getByTestId("file-row-src/App.tsx"));

      expect(mockedInvoke).toHaveBeenCalledWith("git_diff", {
        path: "/my/project",
        filePath: "src/App.tsx",
      });
    });

    it("should collapse diff preview when same file is clicked again", async () => {
      const changes: FileChange[] = [
        { path: "src/App.tsx", additions: 5, deletions: 2, status: "modified" },
      ];

      const mockedInvoke = vi.mocked(invoke);
      mockedInvoke.mockResolvedValue("@@ -1,1 +1,1 @@\n-old\n+new\n");

      const { getByTestId, queryByTestId } = render(() => (
        <CortexChangesPanel changes={changes} projectPath="/my/project" />
      ));

      await fireEvent.click(getByTestId("file-row-src/App.tsx"));
      await vi.waitFor(() => {
        expect(queryByTestId("diff-preview-src/App.tsx")).toBeTruthy();
      });

      await fireEvent.click(getByTestId("file-row-src/App.tsx"));
      expect(queryByTestId("diff-preview-src/App.tsx")).toBeNull();
    });

    it("should call onFileClick when file is clicked", async () => {
      const changes: FileChange[] = [
        { path: "src/App.tsx", additions: 5, deletions: 2, status: "modified" },
      ];
      const onFileClick = vi.fn();

      const mockedInvoke = vi.mocked(invoke);
      mockedInvoke.mockResolvedValueOnce("");

      const { getByTestId } = render(() => (
        <CortexChangesPanel changes={changes} onFileClick={onFileClick} />
      ));

      await fireEvent.click(getByTestId("file-row-src/App.tsx"));
      expect(onFileClick).toHaveBeenCalledWith("src/App.tsx");
    });

    it("should handle diff loading error gracefully", async () => {
      const changes: FileChange[] = [
        { path: "src/App.tsx", additions: 5, deletions: 2, status: "modified" },
      ];

      const mockedInvoke = vi.mocked(invoke);
      mockedInvoke.mockRejectedValueOnce(new Error("git not found"));

      const { getByTestId, findByTestId } = render(() => (
        <CortexChangesPanel changes={changes} projectPath="/my/project" />
      ));

      await fireEvent.click(getByTestId("file-row-src/App.tsx"));

      const diffPreview = await findByTestId("diff-preview-src/App.tsx");
      expect(diffPreview.textContent).toContain("Unable to load diff");
    });

    it("should call onRun when terminal run button is clicked", async () => {
      const onRun = vi.fn();

      const { getByTestId } = render(() => (
        <CortexChangesPanel changes={[]} onRun={onRun} />
      ));

      await fireEvent.click(getByTestId("terminal-run"));
      expect(onRun).toHaveBeenCalled();
    });
  });

  describe("Styling", () => {
    it("should apply custom class", () => {
      const { container } = render(() => (
        <CortexChangesPanel changes={[]} class="custom-panel" />
      ));

      const root = container.firstChild as HTMLElement;
      expect(root?.className).toContain("custom-panel");
    });

    it("should apply custom style", () => {
      const { container } = render(() => (
        <CortexChangesPanel changes={[]} style={{ "background-color": "green" }} />
      ));

      const root = container.firstChild as HTMLElement;
      expect(root?.style.backgroundColor).toBe("green");
    });
  });
});
