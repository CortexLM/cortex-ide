import { JSX, createSignal, createEffect, Show } from "solid-js";
import { useParams } from "@solidjs/router";
import { SharedSessionHeader } from "@/components/share/SharedSessionHeader";
import { ShareFooter } from "@/components/share/ShareFooter";
import { SharedMessageList } from "@/components/share/SharedMessageList";
import { PasswordPrompt } from "@/components/share/PasswordPrompt";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { fetchSharedSession, fetchProtectedSession, reportShare } from "@/api/share";
import type { SharedSession } from "@/types/share";

/**
 * Page component for viewing shared sessions
 * Route: /share/:token
 */
export default function SharedSessionPage() {
  const params = useParams<{ token: string }>();
  
  const [session, setSession] = createSignal<SharedSession | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [needsPassword, setNeedsPassword] = createSignal(false);
  const [passwordError, setPasswordError] = createSignal<string | null>(null);
  const [passwordLoading, setPasswordLoading] = createSignal(false);
  const [showReportModal, setShowReportModal] = createSignal(false);
  const [reportReason, setReportReason] = createSignal("");
  const [reportSubmitting, setReportSubmitting] = createSignal(false);
  const [reportSuccess, setReportSuccess] = createSignal(false);

  // Fetch session on mount
  createEffect(async () => {
    const token = params.token;
    if (!token) {
      setError("Invalid share link");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await fetchSharedSession(token);
      setSession(data);
    } catch (e) {
      const err = e as Error;
      if (err.message === "Password required") {
        setNeedsPassword(true);
      } else {
        setError(err.message || "Failed to load shared session");
      }
    } finally {
      setLoading(false);
    }
  });

  const handlePasswordSubmit = async (password: string) => {
    const token = params.token;
    if (!token) return;

    try {
      setPasswordLoading(true);
      setPasswordError(null);
      const data = await fetchProtectedSession(token, password);
      setSession(data);
      setNeedsPassword(false);
    } catch (e) {
      const err = e as Error;
      setPasswordError(err.message || "Invalid password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleReport = async () => {
    const token = params.token;
    if (!token || !reportReason().trim()) return;

    try {
      setReportSubmitting(true);
      await reportShare(token, reportReason());
      setReportSuccess(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
        setReportReason("");
      }, 2000);
    } catch (e) {
      console.error("Failed to report:", e);
    } finally {
      setReportSubmitting(false);
    }
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    height: "100vh",
    background: "var(--surface-base)",
  };

  const loadingStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    flex: "1",
    gap: "16px",
    color: "var(--text-muted)",
  };

  const errorContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    flex: "1",
    gap: "16px",
    padding: "20px",
    "text-align": "center",
  };

  const errorIconStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "64px",
    height: "64px",
    background: "color-mix(in srgb, var(--state-error) 10%, transparent)",
    "border-radius": "50%",
    color: "var(--state-error)",
  };

  const errorTitleStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "18px",
    "font-weight": "600",
    color: "var(--text-title)",
    margin: "0",
  };

  const errorDescStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "14px",
    color: "var(--text-muted)",
    margin: "0",
    "max-width": "400px",
  };

  const textareaStyle: JSX.CSSProperties = {
    width: "100%",
    "min-height": "100px",
    padding: "12px",
    "font-family": "var(--jb-font-ui)",
    "font-size": "14px",
    background: "var(--surface-input)",
    border: "1px solid var(--border-default)",
    "border-radius": "var(--jb-radius-sm)",
    color: "var(--text-primary)",
    resize: "vertical",
  };

  // Show password prompt if needed
  if (needsPassword()) {
    return (
      <PasswordPrompt
        onSubmit={handlePasswordSubmit}
        error={passwordError() || undefined}
        loading={passwordLoading()}
      />
    );
  }

  return (
    <div style={containerStyle}>
      {/* Loading state */}
      <Show when={loading()}>
        <div style={loadingStyle}>
          <Icon name="spinner" size={32} class="animate-spin" />
          <span>Loading shared session...</span>
        </div>
      </Show>

      {/* Error state */}
      <Show when={!loading() && error()}>
        <div style={errorContainerStyle}>
          <div style={errorIconStyle}>
            <Icon name="xmark" size={28} />
          </div>
          <h1 style={errorTitleStyle}>Session Not Found</h1>
          <p style={errorDescStyle}>{error()}</p>
          <Button
            variant="secondary"
            onClick={() => window.location.href = "/"}
          >
            Go Home
          </Button>
        </div>
      </Show>

      {/* Session content */}
      <Show when={!loading() && !error() && session()}>
        <SharedSessionHeader
          title={session()!.title}
          createdAt={session()!.createdAt}
          expiresAt={session()!.expiresAt}
          onReport={() => setShowReportModal(true)}
        />
        <SharedMessageList
          messages={session()!.messages}
          readOnly={true}
        />
        <ShareFooter
          sessionId={session()!.id}
          viewCount={session()!.viewCount}
          messageCount={session()!.messages.length}
        />
      </Show>

      {/* Report Modal */}
      <Modal
        open={showReportModal()}
        onClose={() => setShowReportModal(false)}
        title="Report Session"
        size="sm"
        footer={
          <Show when={!reportSuccess()} fallback={
            <div style={{ color: "var(--state-success)", display: "flex", "align-items": "center", gap: "8px" }}>
              <Icon name="check" size={16} />
              <span>Report submitted. Thank you!</span>
            </div>
          }>
            <>
              <Button variant="ghost" onClick={() => setShowReportModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleReport}
                disabled={!reportReason().trim() || reportSubmitting()}
                loading={reportSubmitting()}
              >
                Submit Report
              </Button>
            </>
          </Show>
        }
      >
        <p style={{ "font-size": "14px", color: "var(--text-muted)", "margin-bottom": "16px" }}>
          If this session contains inappropriate content, please let us know.
        </p>
        <textarea
          style={textareaStyle}
          placeholder="Describe the issue..."
          value={reportReason()}
          onInput={(e) => setReportReason(e.currentTarget.value)}
          disabled={reportSubmitting() || reportSuccess()}
        />
      </Modal>
    </div>
  );
}
