/**
 * Merge Branch Dialog - Merge a branch into the current branch
 *
 * Supports:
 * - Branch selection with search
 * - No-fast-forward option
 * - Custom commit message
 * - Branch comparison preview
 */

import { createSignal, Show, createEffect, For } from "solid-js";
import { Icon } from "../ui/Icon";
import { Button, Input, Modal, Text, Toggle } from "@/components/ui";
import { tokens } from "@/design-system/tokens";
import { gitBranches, gitCompareBranches, type GitBranch, type BranchComparison } from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";

export interface MergeBranchDialogProps {
  open: boolean;
  currentBranch: string;
  onMerge: (branch: string, options: { noFf: boolean; message?: string }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

export function MergeBranchDialog(props: MergeBranchDialogProps) {
  // Form state
  const [selectedBranch, setSelectedBranch] = createSignal("");
  const [noFastForward, setNoFastForward] = createSignal(false);
  const [customMessage, setCustomMessage] = createSignal("");
  const [useCustomMessage, setUseCustomMessage] = createSignal(false);

  // Branch list state
  const [branches, setBranches] = createSignal<GitBranch[]>([]);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [showBranchDropdown, setShowBranchDropdown] = createSignal(false);
  const [loadingBranches, setLoadingBranches] = createSignal(false);

  // Comparison state
  const [comparison, setComparison] = createSignal<BranchComparison | null>(null);
  const [loadingComparison, setLoadingComparison] = createSignal(false);

  // Fetch branches when dialog opens
  createEffect(() => {
    if (props.open) {
      resetForm();
      fetchBranches();
    }
  });

  // Fetch comparison when branch is selected
  createEffect(() => {
    const branch = selectedBranch();
    if (branch && props.open) {
      fetchComparison(branch);
    } else {
      setComparison(null);
    }
  });

  const fetchBranches = async () => {
    setLoadingBranches(true);
    try {
      const projectPath = getProjectPath();
      const branchList = await gitBranches(projectPath);
      // Filter out current branch and remote tracking branches
      const filteredBranches = branchList.filter(
        (b: GitBranch) => b.name !== props.currentBranch && !b.name.startsWith("origin/HEAD")
      );
      setBranches(filteredBranches);
    } catch (err) {
      console.error("Failed to fetch branches:", err);
    } finally {
      setLoadingBranches(false);
    }
  };

  const fetchComparison = async (branch: string) => {
    setLoadingComparison(true);
    try {
      const projectPath = getProjectPath();
      const result = await gitCompareBranches(projectPath, props.currentBranch, branch);
      setComparison(result);
    } catch (err) {
      console.error("Failed to compare branches:", err);
      setComparison(null);
    } finally {
      setLoadingComparison(false);
    }
  };

  const resetForm = () => {
    setSelectedBranch("");
    setNoFastForward(false);
    setCustomMessage("");
    setUseCustomMessage(false);
    setSearchQuery("");
    setShowBranchDropdown(false);
    setComparison(null);
  };

  const handleMerge = async () => {
    if (!selectedBranch()) return;
    await props.onMerge(selectedBranch(), {
      noFf: noFastForward(),
      message: useCustomMessage() ? customMessage() : undefined,
    });
  };

  const filteredBranches = () => {
    const query = searchQuery().toLowerCase();
    if (!query) return branches();
    return branches().filter((b) => b.name.toLowerCase().includes(query));
  };

  const selectBranch = (branchName: string) => {
    setSelectedBranch(branchName);
    setShowBranchDropdown(false);
    setSearchQuery("");
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      title="Merge Branch"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={props.onCancel} disabled={props.loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleMerge}
            loading={props.loading}
            disabled={!selectedBranch()}
            icon={<Icon name="code-merge" style={{ width: "14px", height: "14px" }} />}
          >
            Merge
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.xl }}>
        {/* Current Branch Info */}
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.sm,
            padding: tokens.spacing.md,
            background: tokens.colors.surface.panel,
            "border-radius": tokens.radius.md,
          }}
        >
          <Icon name="code-branch" style={{ width: "14px", height: "14px", color: tokens.colors.semantic.primary }} />
          <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
            Merging into:
          </Text>
          <Text style={{ "font-size": "12px", color: tokens.colors.text.primary, "font-weight": "500" }}>
            {props.currentBranch}
          </Text>
        </div>

        {/* Branch Selection */}
        <div>
          <Text
            style={{
              "font-size": "12px",
              "font-weight": "500",
              color: tokens.colors.text.muted,
              "margin-bottom": tokens.spacing.sm,
            }}
          >
            Select branch to merge
          </Text>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowBranchDropdown(!showBranchDropdown())}
              style={{
                width: "100%",
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                background: tokens.colors.surface.overlay,
                border: `1px solid ${tokens.colors.border.default}`,
                "border-radius": tokens.radius.md,
                cursor: "pointer",
                color: selectedBranch() ? tokens.colors.text.primary : tokens.colors.text.muted,
                "font-size": "13px",
              }}
            >
              <span>{selectedBranch() || "Select a branch..."}</span>
              <Icon name="chevron-down" style={{ width: "14px", height: "14px" }} />
            </button>

            {/* Dropdown */}
            <Show when={showBranchDropdown()}>
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: "0",
                  right: "0",
                  background: tokens.colors.surface.overlay,
                  border: `1px solid ${tokens.colors.border.default}`,
                  "border-radius": tokens.radius.md,
                  "box-shadow": tokens.shadows.popup,
                  "z-index": "100",
                  "max-height": "250px",
                  overflow: "hidden",
                  display: "flex",
                  "flex-direction": "column",
                }}
              >
                {/* Search */}
                <div style={{ padding: tokens.spacing.sm, "border-bottom": `1px solid ${tokens.colors.border.divider}` }}>
                  <Input
                    value={searchQuery()}
                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                    placeholder="Search branches..."
                    autofocus
                  />
                </div>

                {/* Branch List */}
                <div style={{ overflow: "auto", "max-height": "200px" }}>
                  <Show when={loadingBranches()}>
                    <div style={{ padding: tokens.spacing.md, "text-align": "center" }}>
                      <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
                        Loading branches...
                      </Text>
                    </div>
                  </Show>
                  <Show when={!loadingBranches() && filteredBranches().length === 0}>
                    <div style={{ padding: tokens.spacing.md, "text-align": "center" }}>
                      <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
                        No branches found
                      </Text>
                    </div>
                  </Show>
                  <For each={filteredBranches()}>
                    {(branch) => (
                      <button
                        type="button"
                        onClick={() => selectBranch(branch.name)}
                        style={{
                          width: "100%",
                          display: "flex",
                          "align-items": "center",
                          gap: tokens.spacing.sm,
                          padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: tokens.colors.text.primary,
                          "font-size": "12px",
                          "text-align": "left",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = tokens.colors.interactive.hover;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <Icon
                          name="code-branch"
                          style={{
                            width: "12px",
                            height: "12px",
                            color: branch.isRemote ? tokens.colors.text.muted : tokens.colors.semantic.primary,
                          }}
                        />
                        <span style={{ flex: "1" }}>{branch.name}</span>
                        <Show when={branch.isRemote}>
                          <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>remote</Text>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </div>

        {/* Branch Comparison */}
        <Show when={selectedBranch()}>
          <div
            style={{
              padding: tokens.spacing.md,
              background: tokens.colors.surface.panel,
              "border-radius": tokens.radius.md,
              border: `1px solid ${tokens.colors.border.default}`,
            }}
          >
            <Show when={loadingComparison()}>
              <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
                Loading comparison...
              </Text>
            </Show>
            <Show when={!loadingComparison() && comparison()}>
              <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.sm }}>
                <div style={{ display: "flex", gap: tokens.spacing.lg }}>
                  <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs }}>
                    <Text style={{ "font-size": "11px", color: tokens.colors.semantic.success }}>
                      +{comparison()!.ahead}
                    </Text>
                    <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
                      commits ahead
                    </Text>
                  </div>
                  <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs }}>
                    <Text style={{ "font-size": "11px", color: tokens.colors.semantic.error }}>
                      -{comparison()!.behind}
                    </Text>
                    <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
                      commits behind
                    </Text>
                  </div>
                </div>
                <Show when={comparison()!.canFastForward}>
                  <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs }}>
                    <Icon name="check" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.success }} />
                    <Text style={{ "font-size": "11px", color: tokens.colors.semantic.success }}>
                      Can fast-forward
                    </Text>
                  </div>
                </Show>
                <Show when={!comparison()!.canFastForward && comparison()!.behind > 0}>
                  <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs }}>
                    <Icon name="circle-exclamation" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.warning }} />
                    <Text style={{ "font-size": "11px", color: tokens.colors.semantic.warning }}>
                      Branches have diverged - merge commit will be created
                    </Text>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </Show>

        {/* Options */}
        <div
          style={{
            "border-top": `1px solid ${tokens.colors.border.divider}`,
            "padding-top": tokens.spacing.lg,
            display: "flex",
            "flex-direction": "column",
            gap: tokens.spacing.md,
          }}
        >
          <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
            <div>
              <Text style={{ "font-size": "12px", color: tokens.colors.text.primary }}>
                Create merge commit (--no-ff)
              </Text>
              <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
                Always create a merge commit, even if fast-forward is possible
              </Text>
            </div>
            <Toggle checked={noFastForward()} onChange={setNoFastForward} />
          </div>

          <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
            <div>
              <Text style={{ "font-size": "12px", color: tokens.colors.text.primary }}>
                Custom commit message
              </Text>
              <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
                Use a custom message instead of the default
              </Text>
            </div>
            <Toggle checked={useCustomMessage()} onChange={setUseCustomMessage} />
          </div>

          <Show when={useCustomMessage()}>
            <Input
              value={customMessage()}
              onInput={(e) => setCustomMessage(e.currentTarget.value)}
              placeholder={`Merge branch '${selectedBranch() || "branch"}' into ${props.currentBranch}`}
            />
          </Show>
        </div>

        {/* Error Display */}
        <Show when={props.error}>
          <div
            style={{
              display: "flex",
              "align-items": "flex-start",
              gap: tokens.spacing.sm,
              padding: tokens.spacing.md,
              background: `${tokens.colors.semantic.error}15`,
              "border-radius": tokens.radius.md,
              border: `1px solid ${tokens.colors.semantic.error}40`,
            }}
          >
            <Icon
              name="circle-exclamation"
              style={{
                width: "14px",
                height: "14px",
                color: tokens.colors.semantic.error,
                "flex-shrink": "0",
                "margin-top": "2px",
              }}
            />
            <Text style={{ "font-size": "12px", color: tokens.colors.semantic.error }}>
              {props.error}
            </Text>
          </div>
        </Show>
      </div>
    </Modal>
  );
}

export default MergeBranchDialog;
