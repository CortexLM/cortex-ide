import { JSX, Show, createSignal } from "solid-js";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";

interface BulkActionsProps {
  selectedIds: string[];
  onDelete: () => Promise<void>;
  onArchive: () => Promise<void>;
  onRestore?: () => Promise<void>;
  onExport: () => Promise<void>;
}

export function BulkActions(props: BulkActionsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [actionLoading, setActionLoading] = createSignal<string | null>(null);

  const handleAction = async (action: () => Promise<void>, actionName: string) => {
    setActionLoading(actionName);
    try {
      await action();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    await handleAction(props.onDelete, "delete");
    setShowDeleteConfirm(false);
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
    padding: "12px 16px",
    background: "var(--surface-card)",
    "border-radius": "var(--jb-radius-lg)",
    border: "1px solid var(--border-default)",
    "margin-top": "16px",
  };

  const countStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    color: "var(--text-primary)",
    "font-weight": "500",
  };

  const dividerStyle: JSX.CSSProperties = {
    width: "1px",
    height: "24px",
    background: "var(--border-default)",
  };

  const count = () => props.selectedIds.length;

  return (
    <Show when={count() > 0}>
      <div style={containerStyle}>
        <span style={countStyle}>
          {count()} session{count() !== 1 ? "s" : ""} selected
        </span>
        
        <div style={dividerStyle} />
        
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleAction(props.onArchive, "archive")}
          loading={actionLoading() === "archive"}
          disabled={actionLoading() !== null}
          icon={<Icon name="archive" size={14} />}
        >
          Archive
        </Button>
        
        <Show when={props.onRestore}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleAction(props.onRestore!, "restore")}
            loading={actionLoading() === "restore"}
            disabled={actionLoading() !== null}
            icon={<Icon name="arrow-rotate-left" size={14} />}
          >
            Restore
          </Button>
        </Show>
        
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleAction(props.onExport, "export")}
          loading={actionLoading() === "export"}
          disabled={actionLoading() !== null}
          icon={<Icon name="download" size={14} />}
        >
          Export CSV
        </Button>
        
        <div style={{ flex: "1" }} />
        
        <Button
          variant="danger"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={actionLoading() !== null}
          icon={<Icon name="trash" size={14} />}
        >
          Delete
        </Button>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteConfirm()}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Sessions"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={actionLoading() === "delete"}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={actionLoading() === "delete"}
            >
              Delete {count()} Session{count() !== 1 ? "s" : ""}
            </Button>
          </>
        }
      >
        <p style={{ "font-size": "14px", color: "var(--text-primary)", margin: "0" }}>
          Are you sure you want to delete {count()} session{count() !== 1 ? "s" : ""}?
          This action cannot be undone.
        </p>
      </Modal>
    </Show>
  );
}
