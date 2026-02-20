import { Component, createSignal, Show, Switch, Match } from "solid-js";
import { usePullRequests } from "@/context/PullRequestContext";
import { PullRequestList } from "@/components/cortex/git/PullRequestList";
import { PullRequestDetail } from "@/components/cortex/git/PullRequestDetail";
import { PullRequestCreate } from "@/components/cortex/git/PullRequestCreate";

type TabId = "list" | "detail" | "create";

export const PullRequestPanel: Component = () => {
  const pr = usePullRequests();

  const [activeTab, setActiveTab] = createSignal<TabId>("list");
  const [tokenInput, setTokenInput] = createSignal("");
  const [ownerInput, setOwnerInput] = createSignal(pr.state.owner);
  const [repoInput, setRepoInput] = createSignal(pr.state.repo);

  const handleSetAuth = async () => {
    const token = tokenInput().trim();
    if (!token) return;
    try {
      await pr.setAuth(token);
      setTokenInput("");
    } catch {
      // Error is set in context state
    }
  };

  const handleSetRepo = () => {
    const owner = ownerInput().trim();
    const repo = repoInput().trim();
    if (!owner || !repo) return;
    pr.setRepository(owner, repo);
    void pr.fetchPRs();
  };

  const navigateToDetail = () => setActiveTab("detail");
  const navigateToList = () => {
    pr.selectPR(null);
    setActiveTab("list");
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "list", label: "List" },
    { id: "detail", label: "Detail" },
    { id: "create", label: "Create" },
  ];

  return (
    <div class="flex flex-col h-full bg-[#1e1e1e] text-white text-sm">
      {/* Auth Gate */}
      <Show when={!pr.state.isAuthenticated}>
        <div class="flex flex-col items-center justify-center flex-1 px-6 py-8 gap-4">
          <svg class="w-10 h-10 text-white/30" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a4 4 0 0 0-4 4v1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4zm2 5V5a2 2 0 1 0-4 0v1h4z" />
          </svg>
          <p class="text-white/50 text-center">Authenticate to access pull requests</p>
          <div class="flex gap-2 w-full max-w-xs">
            <input
              type="password"
              value={tokenInput()}
              onInput={(e) => setTokenInput(e.currentTarget.value)}
              class="flex-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
              placeholder="GitHub token"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSetAuth();
              }}
            />
            <button
              onClick={handleSetAuth}
              disabled={!tokenInput().trim()}
              class="px-4 py-1.5 rounded text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Auth
            </button>
          </div>
          <Show when={pr.state.error}>
            <p class="text-red-400 text-xs">{pr.state.error}</p>
          </Show>
        </div>
      </Show>

      <Show when={pr.state.isAuthenticated}>
        {/* Repository Selector */}
        <div class="flex items-center gap-2 px-4 py-2 border-b border-white/10">
          <input
            type="text"
            value={ownerInput()}
            onInput={(e) => setOwnerInput(e.currentTarget.value)}
            class="w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-white/30 outline-none focus:border-white/30"
            placeholder="owner"
          />
          <span class="text-white/30">/</span>
          <input
            type="text"
            value={repoInput()}
            onInput={(e) => setRepoInput(e.currentTarget.value)}
            class="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-white/30 outline-none focus:border-white/30"
            placeholder="repo"
          />
          <button
            onClick={handleSetRepo}
            disabled={!ownerInput().trim() || !repoInput().trim()}
            class="px-3 py-1 rounded text-xs font-medium bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Set
          </button>
        </div>

        {/* Tab Bar */}
        <div class="flex border-b border-white/10">
          {tabs.map((tab) => (
            <button
              class={`flex-1 py-2 text-xs font-medium transition-colors ${
                activeTab() === tab.id
                  ? "text-white border-b-2 border-blue-400"
                  : "text-white/50 hover:text-white/80"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div class="flex-1 overflow-hidden">
          <Switch>
            <Match when={activeTab() === "list"}>
              <PullRequestList onSelectPR={navigateToDetail} />
            </Match>
            <Match when={activeTab() === "detail"}>
              <PullRequestDetail onBack={navigateToList} />
            </Match>
            <Match when={activeTab() === "create"}>
              <PullRequestCreate
                onCreated={() => {
                  navigateToDetail();
                }}
              />
            </Match>
          </Switch>
        </div>
      </Show>
    </div>
  );
};

export default PullRequestPanel;
