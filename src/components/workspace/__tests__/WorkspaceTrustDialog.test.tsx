import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/components/cortex/primitives", () => ({
  CortexModal: (props: any) => (
    <div data-testid="modal" data-open={props.open}>
      {props.open ? props.children : null}
    </div>
  ),
  CortexButton: (props: any) => (
    <button onClick={props.onClick} data-variant={props.variant}>
      {props.children}
    </button>
  ),
  CortexIcon: (props: any) => (
    <span data-testid="icon" data-name={props.name} />
  ),
}));

describe("WorkspaceTrustDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("component is defined", async () => {
    const { WorkspaceTrustDialog } = await import("../WorkspaceTrustDialog");
    expect(WorkspaceTrustDialog).toBeDefined();
    expect(typeof WorkspaceTrustDialog).toBe("function");
  });

  it("renders when isOpen=true", async () => {
    const { WorkspaceTrustDialog } = await import("../WorkspaceTrustDialog");
    const { container } = render(() => (
      <WorkspaceTrustDialog
        isOpen={true}
        workspacePath="/home/user/project"
        onTrust={vi.fn()}
        onRestricted={vi.fn()}
        onCancel={vi.fn()}
      />
    ));
    expect(container.querySelector('[data-testid="modal"]')).toBeTruthy();
  });

  it("shows workspace path", async () => {
    const { WorkspaceTrustDialog } = await import("../WorkspaceTrustDialog");
    const { container } = render(() => (
      <WorkspaceTrustDialog
        isOpen={true}
        workspacePath="/home/user/my-project"
        onTrust={vi.fn()}
        onRestricted={vi.fn()}
        onCancel={vi.fn()}
      />
    ));
    expect(container.textContent).toContain("/home/user/my-project");
  });

  it("shows trust button", async () => {
    const { WorkspaceTrustDialog } = await import("../WorkspaceTrustDialog");
    const { container } = render(() => (
      <WorkspaceTrustDialog
        isOpen={true}
        workspacePath="/home/user/project"
        onTrust={vi.fn()}
        onRestricted={vi.fn()}
        onCancel={vi.fn()}
      />
    ));
    expect(container.textContent).toContain("Trust Workspace");
  });

  it("shows restricted mode button", async () => {
    const { WorkspaceTrustDialog } = await import("../WorkspaceTrustDialog");
    const { container } = render(() => (
      <WorkspaceTrustDialog
        isOpen={true}
        workspacePath="/home/user/project"
        onTrust={vi.fn()}
        onRestricted={vi.fn()}
        onCancel={vi.fn()}
      />
    ));
    expect(container.textContent).toContain("Open in Restricted Mode");
  });

  it("shows cancel button", async () => {
    const { WorkspaceTrustDialog } = await import("../WorkspaceTrustDialog");
    const { container } = render(() => (
      <WorkspaceTrustDialog
        isOpen={true}
        workspacePath="/home/user/project"
        onTrust={vi.fn()}
        onRestricted={vi.fn()}
        onCancel={vi.fn()}
      />
    ));
    expect(container.textContent).toContain("Cancel");
  });

  it("trust parent checkbox exists", async () => {
    const { WorkspaceTrustDialog } = await import("../WorkspaceTrustDialog");
    const { container } = render(() => (
      <WorkspaceTrustDialog
        isOpen={true}
        workspacePath="/home/user/project"
        onTrust={vi.fn()}
        onRestricted={vi.fn()}
        onCancel={vi.fn()}
      />
    ));
    const checkbox = container.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeTruthy();
  });

  it("calls onTrust when trust button clicked", async () => {
    const onTrust = vi.fn();
    const { WorkspaceTrustDialog } = await import("../WorkspaceTrustDialog");
    const { container } = render(() => (
      <WorkspaceTrustDialog
        isOpen={true}
        workspacePath="/home/user/project"
        onTrust={onTrust}
        onRestricted={vi.fn()}
        onCancel={vi.fn()}
      />
    ));
    const buttons = container.querySelectorAll("button");
    const trustButton = Array.from(buttons).find((b) =>
      b.textContent?.includes("Trust Workspace")
    );
    expect(trustButton).toBeTruthy();
    await fireEvent.click(trustButton!);
    expect(onTrust).toHaveBeenCalled();
  });

  it("calls onCancel when cancel button clicked", async () => {
    const onCancel = vi.fn();
    const { WorkspaceTrustDialog } = await import("../WorkspaceTrustDialog");
    const { container } = render(() => (
      <WorkspaceTrustDialog
        isOpen={true}
        workspacePath="/home/user/project"
        onTrust={vi.fn()}
        onRestricted={vi.fn()}
        onCancel={onCancel}
      />
    ));
    const buttons = container.querySelectorAll("button");
    const cancelButton = Array.from(buttons).find(
      (b) => b.textContent?.trim() === "Cancel"
    );
    expect(cancelButton).toBeTruthy();
    await fireEvent.click(cancelButton!);
    expect(onCancel).toHaveBeenCalled();
  });
});
