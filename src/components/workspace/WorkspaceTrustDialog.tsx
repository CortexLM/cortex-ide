import { Component, createSignal } from "solid-js";
import {
  CortexModal,
  CortexButton,
  CortexIcon,
} from "@/components/cortex/primitives";

export interface WorkspaceTrustDialogProps {
  isOpen: boolean;
  workspacePath: string;
  onTrust: () => void;
  onRestricted: () => void;
  onCancel: () => void;
}

export const WorkspaceTrustDialog: Component<WorkspaceTrustDialogProps> = (props) => {
  const [trustParent, setTrustParent] = createSignal(false);

  const parentFolder = () => {
    const parts = props.workspacePath.replace(/\\/g, "/").split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/") : props.workspacePath;
  };

  return (
    <CortexModal
      open={props.isOpen}
      onClose={props.onCancel}
      title="Workspace Trust"
      size="md"
      closable
      closeOnOverlay={false}
      closeOnEscape
    >
      <div class="flex flex-col items-center gap-4 px-2 py-4">
        <div class="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15">
          <CortexIcon name="shield" size={32} style={{ color: "var(--color-warning, #f9e2af)" }} />
        </div>

        <h2 class="text-center text-base font-semibold" style={{ color: "var(--text-primary, #cdd6f4)" }}>
          Do You Trust the Authors of This Workspace?
        </h2>

        <div
          class="w-full rounded-md px-3 py-2 text-xs"
          style={{
            "background-color": "var(--bg-tertiary, #181825)",
            color: "var(--text-secondary, #a6adc8)",
            "word-break": "break-all",
          }}
        >
          <CortexIcon name="folder" size={12} style={{ "margin-right": "6px", "vertical-align": "middle" }} />
          <span class="align-middle">{props.workspacePath}</span>
        </div>

        <div
          class="w-full rounded-lg p-3 text-xs leading-relaxed"
          style={{
            "background-color": "var(--bg-secondary, #1e1e2e)",
            color: "var(--text-secondary, #a6adc8)",
          }}
        >
          <p class="mb-2 font-medium" style={{ color: "var(--text-primary, #cdd6f4)" }}>
            Trusting a workspace allows:
          </p>
          <ul class="ml-4 list-disc space-y-1">
            <li>
              <span class="font-medium" style={{ color: "var(--text-primary, #cdd6f4)" }}>Code execution</span>
              {" — tasks, scripts, and build processes can run automatically"}
            </li>
            <li>
              <span class="font-medium" style={{ color: "var(--text-primary, #cdd6f4)" }}>Extensions</span>
              {" — workspace-recommended extensions may activate with full permissions"}
            </li>
            <li>
              <span class="font-medium" style={{ color: "var(--text-primary, #cdd6f4)" }}>Terminal commands</span>
              {" — shell profiles and automated terminal tasks can execute"}
            </li>
          </ul>
          <p class="mt-2">
            If you don't trust the source, open in restricted mode to browse safely.
          </p>
        </div>

        <label
          class="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors hover:bg-white/5"
          style={{ color: "var(--text-secondary, #a6adc8)" }}
        >
          <input
            type="checkbox"
            checked={trustParent()}
            onChange={(e) => setTrustParent(e.currentTarget.checked)}
            class="accent-lime-400"
          />
          <span>
            Trust all workspaces in{" "}
            <span class="font-medium" style={{ color: "var(--text-primary, #cdd6f4)" }}>
              {parentFolder()}
            </span>
          </span>
        </label>

        <div class="flex w-full flex-col gap-2 pt-1">
          <CortexButton
            variant="primary"
            size="md"
            fullWidth
            onClick={props.onTrust}
            icon="shield"
          >
            Trust Workspace
          </CortexButton>
          <CortexButton
            variant="secondary"
            size="md"
            fullWidth
            onClick={props.onRestricted}
            icon="lock"
          >
            Open in Restricted Mode
          </CortexButton>
          <CortexButton
            variant="ghost"
            size="sm"
            fullWidth
            onClick={props.onCancel}
          >
            Cancel
          </CortexButton>
        </div>
      </div>
    </CortexModal>
  );
};

export default WorkspaceTrustDialog;
