import { Show, For, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { Icon } from "./ui/Icon";
import { useToast } from "@/context/ToastContext";
import { collectSystemInfo, formatSystemInfo, type SystemInfo } from "@/utils/systemInfo";
import { getLogs, copyLogsToClipboard, openInBrowser, isTauri } from "@/utils/tauri";
import { invoke } from "@tauri-apps/api/core";

export type FeedbackType = "bug" | "feature" | "general";

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: FeedbackType;
}

interface FeedbackForm {
  type: FeedbackType;
  title: string;
  description: string;
  email: string;
  includeSystemInfo: boolean;
  includeLogs: boolean;
  screenshots: File[];
}

const GITHUB_REPO_URL = "https://github.com/cortex-ai/cortex";
const GITHUB_BUG_REPORT_URL = `${GITHUB_REPO_URL}/issues/new?template=bug_report.yml`;
const GITHUB_FEATURE_REQUEST_URL = `${GITHUB_REPO_URL}/discussions/new?category=ideas`;
const SUPPORT_EMAIL = "support@cortex.ai";

export function FeedbackDialog(props: FeedbackDialogProps) {
  const toast = useToast();
  
  const [form, setForm] = createSignal<FeedbackForm>({
    type: props.initialType || "bug",
    title: "",
    description: "",
    email: "",
    includeSystemInfo: true,
    includeLogs: false,
    screenshots: [],
  });
  
  const [systemInfo, setSystemInfo] = createSignal<SystemInfo | null>(null);
  const [logs, setLogs] = createSignal<string>("");
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [copiedSystemInfo, setCopiedSystemInfo] = createSignal(false);
  const [screenshotPreviews, setScreenshotPreviews] = createSignal<string[]>([]);
  
  const feedbackTypes: { type: FeedbackType; label: string; iconName: string; description: string }[] = [
    { 
      type: "bug", 
      label: "Bug Report", 
      iconName: "circle-exclamation", 
      description: "Report something that isn't working as expected" 
    },
    { 
      type: "feature", 
      label: "Feature Request", 
      iconName: "star", 
      description: "Suggest a new feature or improvement" 
    },
    { 
      type: "general", 
      label: "General Feedback", 
      iconName: "message", 
      description: "Share your thoughts or ask a question" 
    },
  ];
  
  const currentTypeInfo = () => feedbackTypes.find(t => t.type === form().type);
  
  onMount(async () => {
    try {
      const info = await collectSystemInfo();
      setSystemInfo(info);
    } catch (err) {
      console.warn("Failed to collect system info:", err);
    }
  });
  
  createEffect(() => {
    if (props.initialType) {
      setForm(f => ({ ...f, type: props.initialType! }));
    }
  });
  
  createEffect(() => {
    if (form().includeLogs && !logs()) {
      fetchLogs();
    }
  });
  
  const fetchLogs = async () => {
    try {
      if (isTauri()) {
        const logContent = await getLogs();
        setLogs(logContent);
      }
    } catch (err) {
      console.warn("Failed to fetch logs:", err);
    }
  };
  
  const updateForm = <K extends keyof FeedbackForm>(key: K, value: FeedbackForm[K]) => {
    setForm(f => ({ ...f, [key]: value }));
  };
  
  const handleScreenshotUpload = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files) return;
    
    const newFiles = Array.from(input.files).filter(f => f.type.startsWith("image/"));
    if (newFiles.length === 0) return;
    
    updateForm("screenshots", [...form().screenshots, ...newFiles]);
    
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setScreenshotPreviews(prev => [...prev, e.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    input.value = "";
  };
  
  const removeScreenshot = (index: number) => {
    updateForm("screenshots", form().screenshots.filter((_, i) => i !== index));
    setScreenshotPreviews(prev => prev.filter((_, i) => i !== index));
  };
  
  const copySystemInfoToClipboard = async () => {
    const info = systemInfo();
    if (!info) return;
    
    try {
      await navigator.clipboard.writeText(formatSystemInfo(info));
      setCopiedSystemInfo(true);
      setTimeout(() => setCopiedSystemInfo(false), 2000);
      toast.success("System info copied to clipboard");
    } catch (err) {
      toast.error("Failed to copy system info");
    }
  };
  
  const handleCopyLogs = async () => {
    try {
      if (isTauri()) {
        await copyLogsToClipboard();
        toast.success("Logs copied to clipboard");
      } else {
        await navigator.clipboard.writeText(logs());
        toast.success("Logs copied to clipboard");
      }
    } catch (err) {
      toast.error("Failed to copy logs");
    }
  };
  
  const buildGitHubIssueUrl = (): string => {
    const f = form();
    const info = systemInfo();
    
    let body = f.description;
    
    if (f.includeSystemInfo && info) {
      body += `\n\n---\n\n${formatSystemInfo(info)}`;
    }
    
    if (f.email) {
      body += `\n\n**Contact**: ${f.email}`;
    }
    
    const encodedTitle = encodeURIComponent(f.title);
    const encodedBody = encodeURIComponent(body);
    
    if (f.type === "bug") {
      return `${GITHUB_BUG_REPORT_URL}&title=${encodedTitle}&body=${encodedBody}`;
    } else if (f.type === "feature") {
      return `${GITHUB_FEATURE_REQUEST_URL}&title=${encodedTitle}&body=${encodedBody}`;
    } else {
      return `${GITHUB_REPO_URL}/issues/new?title=${encodedTitle}&body=${encodedBody}`;
    }
  };
  
  const buildEmailBody = (): string => {
    const f = form();
    const info = systemInfo();
    
    let body = `Feedback Type: ${currentTypeInfo()?.label}\n\n`;
    body += `Title: ${f.title}\n\n`;
    body += `Description:\n${f.description}\n`;
    
    if (f.includeSystemInfo && info) {
      body += `\n---\n\n${formatSystemInfo(info)}`;
    }
    
    return body;
  };
  
  const handleSubmitToGitHub = async () => {
    const f = form();
    
    if (!f.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    
    if (!f.description.trim()) {
      toast.error("Please enter a description");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const url = buildGitHubIssueUrl();
      
      if (isTauri()) {
        await openInBrowser(url);
      } else {
        window.open(url, "_blank");
      }
      
      toast.success("Opening GitHub in your browser...");
      resetForm();
      props.onClose();
    } catch (err) {
      toast.error("Failed to open GitHub");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleSubmitByEmail = async () => {
    const f = form();
    
    if (!f.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    
    if (!f.description.trim()) {
      toast.error("Please enter a description");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const subject = encodeURIComponent(`[Cortex Feedback] ${f.title}`);
      const body = encodeURIComponent(buildEmailBody());
      const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
      
      if (isTauri()) {
        await openInBrowser(mailtoUrl);
      } else {
        window.location.href = mailtoUrl;
      }
      
      toast.success("Opening email client...");
      resetForm();
      props.onClose();
    } catch (err) {
      toast.error("Failed to open email client");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleSubmitToBackend = async () => {
    const f = form();
    
    if (!f.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    
    if (!f.description.trim()) {
      toast.error("Please enter a description");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Submit feedback via Tauri command
      const feedbackData = {
        type: f.type,
        title: f.title,
        description: f.description,
        email: f.email,
        systemInfo: f.includeSystemInfo && systemInfo() ? systemInfo() : null,
        logs: f.includeLogs && logs() ? logs() : null,
        // Note: Screenshots need to be handled separately as base64
        screenshotCount: f.screenshots.length,
      };
      
      await invoke("submit_feedback", { feedback: feedbackData });
      
      toast.success("Feedback submitted successfully! Thank you.");
      resetForm();
      props.onClose();
    } catch (err) {
      console.warn("Backend submission failed, falling back to GitHub:", err);
      toast.info("Redirecting to GitHub...");
      await handleSubmitToGitHub();
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const resetForm = () => {
    setForm({
      type: "bug",
      title: "",
      description: "",
      email: "",
      includeSystemInfo: true,
      includeLogs: false,
      screenshots: [],
    });
    setScreenshotPreviews([]);
    setLogs("");
  };
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };
  
  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });
  
  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });
  
  const getPlaceholder = () => {
    switch (form().type) {
      case "bug":
        return "Describe the bug you encountered. Include steps to reproduce, expected behavior, and actual behavior.";
      case "feature":
        return "Describe the feature you'd like to see. Explain the problem it would solve and how you envision it working.";
      case "general":
        return "Share your thoughts, questions, or suggestions about Cortex.";
    }
  };
  
  return (
    <Show when={props.isOpen}>
      {/* Backdrop - VS Code: rgba(0,0,0,0.4) with blur */}
      <div
        class="modal-overlay dimmed dialog-backdrop-enter"
        onClick={() => props.onClose()}
      >
        {/* Dialog - VS Code specs: 6px radius, var(--cortex-bg-primary) bg, shadow */}
        <div
          class="dialog dialog-standard dialog-enter mx-4"
          style={{ "max-width": "640px", "width": "100%" }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-dialog-title"
        >
          {/* Header - VS Code: 35px height, 13px font, font-weight 600 */}
          <div class="dialog-header">
            <div class="flex items-center gap-3 dialog-header-title">
              <Icon name="message" class="h-4 w-4 text-primary" />
              <h2 id="feedback-dialog-title" class="text-sm font-semibold">Send Feedback</h2>
            </div>
            <button
              onClick={() => props.onClose()}
              class="dialog-close"
              aria-label="Close"
            >
              <Icon name="xmark" class="h-4 w-4" />
            </button>
          </div>
          
          {/* Content - VS Code: 16px padding */}
          <div class="dialog-content">
            <div class="space-y-6">
              {/* Feedback Type Selector */}
              <div>
                <label class="block text-sm font-medium mb-3">Feedback Type</label>
                <div class="grid grid-cols-3 gap-2">
                  <For each={feedbackTypes}>
                    {(typeInfo) => (
                      <button
                        onClick={() => updateForm("type", typeInfo.type)}
                        class={`flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
                          form().type === typeInfo.type
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-border-active"
                        }`}
                      >
                        <Icon 
                          name={typeInfo.iconName}
                          class={`h-5 w-5 ${
                            form().type === typeInfo.type 
                              ? "text-primary" 
                              : "text-foreground-muted"
                          }`} 
                        />
                        <span class="text-sm font-medium">{typeInfo.label}</span>
                      </button>
                    )}
                  </For>
                </div>
                <p class="mt-2 text-xs text-foreground-muted">
                  {currentTypeInfo()?.description}
                </p>
              </div>
              
              {/* Title */}
              <div>
                <label class="block text-sm font-medium mb-2" for="feedback-title">
                  Title <span class="text-error">*</span>
                </label>
                <input
                  id="feedback-title"
                  type="text"
                  value={form().title}
                  onInput={(e) => updateForm("title", e.currentTarget.value)}
                  placeholder={form().type === "bug" ? "Summarize the issue" : "Brief summary"}
                  class="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              {/* Description */}
              <div>
                <label class="block text-sm font-medium mb-2" for="feedback-description">
                  Description <span class="text-error">*</span>
                </label>
                <textarea
                  id="feedback-description"
                  value={form().description}
                  onInput={(e) => updateForm("description", e.currentTarget.value)}
                  placeholder={getPlaceholder()}
                  rows={6}
                  class="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm resize-none focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              {/* Email */}
              <div>
                <label class="block text-sm font-medium mb-2" for="feedback-email">
                  Email (optional)
                </label>
                <div class="relative">
                  <Icon name="envelope" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                  <input
                    id="feedback-email"
                    type="email"
                    value={form().email}
                    onInput={(e) => updateForm("email", e.currentTarget.value)}
                    placeholder="your.email@example.com"
                    class="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <p class="mt-1 text-xs text-foreground-muted">
                  We'll only use this to follow up on your feedback
                </p>
              </div>
              
              {/* Screenshots */}
              <div>
                <label class="block text-sm font-medium mb-2">
                  Screenshots (optional)
                </label>
                <div class="flex flex-wrap gap-2">
                  <For each={screenshotPreviews()}>
                    {(preview, index) => (
                      <div class="relative group">
                        <img 
                          src={preview} 
                          alt={`Screenshot ${index() + 1}`}
                          class="h-20 w-20 object-cover rounded-lg border border-border"
                        />
                        <button
                          onClick={() => removeScreenshot(index())}
                          class="absolute -top-2 -right-2 p-1 rounded-full bg-error text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Icon name="trash" class="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </For>
                  <label class="h-20 w-20 flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border hover:border-primary cursor-pointer transition-colors">
                    <Icon name="camera" class="h-5 w-5 text-foreground-muted" />
                    <span class="text-xs text-foreground-muted">Add</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleScreenshotUpload}
                      class="hidden"
                    />
                  </label>
                </div>
              </div>
              
              {/* Options */}
              <div class="space-y-3">
                {/* Include System Info */}
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form().includeSystemInfo}
                    onChange={(e) => updateForm("includeSystemInfo", e.currentTarget.checked)}
                    class="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div class="flex-1">
                    <span class="text-sm font-medium">Include system information</span>
                    <p class="text-xs text-foreground-muted">
                      OS, app version, and other diagnostic info
                    </p>
                  </div>
                  <Show when={form().includeSystemInfo && systemInfo()}>
                    <button
                      onClick={copySystemInfoToClipboard}
                      class="p-1.5 rounded hover:bg-background-tertiary transition-colors"
                      title="Copy system info"
                    >
                      <Show when={copiedSystemInfo()} fallback={<Icon name="copy" class="h-4 w-4 text-foreground-muted" />}>
                        <Icon name="check" class="h-4 w-4 text-success" />
                      </Show>
                    </button>
                  </Show>
                </label>
                
                {/* System Info Preview */}
                <Show when={form().includeSystemInfo && systemInfo()}>
                  <div class="ml-7 p-3 rounded-lg bg-background text-xs font-mono text-foreground-muted">
                    <div class="flex items-center gap-2 mb-2">
                      <Icon name="circle-info" class="h-3.5 w-3.5" />
                      <span class="font-sans text-xs font-medium">System Information</span>
                    </div>
                    <div class="space-y-0.5">
                      <div>OS: {systemInfo()!.os} {systemInfo()!.osVersion}</div>
                      <div>Arch: {systemInfo()!.arch}</div>
                      <div>App Version: {systemInfo()!.appVersion}</div>
                      <div>Platform: {systemInfo()!.platform}</div>
                    </div>
                  </div>
                </Show>
                
                {/* Include Logs */}
                <Show when={form().type === "bug"}>
                  <label class="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form().includeLogs}
                      onChange={(e) => updateForm("includeLogs", e.currentTarget.checked)}
                      class="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <div class="flex-1">
                      <span class="text-sm font-medium">Include application logs</span>
                      <p class="text-xs text-foreground-muted">
                        Recent logs that may help diagnose the issue
                      </p>
                    </div>
                    <Show when={form().includeLogs && logs()}>
                      <button
                        onClick={handleCopyLogs}
                        class="p-1.5 rounded hover:bg-background-tertiary transition-colors"
                        title="Copy logs"
                      >
                        <Icon name="copy" class="h-4 w-4 text-foreground-muted" />
                      </button>
                    </Show>
                  </label>
                  
                  {/* Logs Preview */}
                  <Show when={form().includeLogs && logs()}>
                    <div class="ml-7 p-3 rounded-lg bg-background text-xs font-mono text-foreground-muted max-h-32 overflow-y-auto">
                      <pre class="whitespace-pre-wrap">{logs().slice(0, 1000)}{logs().length > 1000 ? "..." : ""}</pre>
                    </div>
                  </Show>
                </Show>
              </div>
            </div>
          </div>
          
          {/* Footer - VS Code: border-top, 12px 16px padding, 8px gap */}
          <div class="dialog-footer" style={{ "justify-content": "space-between" }}>
            <div class="flex items-center">
              <div class="text-xs text-foreground-muted">
                <Show when={form().type === "bug"}>
                  Bug reports help us improve Cortex
                </Show>
                <Show when={form().type === "feature"}>
                  Feature requests are reviewed by our team
                </Show>
                <Show when={form().type === "general"}>
                  Thank you for your feedback!
                </Show>
              </div>
              
              <div class="flex items-center gap-2">
                <button
                  onClick={() => props.onClose()}
                  class="px-4 py-2 text-sm rounded-lg border border-border hover:bg-background-tertiary transition-colors"
                >
                  Cancel
                </button>
                
                <div class="relative group">
                  <button
                    onClick={handleSubmitToBackend}
                    disabled={isSubmitting() || !form().title.trim() || !form().description.trim()}
                    class="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Show when={isSubmitting()} fallback={<Icon name="paper-plane" class="h-4 w-4" />}>
                      <div class="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </Show>
                    Submit
                  </button>
                  
                  {/* Dropdown menu for alternative submission methods */}
                  <div class="absolute right-0 bottom-full mb-2 w-48 py-1 rounded-lg border border-border bg-background-secondary shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <button
                      onClick={handleSubmitToGitHub}
                      disabled={isSubmitting()}
                      class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-background-tertiary transition-colors"
                    >
                      <Icon name="arrow-up-right-from-square" class="h-4 w-4" />
                      Open on GitHub
                    </button>
                    <button
                      onClick={handleSubmitByEmail}
                      disabled={isSubmitting()}
                      class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-background-tertiary transition-colors"
                    >
                      <Icon name="envelope" class="h-4 w-4" />
                      Send via Email
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

