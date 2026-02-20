import { Component, createSignal, Show } from "solid-js";
import { usePullRequests } from "@/context/PullRequestContext";

interface PullRequestCreateProps {
  onCreated?: () => void;
}

export const PullRequestCreate: Component<PullRequestCreateProps> = (props) => {
  const pr = usePullRequests();

  const [title, setTitle] = createSignal("");
  const [body, setBody] = createSignal("");
  const [head, setHead] = createSignal("");
  const [base, setBase] = createSignal("main");
  const [draft, setDraft] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [localError, setLocalError] = createSignal<string | null>(null);

  const canSubmit = () => title().trim().length > 0 && head().trim().length > 0 && base().trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit()) return;
    setIsSubmitting(true);
    setLocalError(null);

    try {
      const created = await pr.createPR({
        title: title().trim(),
        body: body().trim() || undefined,
        head: head().trim(),
        base: base().trim(),
        draft: draft() || undefined,
      });

      pr.selectPR(created);
      setTitle("");
      setBody("");
      setHead("");
      setBase("main");
      setDraft(false);
      props.onCreated?.();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setLocalError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="flex flex-col h-full overflow-auto">
      <div class="px-4 py-3 border-b border-white/10">
        <div class="text-xs text-white/50 uppercase tracking-wide mb-0.5">New Pull Request</div>
      </div>

      <div class="flex flex-col gap-4 px-4 py-3 flex-1">
        {/* Title */}
        <div class="flex flex-col gap-1">
          <label class="text-xs text-white/50">Title *</label>
          <input
            type="text"
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
            class="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
            placeholder="Pull request title"
          />
        </div>

        {/* Body */}
        <div class="flex flex-col gap-1">
          <label class="text-xs text-white/50">Description</label>
          <textarea
            value={body()}
            onInput={(e) => setBody(e.currentTarget.value)}
            class="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 resize-y min-h-[80px]"
            placeholder="Describe your changes..."
            rows={4}
          />
        </div>

        {/* Branches */}
        <div class="flex gap-3">
          <div class="flex flex-col gap-1 flex-1">
            <label class="text-xs text-white/50">Head branch *</label>
            <input
              type="text"
              value={head()}
              onInput={(e) => setHead(e.currentTarget.value)}
              class="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
              placeholder="feature/my-branch"
            />
          </div>
          <div class="flex items-end pb-2">
            <svg class="w-4 h-4 text-white/30" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 8a.5.5 0 0 1 .5-.5h5.793L8.146 5.354a.5.5 0 1 1 .708-.708l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L10.293 8.5H4.5A.5.5 0 0 1 4 8z" />
            </svg>
          </div>
          <div class="flex flex-col gap-1 flex-1">
            <label class="text-xs text-white/50">Base branch *</label>
            <input
              type="text"
              value={base()}
              onInput={(e) => setBase(e.currentTarget.value)}
              class="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
              placeholder="main"
            />
          </div>
        </div>

        {/* Draft Checkbox */}
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft()}
            onChange={(e) => setDraft(e.currentTarget.checked)}
            class="w-4 h-4 rounded border-white/20 bg-white/5 accent-blue-500"
          />
          <span class="text-sm text-white/70">Create as draft</span>
        </label>

        {/* Error Display */}
        <Show when={localError() || pr.state.error}>
          <div class="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {localError() || pr.state.error}
          </div>
        </Show>

        {/* Submit */}
        <div class="pt-2">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit() || isSubmitting()}
            class="w-full py-2 rounded text-sm font-medium bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting() ? "Creating..." : draft() ? "Create Draft PR" : "Create Pull Request"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PullRequestCreate;
